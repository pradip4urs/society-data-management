import "server-only";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import {
  currentRange,
  flatScope,
  requireCapability,
  type Context,
} from "./permissions";
import { DomainError, missing } from "./errors";
import * as v from "./validation";
import { parseFlatCsv } from "./csv-import";
type Tx = Prisma.TransactionClient;
export async function audit(
  tx: Tx,
  ctx: Context,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await tx.auditEvent.create({
    data: {
      societyId: ctx.societyId,
      actorId: ctx.userId,
      action,
      entityType,
      entityId,
      metadata,
    },
  });
}
const physical = {
  id: true,
  number: true,
  floor: true,
  flatType: true,
  areaSqFt: true,
  billableAreaSqFt: true,
  areaBasis: true,
  classification: true,
  residentRemarks: true,
  block: {
    select: {
      id: true,
      name: true,
      phase: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.FlatSelect;
export async function listFlats(ctx: Context, search = "", page = 1) {
  requireCapability(ctx, "directory");
  const where: Prisma.FlatWhereInput = {
    ...flatScope(ctx),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { block: { name: { contains: search, mode: "insensitive" } } },
            ...(ctx.role !== "RESIDENT"
              ? [
                  {
                    occupancies: {
                      some: {
                        ...currentRange(),
                        person: {
                          OR: [
                            {
                              name: {
                                contains: search,
                                mode: "insensitive" as const,
                              },
                            },
                            { approvedPhone: { contains: search } },
                          ],
                        },
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
  const select = {
    ...physical,
    ...(ctx.role !== "RESIDENT"
      ? {
          occupancies: {
            where: currentRange(),
            select: { person: { select: { name: true, approvedPhone: true } } },
          },
        }
      : {}),
  } satisfies Prisma.FlatSelect;
  const [rows, total] = await db.$transaction([
    db.flat.findMany({
      where,
      select,
      orderBy: [
        { block: { name: "asc" } },
        { floor: "asc" },
        { number: "asc" },
      ],
      take: 50,
      skip: (page - 1) * 50,
    }),
    db.flat.count({ where }),
  ]);
  return { rows, total, page, pageSize: 50 };
}
export async function getFlat(ctx: Context, flatId: string) {
  requireCapability(ctx, "directory");
  const flat = await db.flat.findFirst({
    where: { ...flatScope(ctx), id: flatId },
    select: {
      ...physical,
      ...(ctx.role === "ADMIN"
        ? {
            internalRemarks: true,
            ownerships: {
              select: {
                id: true,
                startsOn: true,
                endsOn: true,
                person: {
                  select: { id: true, name: true, email: true, phone: true },
                },
              },
            },
            occupancies: {
              select: {
                id: true,
                kind: true,
                startsOn: true,
                endsOn: true,
                person: {
                  select: { id: true, name: true, email: true, phone: true },
                },
              },
            },
            grants: {
              select: {
                id: true,
                membershipId: true,
                startsOn: true,
                endsOn: true,
                revokedAt: true,
              },
            },
          }
        : {}),
    },
  });
  if (!flat) throw missing();
  return flat;
}
export async function updateFlat(ctx: Context, flatId: string, input: unknown) {
  requireCapability(ctx, "master.write");
  const data = v.flatInput.parse(input);
  return db.$transaction(async (tx) => {
    const row = await tx.flat.update({
      where: { societyId_id: { societyId: ctx.societyId, id: flatId } },
      data,
      select: { id: true },
    });
    await audit(tx, ctx, "FLAT_UPDATED", "Flat", row.id);
    return row;
  });
}
export async function hierarchy(ctx: Context) {
  requireCapability(ctx, "master.write");
  return db.phase.findMany({
    where: { societyId: ctx.societyId },
    select: {
      id: true,
      name: true,
      blocks: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
}
export async function adminData(ctx: Context) {
  requireCapability(ctx, "master.write");
  const [persons, memberships, slots, policy] = await Promise.all([
    db.person.findMany({
      where: { societyId: ctx.societyId },
      select: { id: true, name: true },
      take: 1000,
      orderBy: { name: "asc" },
    }),
    db.societyMembership.findMany({
      where: { societyId: ctx.societyId },
      select: {
        id: true,
        role: true,
        active: true,
        personId: true,
        user: { select: { name: true, email: true } },
      },
      take: 1000,
    }),
    db.parkingSlot.findMany({
      where: { societyId: ctx.societyId },
      select: { id: true, label: true, location: true, type: true },
      take: 1000,
    }),
    db.society.findUniqueOrThrow({
      where: { id: ctx.societyId },
      select: { securityEnabled: true, securityVehicles: true },
    }),
  ]);
  return { persons, memberships, slots, policy };
}
export async function listParking(ctx: Context) {
  requireCapability(ctx, "parking.read");
  const allocations = await db.parkingAllocation.findMany({
    where: { societyId: ctx.societyId, flat: flatScope(ctx) },
    take: 200,
    orderBy: { startsOn: "desc" },
    select: {
      id: true,
      type: true,
      startsOn: true,
      endsOn: true,
      slot: { select: { label: true, location: true, type: true } },
      flat: {
        select: { id: true, number: true, block: { select: { name: true } } },
      },
      vehicles: {
        select: {
          registration: true,
          type: true,
          color: true,
          make: true,
          model: true,
        },
      },
    },
  });
  const entitlements =
    ctx.role === "ADMIN"
      ? await db.parkingEntitlement.findMany({
          where: { societyId: ctx.societyId },
          take: 200,
          select: {
            id: true,
            basis: true,
            startsOn: true,
            endsOn: true,
            flat: { select: { number: true } },
            slot: { select: { label: true } },
          },
        })
      : [];
  return { allocations, entitlements, limit: 200 };
}
export async function securityLookup(ctx: Context, search: string) {
  requireCapability(ctx, "security");
  return db.$transaction(async (tx) => {
    const society = await tx.society.findUniqueOrThrow({
      where: { id: ctx.societyId },
      select: { securityEnabled: true, securityVehicles: true },
    });
    if (!society.securityEnabled)
      throw new DomainError(403, "Security directory is disabled");
    if (search.trim().length < 2)
      throw new DomainError(400, "Enter at least two characters");
    // Explicit SELECT: no forbidden person/flat fields are loaded into this response path.
    const where: Prisma.OccupancyWhereInput = {
      societyId: ctx.societyId,
      ...currentRange(),
      OR: [
        { person: { name: { contains: search, mode: "insensitive" } } },
        { flat: { number: { contains: search, mode: "insensitive" } } },
        ...(society.securityVehicles
          ? [
              {
                flat: {
                  vehicles: {
                    some: {
                      registration: {
                        contains: search.toUpperCase().replace(/\s/g, ""),
                      },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    };
    const flatSelect = {
      number: true,
      block: { select: { name: true, phase: { select: { name: true } } } },
    } as const;
    const personSelect = { name: true, approvedPhone: true } as const;
    type Lookup = {
      name: string;
      approvedContact: string | null;
      phase: string;
      block: string;
      flat: string;
      vehicles?: {
        registration: string;
        type: string;
        color: string;
        parkingSlot: string | null;
      }[];
    };
    let result: Lookup[];
    if (society.securityVehicles) {
      const rows = await tx.occupancy.findMany({
        where,
        take: 25,
        select: {
          person: { select: personSelect },
          flat: {
            select: {
              ...flatSelect,
              vehicles: {
                select: {
                  registration: true,
                  type: true,
                  color: true,
                  allocation: {
                    select: {
                      startsOn: true,
                      endsOn: true,
                      slot: { select: { label: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const day = currentRange().startsOn.lte;
      result = rows.map((row) => ({
        name: row.person.name,
        approvedContact: row.person.approvedPhone,
        phase: row.flat.block.phase.name,
        block: row.flat.block.name,
        flat: row.flat.number,
        vehicles: row.flat.vehicles.map((car) => ({
          registration: car.registration,
          type: car.type,
          color: car.color,
          parkingSlot:
            car.allocation &&
            car.allocation.startsOn <= day &&
            (!car.allocation.endsOn || car.allocation.endsOn > day)
              ? car.allocation.slot.label
              : null,
        })),
      }));
    } else {
      const rows = await tx.occupancy.findMany({
        where,
        take: 25,
        select: {
          person: { select: personSelect },
          flat: { select: flatSelect },
        },
      });
      result = rows.map((row) => ({
        name: row.person.name,
        approvedContact: row.person.approvedPhone,
        phase: row.flat.block.phase.name,
        block: row.flat.block.name,
        flat: row.flat.number,
      }));
    }
    await audit(tx, ctx, "SECURITY_LOOKUP", "Society", ctx.societyId, {
      count: result.length,
    });
    return result;
  });
}
export async function profile(ctx: Context) {
  requireCapability(ctx, "profile");
  if (!ctx.personId) return null;
  return db.person.findUnique({
    where: { societyId_id: { societyId: ctx.societyId, id: ctx.personId } },
    select: { id: true, name: true, email: true, phone: true },
  });
}
export async function updateProfile(ctx: Context, input: unknown) {
  requireCapability(ctx, "profile");
  if (!ctx.personId) throw missing();
  const data = v.profileInput.parse(input);
  return db.$transaction(async (tx) => {
    const row = await tx.person.update({
      where: { societyId_id: { societyId: ctx.societyId, id: ctx.personId! } },
      data,
      select: { id: true, name: true, email: true, phone: true },
    });
    await audit(tx, ctx, "PROFILE_UPDATED", "Person", row.id);
    return row;
  });
}
// Mutation schemas reject extra fields. Composite FK checks are the final scope boundary.
export async function createMaster(
  ctx: Context,
  resource: string,
  input: unknown,
) {
  requireCapability(ctx, "master.write");
  return db.$transaction(async (tx) => {
    const societyId = ctx.societyId;
    let row: { id: string };
    switch (resource) {
      case "flats":
        row = await tx.flat.create({
          data: { societyId, ...v.flatInput.parse(input) },
        });
        break;
      case "persons":
        row = await tx.person.create({
          data: { societyId, ...v.personInput.parse(input) },
        });
        break;
      case "ownerships":
        row = await tx.ownership.create({
          data: { societyId, ...v.ownershipInput.parse(input) },
        });
        break;
      case "occupancies":
        row = await tx.occupancy.create({
          data: { societyId, ...v.occupancyInput.parse(input) },
        });
        break;
      case "slots":
        row = await tx.parkingSlot.create({
          data: { societyId, ...v.slotInput.parse(input) },
        });
        break;
      case "allocations":
        row = await tx.parkingAllocation.create({
          data: { societyId, ...v.allocationInput.parse(input) },
        });
        break;
      case "entitlements":
        row = await tx.parkingEntitlement.create({
          data: { societyId, ...v.entitlementInput.parse(input) },
        });
        break;
      case "vehicles":
        row = await tx.vehicle.create({
          data: { societyId, ...v.vehicleInput.parse(input) },
        });
        break;
      case "grants": {
        const data = v.grantInput.parse(input);
        const member = await tx.societyMembership.findUnique({
          where: { societyId_id: { societyId, id: data.membershipId } },
        });
        if (!member?.active || member.role !== "RESIDENT")
          throw new DomainError(400, "Choose an active resident membership");
        if (data.occupancyId) {
          const occupancy = await tx.occupancy.findUnique({
            where: { societyId_id: { societyId, id: data.occupancyId } },
          });
          if (
            !occupancy ||
            occupancy.flatId !== data.flatId ||
            occupancy.personId !== member.personId ||
            data.startsOn < occupancy.startsOn ||
            (occupancy.endsOn &&
              (!data.endsOn || data.endsOn > occupancy.endsOn))
          )
            throw new DomainError(
              400,
              "Grant must match resident occupancy and fit its interval",
            );
        }
        row = await tx.residentAccessGrant.create({
          data: { societyId, ...data },
        });
        break;
      }
      default:
        throw missing();
    }
    await audit(tx, ctx, "CREATED", resource, row.id);
    return { id: row.id };
  });
}
export async function createHierarchy(ctx: Context, input: unknown) {
  requireCapability(ctx, "master.write");
  const data = (await import("zod")).z
    .object({
      phase: (await import("zod")).z.string().trim().min(1).max(100),
      block: (await import("zod")).z.string().trim().min(1).max(100),
    })
    .strict()
    .parse(input);
  return db.$transaction(async (tx) => {
    const phase = await tx.phase.upsert({
      where: { societyId_name: { societyId: ctx.societyId, name: data.phase } },
      update: {},
      create: { societyId: ctx.societyId, name: data.phase },
    });
    const block = await tx.block.create({
      data: { societyId: ctx.societyId, phaseId: phase.id, name: data.block },
    });
    await audit(tx, ctx, "HIERARCHY_CREATED", "Block", block.id);
    return { id: block.id };
  });
}
export async function endOccupancy(
  ctx: Context,
  occupancyId: string,
  input: unknown,
) {
  requireCapability(ctx, "master.write");
  const data = (await import("zod")).z
    .object({ endsOn: v.date })
    .strict()
    .parse(input);
  return db.$transaction(async (tx) => {
    const occupancy = await tx.occupancy.findUnique({
      where: { societyId_id: { societyId: ctx.societyId, id: occupancyId } },
    });
    if (!occupancy) throw missing();
    if (occupancy.endsOn || data.endsOn <= occupancy.startsOn)
      throw new DomainError(400, "Occupancy is ended or end date is invalid");
    await tx.occupancy.update({
      where: { societyId_id: { societyId: ctx.societyId, id: occupancyId } },
      data: { endsOn: data.endsOn },
    });
    // Immediate revocation even when an admin enters a future move-out date; avoid delayed revocation races.
    await tx.residentAccessGrant.updateMany({
      where: { societyId: ctx.societyId, occupancyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit(tx, ctx, "OCCUPANCY_ENDED", "Occupancy", occupancyId);
    return { id: occupancyId };
  });
}
export async function endMaster(
  ctx: Context,
  resource: string,
  recordId: string,
  input: unknown,
) {
  requireCapability(ctx, "master.write");
  const data = (await import("zod")).z
    .object({ endsOn: v.date })
    .strict()
    .parse(input);
  return db.$transaction(async (tx) => {
    const where = { societyId_id: { societyId: ctx.societyId, id: recordId } };
    const row =
      resource === "ownerships"
        ? await tx.ownership.findUnique({ where })
        : resource === "allocations"
          ? await tx.parkingAllocation.findUnique({ where })
          : resource === "entitlements"
            ? await tx.parkingEntitlement.findUnique({ where })
            : null;
    if (!row) throw missing();
    if (row.endsOn || data.endsOn <= row.startsOn)
      throw new DomainError(400, "Invalid end date or already ended");
    if (resource === "ownerships") await tx.ownership.update({ where, data });
    if (resource === "allocations")
      await tx.parkingAllocation.update({ where, data });
    if (resource === "entitlements")
      await tx.parkingEntitlement.update({ where, data });
    await audit(tx, ctx, "ENDED", resource, recordId);
    return { id: recordId };
  });
}
export async function revokeGrant(ctx: Context, grantId: string) {
  requireCapability(ctx, "master.write");
  return db.$transaction(async (tx) => {
    const row = await tx.residentAccessGrant.update({
      where: { societyId_id: { societyId: ctx.societyId, id: grantId } },
      data: { revokedAt: new Date() },
      select: { id: true },
    });
    await audit(tx, ctx, "GRANT_REVOKED", "ResidentAccessGrant", row.id);
    return row;
  });
}
export async function importFlats(ctx: Context, input: unknown) {
  requireCapability(ctx, "master.write");
  const { rows, commit } = v.importInput.parse(
    typeof input === "object" && input !== null && "csv" in input
      ? parseFlatCsv(input)
      : input,
  );
  const keys = rows.map((row) => row.blockId + ":" + row.number);
  if (new Set(keys).size !== keys.length)
    throw new DomainError(400, "Duplicate flat numbers in import");
  return db.$transaction(async (tx) => {
    const blockIds = [...new Set(rows.map((r) => r.blockId))];
    if (
      (await tx.block.count({
        where: { societyId: ctx.societyId, id: { in: blockIds } },
      })) !== blockIds.length
    )
      throw new DomainError(400, "Import contains unknown blocks");
    const conflicts = await tx.flat.count({
      where: {
        societyId: ctx.societyId,
        OR: rows.map((row) => ({ blockId: row.blockId, number: row.number })),
      },
    });
    if (conflicts)
      throw new DomainError(409, "Import includes existing flat numbers");
    if (commit) {
      await tx.flat.createMany({
        data: rows.map((row) => ({ societyId: ctx.societyId, ...row })),
      });
      await audit(tx, ctx, "FLATS_IMPORTED", "Society", ctx.societyId, {
        count: rows.length,
      });
    }
    return { count: rows.length, committed: commit, rows };
  });
}
export async function changeMembership(ctx: Context, input: unknown) {
  requireCapability(ctx, "master.write");
  const data = v.membershipInput.parse(input);
  return db.$transaction(async (tx) => {
    // Serialize all society membership edits, including concurrent last-admin demotions.
    await tx.$queryRaw`SELECT id FROM "Society" WHERE id = ${ctx.societyId} FOR UPDATE`;
    const where = {
      societyId_id: { societyId: ctx.societyId, id: data.membershipId },
    };
    const member = await tx.societyMembership.findUnique({ where });
    if (!member) throw missing();
    if (
      member.role === "ADMIN" &&
      member.active &&
      (data.role !== "ADMIN" || !data.active) &&
      (await tx.societyMembership.count({
        where: { societyId: ctx.societyId, role: "ADMIN", active: true },
      })) <= 1
    )
      throw new DomainError(409, "Keep at least one active admin");
    await tx.societyMembership.update({
      where,
      data: { role: data.role, active: data.active },
    });
    await audit(tx, ctx, "MEMBERSHIP_CHANGED", "SocietyMembership", member.id, {
      role: data.role,
      active: data.active,
    });
    return { id: member.id };
  });
}
export async function changePolicy(ctx: Context, input: unknown) {
  requireCapability(ctx, "master.write");
  const data = v.policyInput.parse(input);
  return db.$transaction(async (tx) => {
    await tx.society.update({ where: { id: ctx.societyId }, data });
    await audit(
      tx,
      ctx,
      "SECURITY_POLICY_CHANGED",
      "Society",
      ctx.societyId,
      data,
    );
    return data;
  });
}
export async function auditHistory(ctx: Context) {
  requireCapability(ctx, "audit");
  return db.auditEvent.findMany({
    where: { societyId: ctx.societyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      actorId: true,
      metadata: true,
      createdAt: true,
    },
  });
}
