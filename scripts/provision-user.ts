import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/server/db";
import { z } from "zod";
// Operator CLI only; password on stdin (legacy local environment fallback), never command args.
let stdinPassword = "";
for await (const chunk of process.stdin) {
  stdinPassword += chunk.toString();
  if (stdinPassword.length > 256) throw new Error("Password input too long");
}
const data = z
  .object({
    email: z.email(),
    name: z.string().min(1),
    password: z.string().min(12),
    societyId: z.string().min(1),
    role: z.enum(["ADMIN", "CASHIER", "RESIDENT", "SECURITY", "AUDITOR"]),
    personId: z.string().optional(),
  })
  .parse({
    email: process.env.PROVISION_EMAIL,
    name: process.env.PROVISION_NAME,
    password: stdinPassword.trimEnd() || process.env.PROVISION_PASSWORD,
    societyId: process.env.PROVISION_SOCIETY_ID,
    role: process.env.PROVISION_ROLE ?? "RESIDENT",
    personId: process.env.PROVISION_PERSON_ID,
  });
try {
  const password = await hashPassword(data.password);
  await db.$transaction(async (tx) => {
    const userId = randomUUID();
    await tx.user.create({
      data: {
        id: userId,
        name: data.name,
        email: data.email.toLowerCase(),
        emailVerified: true,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password,
          },
        },
      },
    });
    const membership = await tx.societyMembership.create({
      data: {
        societyId: data.societyId,
        userId,
        role: data.role,
        personId: data.personId,
      },
    });
    await tx.auditEvent.create({
      data: {
        societyId: data.societyId,
        actorId: "operator",
        action: "USER_PROVISIONED",
        entityType: "SocietyMembership",
        entityId: membership.id,
        metadata: { role: data.role },
      },
    });
  });
  console.log(
    "User provisioned. Privileged accounts must enroll TOTP before business access.",
  );
} finally {
  await db.$disconnect();
}
