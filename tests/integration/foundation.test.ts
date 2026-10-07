import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getContext, type Context } from "@/server/permissions";
import * as s from "@/server/services";
import { randomUUID } from "node:crypto";
let admin: Context,
  residentA: Context,
  residentB: Context,
  cashier: Context,
  security: Context;
let flatA: string, flatB: string, otherFlat: string, occupancyA: string;
beforeAll(async () => {
  [admin, residentA, residentB, cashier, security] = await Promise.all(
    ["admin", "resident-a", "resident-b", "cashier", "security"].map((u) =>
      getContext(u, "demo-society"),
    ),
  );
  flatA = (await s.listFlats(residentA)).rows[0].id;
  flatB = (await s.listFlats(residentB)).rows[0].id;
  otherFlat = (
    await db.flat.findFirstOrThrow({ where: { societyId: "other-society" } })
  ).id;
  occupancyA = (
    await db.occupancy.findFirstOrThrow({
      where: { societyId: "demo-society", flatId: flatA },
    })
  ).id;
});
afterAll(async () => {
  await db.$disconnect();
});
describe("real PostgreSQL authorization and invariants", () => {
  it("privileged roles require MFA without the development bypass", async () => {
    const previous = process.env.DEV_MFA_BYPASS;
    process.env.DEV_MFA_BYPASS = "false";
    try {
      await expect(getContext("admin", "demo-society")).rejects.toThrow(
        "MFA_REQUIRED",
      );
      await expect(
        getContext("resident-a", "demo-society"),
      ).resolves.toHaveProperty("role", "RESIDENT");
    } finally {
      process.env.DEV_MFA_BYPASS = previous;
    }
  });
  it("rejects society ID tampering and resident flat ID tampering", async () => {
    await expect(getContext("resident-a", "other-society")).rejects.toThrow(
      "Access denied",
    );
    await expect(s.getFlat(residentA, flatB)).rejects.toThrow(
      "Record not found",
    );
    await expect(s.getFlat(admin, otherFlat)).rejects.toThrow(
      "Record not found",
    );
    expect((await s.listFlats(residentA)).total).toBe(1);
    const dto = await s.getFlat(residentA, flatA);
    expect(dto).not.toHaveProperty("ownerships");
    expect(dto).not.toHaveProperty("occupancies");
    expect(dto).not.toHaveProperty("internalRemarks");
  });
  it("cashier cannot change area, ownership or roles", async () => {
    await expect(s.createMaster(cashier, "flats", {})).rejects.toThrow(
      "Access denied",
    );
    await expect(s.createMaster(cashier, "ownerships", {})).rejects.toThrow(
      "Access denied",
    );
    await expect(s.changeMembership(cashier, {})).rejects.toThrow(
      "Access denied",
    );
    const directory = await s.listFlats(cashier);
    expect(directory.total).toBe(8);
    expect(directory.rows[0]).not.toHaveProperty("internalRemarks");
  });
  it("enforces cross-society foreign keys through joins", async () => {
    const block = await db.block.findFirstOrThrow({
      where: { societyId: "other-society" },
    });
    await expect(
      db.flat.create({
        data: {
          societyId: "demo-society",
          blockId: block.id,
          number: "x",
          floor: 1,
          flatType: "TEST",
          areaSqFt: "1",
          billableAreaSqFt: "1",
          areaBasis: "TEST",
        },
      }),
    ).rejects.toThrow();
    const person = await db.person.findFirstOrThrow({
      where: { societyId: "other-society" },
    });
    await expect(
      db.ownership.create({
        data: {
          societyId: "demo-society",
          flatId: flatA,
          personId: person.id,
          startsOn: new Date("2020-01-01Z"),
        },
      }),
    ).rejects.toThrow();
    const slot = await db.parkingSlot.findFirstOrThrow({
      where: { societyId: "other-society" },
    });
    await expect(
      db.parkingAllocation.create({
        data: {
          societyId: "demo-society",
          slotId: slot.id,
          flatId: flatA,
          type: "OWNED",
          startsOn: new Date("2020-01-01Z"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.vehicle.create({
        data: {
          societyId: "demo-society",
          flatId: otherFlat,
          registration: "INVALID",
          type: "CAR",
          color: "Blue",
        },
      }),
    ).rejects.toThrow();
  });
  it("security projection has exactly approved keys and disabling takes immediate effect", async () => {
    await expect(s.securityLookup(security, "Alpha")).rejects.toThrow(
      "disabled",
    );
    await s.changePolicy(admin, {
      securityEnabled: true,
      securityVehicles: false,
    });
    const basic = await s.securityLookup(security, "Alpha");
    expect(Object.keys(basic[0]).sort()).toEqual([
      "approvedContact",
      "block",
      "flat",
      "name",
      "phase",
    ]);
    await s.changePolicy(admin, {
      securityEnabled: true,
      securityVehicles: true,
    });
    const extended = await s.securityLookup(security, "Alpha");
    expect(Object.keys(extended[0]).sort()).toEqual([
      "approvedContact",
      "block",
      "flat",
      "name",
      "phase",
      "vehicles",
    ]);
    expect(Object.keys(extended[0].vehicles![0]).sort()).toEqual([
      "color",
      "parkingSlot",
      "registration",
      "type",
    ]);
    expect(JSON.stringify(extended)).not.toMatch(
      /email|internal|areaSqFt|ownership|personId|societyId|startsOn|endsOn/,
    );
    await s.changePolicy(admin, {
      securityEnabled: false,
      securityVehicles: false,
    });
    await expect(s.securityLookup(security, "Alpha")).rejects.toThrow(
      "disabled",
    );
  });
  it("audit evidence rejects update, delete and truncate", async () => {
    const row = await db.auditEvent.findFirstOrThrow();
    await expect(
      db.auditEvent.update({
        where: { id: row.id },
        data: { action: "TAMPER" },
      }),
    ).rejects.toThrow();
    await expect(
      db.auditEvent.delete({ where: { id: row.id } }),
    ).rejects.toThrow();
    await expect(
      db.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"'),
    ).rejects.toThrow();
  });
  it("preserves exact decimal area and DB rejects nonpositive area", async () => {
    expect((await s.getFlat(admin, flatA)).areaSqFt.toString()).toBe(
      "1024.125",
    );
    await expect(
      db.flat.update({ where: { id: flatA }, data: { areaSqFt: "0" } }),
    ).rejects.toThrow();
  });
  it("parking exclusion defeats simultaneous conflicting allocations and accepts adjacent intervals", async () => {
    const slot = await db.parkingSlot.create({
      data: {
        societyId: "demo-society",
        label: "CONCURRENT-TEST",
        location: "Test",
        type: "CAR",
      },
    });
    const data = {
      slotId: slot.id,
      flatId: flatA,
      type: "RENTED",
      startsOn: "2026-01-01",
      endsOn: "2026-02-01",
    };
    const results = await Promise.allSettled([
      s.createMaster(admin, "allocations", data),
      s.createMaster(admin, "allocations", { ...data, flatId: flatB }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await expect(
      s.createMaster(admin, "allocations", {
        ...data,
        startsOn: "2026-02-01",
        endsOn: "2026-03-01",
      }),
    ).resolves.toHaveProperty("id");
    expect(
      await db.parkingAllocation.count({ where: { slotId: slot.id } }),
    ).toBe(2);
  });
  it("failed import rolls back all rows and audit", async () => {
    const blockId = (await db.flat.findUniqueOrThrow({ where: { id: flatA } }))
      .blockId;
    const row = {
      blockId,
      number: "IMPORT-NEW",
      floor: 1,
      flatType: "TEST",
      areaSqFt: "1",
      billableAreaSqFt: "1",
      areaBasis: "CARPET",
      classification: "VACANT",
    };
    const count = await db.auditEvent.count();
    await expect(
      s.importFlats(admin, {
        rows: [row, { ...row, number: "101" }],
        commit: true,
      }),
    ).rejects.toThrow("existing");
    expect(await db.flat.count({ where: { number: "IMPORT-NEW" } })).toBe(0);
    expect(await db.auditEvent.count()).toBe(count);
    const preview = await s.importFlats(admin, { rows: [row], commit: false });
    expect(preview.committed).toBe(false);
    expect(await db.flat.count({ where: { number: "IMPORT-NEW" } })).toBe(0);
  });
  it("last active admin cannot be demoted and disabled memberships stop immediately", async () => {
    await expect(
      s.changeMembership(admin, {
        membershipId: admin.membershipId,
        role: "CASHIER",
        active: true,
      }),
    ).rejects.toThrow("active admin");
    await s.changeMembership(admin, {
      membershipId: cashier.membershipId,
      role: "CASHIER",
      active: false,
    });
    await expect(getContext("cashier", "demo-society")).rejects.toThrow(
      "Access denied",
    );
    await s.changeMembership(admin, {
      membershipId: cashier.membershipId,
      role: "CASHIER",
      active: true,
    });
  });
  it("new occupants receive no implicit grant and move-out revokes while preserving history", async () => {
    const person = await db.person.create({
      data: { societyId: "demo-society", name: "Fictional Newcomer" },
    });
    await s.createMaster(admin, "occupancies", {
      flatId: flatA,
      personId: person.id,
      startsOn: "2026-01-01",
      kind: "TENANT",
    });
    expect(
      await db.residentAccessGrant.count({
        where: {
          societyId: "demo-society",
          membershipId: residentB.membershipId,
          flatId: flatA,
        },
      }),
    ).toBe(0);
    await s.endOccupancy(admin, occupancyA, { endsOn: "2026-10-08" });
    expect((await s.listFlats(residentA)).total).toBe(0);
    await expect(s.getFlat(residentA, flatA)).rejects.toThrow(
      "Record not found",
    );
    expect(await db.ownership.count({ where: { flatId: flatA } })).toBe(1);
    expect(
      (await db.occupancy.findUniqueOrThrow({ where: { id: occupancyA } }))
        .endsOn,
    ).not.toBeNull();
    expect(
      (
        await db.residentAccessGrant.findFirstOrThrow({
          where: { occupancyId: occupancyA },
        })
      ).revokedAt,
    ).not.toBeNull();
    await expect(
      db.residentAccessGrant.create({
        data: {
          id: randomUUID(),
          societyId: "demo-society",
          membershipId: residentB.membershipId,
          flatId: flatA,
          occupancyId: occupancyA,
          startsOn: new Date("2020-01-01Z"),
        },
      }),
    ).rejects.toThrow();
  });
});
