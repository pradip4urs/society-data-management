import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "./db";
export const bootstrapInput = z
  .object({
    societyName: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    password: z.string().min(16).max(128),
  })
  .strict();
export async function bootstrapAdmin(input: unknown) {
  const data = bootstrapInput.parse(input);
  const password = await hashPassword(data.password);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(19372171)`;
    if ((await tx.user.count()) || (await tx.society.count()))
      throw new Error("First-admin bootstrap requires an empty installation");
    const society = await tx.society.create({
      data: { name: data.societyName },
    });
    const person = await tx.person.create({
      data: {
        societyId: society.id,
        name: data.name,
        email: data.email.toLowerCase(),
      },
    });
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
    await tx.societyMembership.create({
      data: {
        societyId: society.id,
        userId,
        personId: person.id,
        role: "ADMIN",
      },
    });
    await tx.auditEvent.create({
      data: {
        societyId: society.id,
        actorId: "host-bootstrap",
        action: "FIRST_ADMIN_BOOTSTRAPPED",
        entityType: "User",
        entityId: userId,
      },
    });
    return { societyId: society.id, userId };
  });
}
