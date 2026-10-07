import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { authRateStorage } from "./rate-limit";
import { authSecret } from "./config";
import { hashedRecoveryStorage, recoveryInput } from "./recovery-codes";
import { APIError, createAuthMiddleware } from "better-auth/api";

if (
  process.env.NODE_ENV === "production" &&
  process.env.DEV_MFA_BYPASS === "true"
) {
  throw new Error("Development MFA bypass cannot run in production");
}
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: authSecret(),
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 12 },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customStorage: authRateStorage,
    customRules: { "/sign-in/email": { window: 60, max: 30 } },
  },
  databaseHooks: {
    user: {
      update: {
        after: async (user) => {
          // Enabling/changing MFA invalidates pre-enrollment sessions; Better Auth issues
          // the verified replacement session after updating the user.
          if (user.twoFactorEnabled)
            await db.session.deleteMany({ where: { userId: user.id } });
        },
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/two-factor/verify-backup-code") {
        try {
          ctx.body.code = recoveryInput(ctx.body?.code);
        } catch {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid recovery code",
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/two-factor/verify-backup-code") return;
      const userId =
        ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;
      if (!userId || ctx.context.returned instanceof APIError) return;
      const memberships = await db.societyMembership.findMany({
        where: { userId, active: true },
        select: { societyId: true },
      });
      await db.auditEvent.createMany({
        data: memberships.map((m) => ({
          societyId: m.societyId,
          actorId: userId,
          action: "RECOVERY_CODE_USED",
          entityType: "User",
          entityId: userId,
        })),
      });
    }),
  },
  plugins: [
    twoFactor({
      issuer: "Society Desk",
      backupCodeOptions: {
        length: 20,
        storeBackupCodes: hashedRecoveryStorage,
      },
    }),
  ],
});
