import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/server/db";
export async function seed() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV !== "development"
  )
    throw new Error("Synthetic seed requires NODE_ENV=development");
  const plain = process.env.SEED_PASSWORD;
  if (!plain || plain.length < 12)
    throw new Error(
      "Set SEED_PASSWORD to a development-only password of at least 12 characters",
    );
  if ((await db.society.count()) > 0)
    throw new Error(
      "Seed expects an empty database; no existing data is changed",
    );
  const password = await hashPassword(plain);
  await db.$transaction(async (tx) => {
    for (const [societyId, name] of [
      ["demo-society", "Sahyadri Gardens (Demo)"],
      ["other-society", "Meadow Court (Demo)"],
    ]) {
      await tx.society.create({ data: { id: societyId, name } });
      const phase = await tx.phase.create({
        data: { societyId, name: "Phase 1" },
      });
      const block = await tx.block.create({
        data: { societyId, phaseId: phase.id, name: "A" },
      });
      const flats = [];
      for (let n = 1; n <= 8; n++)
        flats.push(
          await tx.flat.create({
            data: {
              societyId,
              blockId: block.id,
              number: String(100 + n),
              floor: 1,
              flatType: n % 2 ? "2 BHK" : "3 BHK",
              areaSqFt: "1024.125",
              billableAreaSqFt: "1024.125",
              areaBasis: "SUPER_BUILT_UP",
              classification:
                n < 3 ? "TENANT_OCCUPIED" : n < 5 ? "OWNER_OCCUPIED" : "VACANT",
              residentRemarks: "Synthetic demonstration flat",
              internalRemarks: "Fictional internal note",
            },
          }),
        );
      const prefix = societyId === "demo-society" ? "" : "other-";
      for (const [login, role, personName, flatIndex] of [
        ["admin", "ADMIN", "Demo Administrator", -1],
        ["cashier", "CASHIER", "Demo Cashier", -1],
        ["security", "SECURITY", "Demo Gatekeeper", -1],
        ["auditor", "AUDITOR", "Demo Auditor", -1],
        ["resident-a", "RESIDENT", "Fictional Resident Alpha", 0],
        ["resident-b", "RESIDENT", "Fictional Resident Beta", 1],
      ] as const) {
        const person = await tx.person.create({
          data: {
            societyId,
            name: personName,
            email: `${prefix}${login}@example.test`,
            phone: "DEMO-PRIVATE",
            approvedPhone: "DEMO-CONTACT",
            internalNotes:
              "Never expose this synthetic internal note to security",
          },
        });
        const userId = `${prefix}${login}`;
        await tx.user.create({
          data: {
            id: userId,
            name: personName,
            email: `${userId}@example.test`,
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
          data: { societyId, userId, role, personId: person.id },
        });
        if (flatIndex >= 0) {
          const flat = flats[flatIndex];
          const occupancy = await tx.occupancy.create({
            data: {
              societyId,
              flatId: flat.id,
              personId: person.id,
              startsOn: new Date("2020-01-01Z"),
              kind: "TENANT",
            },
          });
          await tx.residentAccessGrant.create({
            data: {
              societyId,
              membershipId: membership.id,
              flatId: flat.id,
              occupancyId: occupancy.id,
              startsOn: new Date("2020-01-01Z"),
            },
          });
          await tx.ownership.create({
            data: {
              societyId,
              flatId: flat.id,
              personId: person.id,
              startsOn: new Date("2019-01-01Z"),
            },
          });
        }
      }
      const slot = await tx.parkingSlot.create({
        data: { societyId, label: "P-001", location: "Basement", type: "CAR" },
      });
      await tx.parkingEntitlement.create({
        data: {
          societyId,
          slotId: slot.id,
          flatId: flats[0].id,
          basis: "SYNTHETIC_ENTITLEMENT",
          startsOn: new Date("2020-01-01Z"),
        },
      });
      const allocation = await tx.parkingAllocation.create({
        data: {
          societyId,
          slotId: slot.id,
          flatId: flats[0].id,
          type: "SOCIETY_ALLOTTED",
          startsOn: new Date("2020-01-01Z"),
        },
      });
      await tx.vehicle.create({
        data: {
          societyId,
          flatId: flats[0].id,
          allocationId: allocation.id,
          registration: prefix + "DEMO0001",
          type: "CAR",
          color: "Silver",
        },
      });
      await tx.auditEvent.create({
        data: {
          societyId,
          actorId: "seed",
          action: "SYNTHETIC_SEED",
          entityType: "Society",
          entityId: societyId,
        },
      });
    }
  });
  console.log(
    "Created two synthetic societies and six accounts per society. No real resident data.",
  );
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("prisma/seed.ts")) {
  try {
    await seed();
  } finally {
    await db.$disconnect();
  }
}
