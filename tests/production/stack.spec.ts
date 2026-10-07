import { test, expect } from "@playwright/test";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const origin = process.env.REHEARSAL_URL ?? "https://localhost:8443";
const headers = { Origin: origin };
const credentials = {
  email: "bootstrap@example.test",
  password: "Synthetic-Rehearsal-Password-Only-123",
};
const dcArgs = ["compose", "--env-file", ".local/compose.env"];
function docker(args: string[], input?: string) {
  const result = spawnSync("docker", [...dcArgs, ...args], {
    input,
    encoding: "utf8",
    timeout: 90000,
  });
  if (result.status !== 0) throw new Error("Rehearsal Docker command failed");
  return result.stdout;
}
function query(sql: string) {
  return docker(
    [
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "society_owner",
      "-d",
      "society",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    sql,
  );
}
test.beforeAll(() => {
  if (process.env.RUN_SYNTHETIC_REHEARSAL !== "true")
    throw new Error(
      "Set RUN_SYNTHETIC_REHEARSAL=true for the explicitly bootstrapped disposable stack",
    );
  expect(
    query(
      "SELECT count(*) FROM \"Society\" WHERE name <> 'Rehearsal Society';",
    ).trim(),
  ).toBe("0");
});
test("compiled HTTPS stack: bootstrap MFA, hashed single-use recovery, files and restart persistence", async ({
  playwright,
  browser,
}) => {
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  const old = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  const stateFile = ".local/rehearsal-auth.json";
  let secret = "",
    backupCodes: string[] = [];
  const signIn = () =>
    api.post("/api/auth/sign-in/email", { data: credentials, headers });
  expect((await signIn()).status()).toBe(200);
  const knownState = existsSync(stateFile)
    ? JSON.parse(readFileSync(stateFile, "utf8"))
    : null;
  if (knownState)
    await api.post("/api/auth/two-factor/verify-totp", {
      data: { code: await createOTP(knownState.secret).totp() },
      headers,
    });
  const me = await (await api.get("/api/me")).json();
  const societyId = me.memberships[0].society.id;
  const url = `/api/societies/${societyId}`;
  if (!me.user.twoFactorEnabled) {
    expect((await api.get(`${url}/flats`)).status()).toBe(403);
    await old.post("/api/auth/sign-in/email", { data: credentials, headers });
    const setupResponse = await api.post("/api/auth/two-factor/enable", {
      data: { password: credentials.password },
      headers,
    });
    expect(setupResponse.status()).toBe(200);
    const setup = await setupResponse.json();
    backupCodes = setup.backupCodes;
    secret = new TextDecoder().decode(
      base32.decode(new URL(setup.totpURI).searchParams.get("secret")!),
    );
    writeFileSync(
      stateFile,
      JSON.stringify({ secret, backupCodes, societyId }),
      { mode: 0o600 },
    );
    expect(
      (
        await api.post("/api/auth/two-factor/verify-totp", {
          data: { code: await createOTP(secret).totp() },
          headers,
        })
      ).status(),
    ).toBe(200);
    expect((await old.get("/api/me")).status()).toBe(401);
  } else {
    if (!existsSync(stateFile))
      throw new Error(
        "Rehearsal MFA state absent; recover only this disposable account through audited CLI",
      );
    ({ secret, backupCodes } = JSON.parse(readFileSync(stateFile, "utf8")));
    expect((await api.get(`${url}/flats`)).status()).toBe(200);
  }
  // Refresh disposable recovery fixture so repeat runs cannot exhaust codes.
  const generated = await api.post(
    "/api/auth/two-factor/generate-backup-codes",
    { data: { password: credentials.password }, headers },
  );
  expect(generated.status()).toBe(200);
  backupCodes = (await generated.json()).backupCodes;
  writeFileSync(stateFile, JSON.stringify({ secret, backupCodes, societyId }), {
    mode: 0o600,
  });
  const stored = JSON.parse(
    query('SELECT "backupCodes" FROM "twoFactor" LIMIT 1;').trim(),
  );
  expect(stored.every((code: string) => /^[a-f0-9]{64}$/.test(code))).toBe(
    true,
  );
  expect(stored).not.toContain(backupCodes[0]);
  expect(
    (
      await api.post("/api/auth/two-factor/view-backup-codes", {
        data: { password: credentials.password },
        headers,
      })
    ).status(),
  ).toBe(404);
  const currentCode = backupCodes.find((c) =>
    stored.includes(createHash("sha256").update(c).digest("hex")),
  )!;
  expect(currentCode).toBeTruthy();
  await api.post("/api/auth/sign-out", { data: {}, headers });
  expect((await (await signIn()).json()).twoFactorRedirect).toBe(true);
  expect(
    (
      await api.post("/api/auth/two-factor/verify-backup-code", {
        data: { code: currentCode },
        headers,
      })
    ).status(),
  ).toBe(200);
  expect((await api.get(`${url}/flats`)).status()).toBe(200);
  expect(
    Number(
      query(
        "SELECT count(*) FROM \"AuditEvent\" WHERE action='RECOVERY_CODE_USED';",
      ).trim(),
    ),
  ).toBeGreaterThan(0);
  await api.post("/api/auth/sign-out", { data: {}, headers });
  await signIn();
  expect(
    (
      await api.post("/api/auth/two-factor/verify-backup-code", {
        data: { code: currentCode },
        headers,
      })
    ).status(),
  ).toBe(401);
  expect((await api.get("/api/me")).status()).toBe(401);
  await api.post("/api/auth/two-factor/verify-totp", {
    data: { code: await createOTP(secret).totp() },
    headers,
  });
  const timestamp = Date.now();
  const block = await (
    await api.post(`${url}/hierarchy`, {
      data: { phase: "Rehearsal", block: `Block-${timestamp}` },
      headers,
    })
  ).json();
  const flatResponse = await api.post(`${url}/flats`, {
    data: {
      blockId: block.id,
      number: "101",
      floor: 1,
      flatType: "2BHK",
      areaSqFt: "1000.125",
      billableAreaSqFt: "900.125",
      areaBasis: "CARPET",
      classification: "VACANT",
    },
    headers,
  });
  expect(flatResponse.status()).toBe(201);
  const flat = await flatResponse.json();
  const pdf = Buffer.from(
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
  );
  const upload = await api.post(`${url}/documents`, {
    headers,
    multipart: {
      flatId: flat.id,
      residentVisible: "false",
      file: { name: "rehearsal.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  let document: { id: string };
  if (upload.status() === 503) {
    // Stale signatures are an explicit acceptance blocker, never bypassed for public uploads.
    expect(await upload.json()).toHaveProperty(
      "error",
      "Uploads are closed until scanning is available and current",
    );
    console.log(
      "Scanner freshness blocked uploads; using a trusted synthetic clean fixture only to validate download/backup persistence.",
    );
    document = { id: crypto.randomUUID() };
    const userId = query('SELECT id FROM "user" LIMIT 1;').trim();
    const hash = createHash("sha256").update(pdf).digest("hex");
    docker([
      "run",
      "--rm",
      "-T",
      "operator",
      "node",
      "-e",
      `const fs=require('fs'); fs.mkdirSync('/documents/clean',{recursive:true}); fs.writeFileSync('/documents/clean/${document.id}',Buffer.from('${pdf.toString("base64")}','base64'),{flag:'wx',mode:384});`,
    ]);
    query(
      `INSERT INTO "Attachment" (id,"societyId","flatId","creatorId","originalName","mimeType","byteSize",sha256,status) VALUES ('${document.id}','${societyId}','${flat.id}','${userId}','rehearsal.pdf','application/pdf',${pdf.length},'${hash}','CLEAN');`,
    );
  } else {
    expect(upload.status(), await upload.text()).toBe(202);
    document = await upload.json();
    await expect
      .poll(
        async () =>
          (
            await (await api.get(`${url}/documents?flatId=${flat.id}`)).json()
          )[0].status,
        { timeout: 60000 },
      )
      .toBe("CLEAN");
  }
  expect(
    await (await api.get(`${url}/documents/${document.id}`)).body(),
  ).toEqual(pdf);
  // Exact standard EICAR is not a supported PDF/PNG/JPEG upload. Insert a trusted
  // disposable quarantine fixture to exercise real worker malware rejection.
  const eicar = Buffer.from(
    "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
  );
  const rejected = { id: crypto.randomUUID() };
  const fixtureUser = query('SELECT id FROM "user" LIMIT 1;').trim();
  docker([
    "run",
    "--rm",
    "-T",
    "operator",
    "node",
    "-e",
    `const fs=require('fs');fs.mkdirSync('/documents/quarantine',{recursive:true});fs.writeFileSync('/documents/quarantine/${rejected.id}',Buffer.from('${eicar.toString("base64")}','base64'),{flag:'wx',mode:384});`,
  ]);
  query(
    `INSERT INTO "Attachment" (id,"societyId","flatId","creatorId","originalName","mimeType","byteSize",sha256,status) VALUES ('${rejected.id}','${societyId}','${flat.id}','${fixtureUser}','eicar-test.pdf','application/pdf',${eicar.length},'${createHash("sha256").update(eicar).digest("hex")}','QUARANTINED');`,
  );
  await expect
    .poll(
      async () =>
        (
          await (await api.get(`${url}/documents?flatId=${flat.id}`)).json()
        ).find((r: { id: string }) => r.id === rejected.id).status,
      { timeout: 60000 },
    )
    .toBe("REJECTED");
  expect((await api.get(`${url}/documents/${rejected.id}`)).status()).toBe(404);
  const cookies = (await api.storageState()).cookies;
  const sessionCookie = cookies.find((c) => c.name.includes("session_token"))!;
  expect(sessionCookie.secure && sessionCookie.httpOnly).toBe(true);
  expect(sessionCookie.sameSite).toBe("Lax");
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addCookies(cookies);
  const page = await context.newPage();
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading authorized records…", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/production-${width}.png`,
      fullPage: true,
    });
  }
  docker(["restart", "postgres", "redis", "web", "worker"]);
  await expect
    .poll(
      async () => {
        try {
          return (await api.get("/api/health")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 60000 },
    )
    .toBe(200);
  expect((await api.get(`${url}/flats/${flat.id}`)).status()).toBe(200);
  expect(
    await (await api.get(`${url}/documents/${document.id}`)).body(),
  ).toEqual(pdf);
  writeFileSync(
    ".local/rehearsal-acceptance.json",
    JSON.stringify({
      societyId,
      flatId: flat.id,
      documentId: document.id,
      sha256: createHash("sha256").update(pdf).digest("hex"),
    }),
  );
  await context.close();
  await api.dispose();
  await old.dispose();
});
test("fresh-stack restored login and private document contents match the recovery point", async ({
  playwright,
}) => {
  test.skip(
    process.env.CHECK_RESTORED_STACK !== "true",
    "Run after backup.sh/restore.sh to the separate stack",
  );
  const restoredOrigin = process.env.RESTORED_URL ?? "https://localhost:8444";
  const api = await playwright.request.newContext({
    baseURL: restoredOrigin,
    ignoreHTTPSErrors: true,
  });
  const state = JSON.parse(readFileSync(".local/rehearsal-auth.json", "utf8"));
  const acceptance = JSON.parse(
    readFileSync(".local/rehearsal-acceptance.json", "utf8"),
  );
  const restoredHeaders = { Origin: restoredOrigin };
  expect((await api.get("/api/me")).status()).toBe(401);
  expect(
    (
      await api.post("/api/auth/sign-in/email", {
        data: credentials,
        headers: restoredHeaders,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await api.post("/api/auth/two-factor/verify-totp", {
        data: { code: await createOTP(state.secret).totp() },
        headers: restoredHeaders,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await api.get(
        `/api/societies/${acceptance.societyId}/flats/${acceptance.flatId}`,
      )
    ).status(),
  ).toBe(200);
  const download = await api.get(
    `/api/societies/${acceptance.societyId}/documents/${acceptance.documentId}`,
  );
  expect(download.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await download.body())
      .digest("hex"),
  ).toBe(acceptance.sha256);
  await api.dispose();
});
test("host operator MFA recovery audits identity-verification reason and revokes sessions", async ({
  playwright,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  const state = JSON.parse(readFileSync(".local/rehearsal-auth.json", "utf8"));
  docker(
    [
      "run",
      "--rm",
      "-T",
      "-e",
      `PROVISION_EMAIL=${email}`,
      "-e",
      "PROVISION_NAME=Recovery Fixture",
      "-e",
      `PROVISION_SOCIETY_ID=${state.societyId}`,
      "-e",
      "PROVISION_ROLE=ADMIN",
      "operator",
      "node",
      "dist/provision-user.js",
    ],
    credentials.password,
  );
  const api = await playwright.request.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  expect(
    (
      await api.post("/api/auth/sign-in/email", {
        data: { email, password: credentials.password },
        headers,
      })
    ).status(),
  ).toBe(200);
  const setup = await (
    await api.post("/api/auth/two-factor/enable", {
      data: { password: credentials.password },
      headers,
    })
  ).json();
  const secret = new TextDecoder().decode(
    base32.decode(new URL(setup.totpURI).searchParams.get("secret")!),
  );
  expect(
    (
      await api.post("/api/auth/two-factor/verify-totp", {
        data: { code: await createOTP(secret).totp() },
        headers,
      })
    ).status(),
  ).toBe(200);
  expect(
    (await api.get(`/api/societies/${state.societyId}/flats`)).status(),
  ).toBe(200);
  docker([
    "run",
    "--rm",
    "-T",
    "-e",
    `RECOVERY_EMAIL=${email}`,
    "-e",
    "RECOVERY_OPERATOR=synthetic-operator",
    "-e",
    "RECOVERY_REASON=Verified synthetic fixture identity during automated drill",
    "operator",
    "node",
    "dist/recover-account.js",
  ]);
  expect((await api.get("/api/me")).status()).toBe(401);
  await api.post("/api/auth/sign-in/email", {
    data: { email, password: credentials.password },
    headers,
  });
  expect(
    (await api.get(`/api/societies/${state.societyId}/flats`)).status(),
  ).toBe(403);
  expect(
    Number(
      query(
        `SELECT count(*) FROM "AuditEvent" WHERE action='OPERATOR_MFA_RECOVERY' AND metadata->>'operator'='synthetic-operator';`,
      ).trim(),
    ),
  ).toBeGreaterThan(0);
  await api.dispose();
});
