import { test, expect, type APIRequestContext } from "@playwright/test";
const society = "demo-society";
async function login(api: APIRequestContext, user: string) {
  const result = await api.post("/api/auth/sign-in/email", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      email: `${user}@example.test`,
      password: process.env.SEED_PASSWORD,
    },
  });
  expect(result.status()).toBe(200);
}
test("API denies ID tampering, cashier mutations and forged origins", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  const resident = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  const cashier = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  try {
    await login(admin, "admin");
    await login(resident, "resident-a");
    await login(cashier, "cashier");
    const own = (
      await (await resident.get(`/api/societies/${society}/flats`)).json()
    ).rows[0].id;
    const rows = (
      await (await admin.get(`/api/societies/${society}/flats`)).json()
    ).rows;
    const foreign = rows.find((r: { id: string }) => r.id !== own).id;
    expect(
      (
        await resident.get(`/api/societies/${society}/flats/${foreign}`)
      ).status(),
    ).toBe(404);
    for (const path of [
      "flats",
      "hierarchy",
      "admin-data",
      "parking",
      "profile",
      "audit",
      "security?q=Alpha",
    ])
      expect(
        (await admin.get(`/api/societies/other-society/${path}`)).status(),
      ).toBe(403);
    for (const path of [
      "flats",
      "persons",
      "ownerships",
      "occupancies",
      "grants",
      "slots",
      "allocations",
      "entitlements",
      "vehicles",
      "import",
      "hierarchy",
    ]) {
      expect(
        (
          await admin.post(`/api/societies/other-society/${path}`, {
            headers: { Origin: "http://localhost:3000" },
            data: {},
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await cashier.post(`/api/societies/${society}/${path}`, {
            headers: { Origin: "http://localhost:3000" },
            data: {},
          })
        ).status(),
      ).toBe(403);
    }
    for (const path of [
      "profile",
      "policy",
      "memberships",
      "occupancies/unknown",
      "ownerships/unknown",
      "allocations/unknown",
      "entitlements/unknown",
      "grants/unknown",
      `flats/${own}`,
    ])
      expect(
        (
          await admin.patch(`/api/societies/other-society/${path}`, {
            headers: { Origin: "http://localhost:3000" },
            data: {},
          })
        ).status(),
      ).toBe(403);
    expect(
      (
        await cashier.patch(`/api/societies/${society}/flats/${own}`, {
          headers: { Origin: "http://localhost:3000" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.post(`/api/societies/${society}/persons`, {
          headers: { Origin: "https://attacker.example" },
          data: { name: "Forgery" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await resident.get(
          `/api/societies/${society}/flats?personId=someone-else`,
        )
      ).status(),
    ).toBe(400);
    expect(
      (await resident.get(`/api/societies/${society}/audit`)).status(),
    ).toBe(403);
  } finally {
    await admin.dispose();
    await resident.dispose();
    await cashier.dispose();
  }
});
test("security API is minimal and policy changes affect an existing session", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  const security = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  await login(admin, "admin");
  await login(security, "security");
  const policy = (securityEnabled: boolean, securityVehicles: boolean) =>
    admin.patch(`/api/societies/${society}/policy`, {
      headers: { Origin: "http://localhost:3000" },
      data: { securityEnabled, securityVehicles },
    });
  try {
    expect((await policy(true, false)).status()).toBe(200);
    const basic = await security.get(
      `/api/societies/${society}/security?q=Alpha`,
    );
    expect(basic.status()).toBe(200);
    expect(basic.headers()["cache-control"]).toContain("no-store");
    expect(Object.keys((await basic.json())[0]).sort()).toEqual([
      "approvedContact",
      "block",
      "flat",
      "name",
      "phase",
    ]);
    expect(
      (await security.get(`/api/societies/${society}/flats`)).status(),
    ).toBe(403);
    expect((await policy(false, false)).status()).toBe(200);
    expect(
      (
        await security.get(`/api/societies/${society}/security?q=Alpha`)
      ).status(),
    ).toBe(403);
  } finally {
    await policy(false, false);
    await admin.dispose();
    await security.dispose();
  }
});
