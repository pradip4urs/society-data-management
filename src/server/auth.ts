import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { authRateStorage } from "./rate-limit";

if (
  process.env.NODE_ENV === "production" &&
  process.env.DEV_MFA_BYPASS === "true"
) {
  throw new Error("Development MFA bypass cannot run in production");
}
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
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
  plugins: [twoFactor({ issuer: "Society Desk" })],
});
