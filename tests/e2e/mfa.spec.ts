import { test, expect } from "@playwright/test";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
test("TOTP enrollment invalidates old sessions and sign-in requires the challenge", async ({
  playwright,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Authentication protocol only needs one viewport",
  );
  const fresh = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  const old = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  const password = process.env.SEED_PASSWORD!;
  const data = { email: "other-auditor@example.test", password };
  const headers = { Origin: "http://localhost:3000" };
  try {
    expect(
      (await fresh.post("/api/auth/sign-in/email", { data, headers })).status(),
    ).toBe(200);
    expect(
      (await old.post("/api/auth/sign-in/email", { data, headers })).status(),
    ).toBe(200);
    const enrollment = await fresh.post("/api/auth/two-factor/enable", {
      data: { password, method: "totp" },
      headers,
    });
    expect(enrollment.status()).toBe(200);
    const setup = await enrollment.json();
    const secret = new TextDecoder().decode(
      base32.decode(new URL(setup.totpURI).searchParams.get("secret")!),
    );
    const code = await createOTP(secret).totp();
    expect(
      (
        await fresh.post("/api/auth/two-factor/verify-totp", {
          data: { code },
          headers,
        })
      ).status(),
    ).toBe(200);
    expect((await fresh.get("/api/me")).status()).toBe(200);
    expect((await old.get("/api/me")).status()).toBe(401);
    await fresh.post("/api/auth/sign-out", { data: {}, headers });
    const challenge = await fresh.post("/api/auth/sign-in/email", {
      data,
      headers,
    });
    expect((await challenge.json()).twoFactorRedirect).toBe(true);
    expect((await fresh.get("/api/me")).status()).toBe(401);
    expect(
      (
        await fresh.post("/api/auth/two-factor/verify-totp", {
          data: { code: await createOTP(secret).totp() },
          headers,
        })
      ).status(),
    ).toBe(200);
    expect(
      (await fresh.get("/api/societies/other-society/audit")).status(),
    ).toBe(200);
  } finally {
    // Isolated synthetic identity; restore seed state for repeatable local browser tests.
    await fresh.post("/api/auth/two-factor/disable", {
      data: { password },
      headers,
    });
    await fresh.dispose();
    await old.dispose();
  }
});
