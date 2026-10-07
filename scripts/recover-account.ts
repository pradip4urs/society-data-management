import { z } from "zod";
import { db } from "../src/server/db";
const data = z
  .object({
    email: z.email(),
    reason: z.string().min(20).max(500),
    operator: z.string().min(3).max(100),
  })
  .parse({
    email: process.env.RECOVERY_EMAIL,
    reason: process.env.RECOVERY_REASON,
    operator: process.env.RECOVERY_OPERATOR,
  });
try {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { email: data.email.toLowerCase() },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.twoFactor.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });
    const memberships = await tx.societyMembership.findMany({
      where: { userId: user.id },
    });
    await tx.auditEvent.createMany({
      data: memberships.map((m) => ({
        societyId: m.societyId,
        actorId: "host-operator",
        action: "OPERATOR_MFA_RECOVERY",
        entityType: "User",
        entityId: user.id,
        metadata: { operator: data.operator, reason: data.reason },
      })),
    });
  });
  console.log(
    "MFA reset audited; sessions revoked. Privileged access requires re-enrollment.",
  );
} finally {
  await db.$disconnect();
}
