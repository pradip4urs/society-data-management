import { db } from "./db";
import { denied } from "./errors";
import type { Role } from "@/generated/prisma/client";
export type Context = {
  userId: string;
  societyId: string;
  membershipId: string;
  personId: string | null;
  role: Role;
};
export type Capability =
  | "directory"
  | "master.write"
  | "parking.read"
  | "audit"
  | "security"
  | "profile";
const roles: Record<Capability, Role[]> = {
  directory: ["ADMIN", "CASHIER", "RESIDENT"],
  "master.write": ["ADMIN"],
  "parking.read": ["ADMIN", "CASHIER", "RESIDENT"],
  audit: ["ADMIN", "AUDITOR"],
  security: ["SECURITY"],
  profile: ["ADMIN", "CASHIER", "RESIDENT", "SECURITY", "AUDITOR"],
};
export function requireCapability(ctx: Context, capability: Capability) {
  if (!roles[capability].includes(ctx.role)) throw denied();
}
export async function getContext(
  userId: string,
  societyId: string,
): Promise<Context> {
  const member = await db.societyMembership.findUnique({
    where: { societyId_userId: { societyId, userId } },
    select: {
      id: true,
      role: true,
      active: true,
      personId: true,
      user: { select: { twoFactorEnabled: true } },
    },
  });
  if (!member?.active) throw denied();
  if (
    ["ADMIN", "CASHIER", "AUDITOR"].includes(member.role) &&
    !member.user.twoFactorEnabled &&
    !(
      process.env.NODE_ENV !== "production" &&
      process.env.DEV_MFA_BYPASS === "true"
    )
  ) {
    throw new Error("MFA_REQUIRED");
  }
  return {
    userId,
    societyId,
    membershipId: member.id,
    personId: member.personId,
    role: member.role,
  };
}
// DATE comparisons use society-local calendar day, converted to a UTC date value.
export function today() {
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()) + "T00:00:00Z",
  );
}
export function currentRange(date = today()) {
  return {
    startsOn: { lte: date },
    OR: [{ endsOn: null }, { endsOn: { gt: date } }],
  };
}
export function grantWhere(ctx: Context) {
  return {
    societyId: ctx.societyId,
    membershipId: ctx.membershipId,
    revokedAt: null,
    ...currentRange(),
    AND: [
      { OR: [{ occupancyId: null }, { occupancy: { is: currentRange() } }] },
    ],
  };
}
export function flatScope(ctx: Context) {
  return {
    societyId: ctx.societyId,
    ...(ctx.role === "RESIDENT" ? { grants: { some: grantWhere(ctx) } } : {}),
  };
}
