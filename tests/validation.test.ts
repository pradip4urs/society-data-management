import { describe, it, expect } from "vitest";
import {
  area,
  flatInput,
  occupancyInput,
  importInput,
  profileInput,
} from "@/server/validation";
import { requireCapability, type Context } from "@/server/permissions";
describe("input and capability boundary", () => {
  it("accepts precise areas and rejects floating/exponential/zero representations", () => {
    for (const valid of ["0.001", "1024.125", "999999999.999"])
      expect(area.safeParse(valid).success).toBe(true);
    for (const invalid of [
      "0",
      "0.000",
      "1e3",
      "-1",
      "10.0001",
      1.23,
      "Infinity",
    ])
      expect(area.safeParse(invalid).success).toBe(false);
  });
  it("rejects impossible dates and reversed history", () => {
    expect(
      occupancyInput.safeParse({
        flatId: "f",
        personId: "p",
        kind: "TENANT",
        startsOn: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      occupancyInput.safeParse({
        flatId: "f",
        personId: "p",
        kind: "TENANT",
        startsOn: "2026-01-02",
        endsOn: "2026-01-01",
      }).success,
    ).toBe(false);
  });
  it("rejects mass assignment and oversized imports", () => {
    expect(
      profileInput.safeParse({ name: "Demo", role: "ADMIN" }).success,
    ).toBe(false);
    const flat = {
      blockId: "b",
      number: "101",
      floor: 1,
      flatType: "2 BHK",
      areaSqFt: "1000",
      billableAreaSqFt: "1000",
      areaBasis: "CARPET",
      classification: "VACANT",
    };
    expect(
      flatInput.safeParse({ ...flat, societyId: "attacker" }).success,
    ).toBe(false);
    expect(
      importInput.safeParse({ rows: Array(501).fill(flat), commit: true })
        .success,
    ).toBe(false);
  });
  it("denies unassigned capabilities", () => {
    for (const role of ["CASHIER", "RESIDENT", "SECURITY", "AUDITOR"] as const)
      expect(() =>
        requireCapability({ role } as Context, "master.write"),
      ).toThrow("Access denied");
    expect(() =>
      requireCapability({ role: "SECURITY" } as Context, "directory"),
    ).toThrow();
  });
});
