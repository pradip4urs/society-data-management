import { afterAll, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  documentPath,
  safeFilename,
  detectMime,
  writeQuarantine,
  readDocument,
  promoteDocument,
} from "@/server/storage";
import { parseFlatCsv } from "@/server/csv-import";
import { hashedRecoveryStorage, recoveryInput } from "@/server/recovery-codes";
const root = await mkdtemp(join(tmpdir(), "society-storage-"));
afterAll(() => rm(root, { recursive: true, force: true }));
it("keeps immutable files private until promotion and verifies integrity", async () => {
  const id = randomUUID(),
    bytes = Buffer.from("%PDF-1.7\nsynthetic");
  const hash = createHash("sha256").update(bytes).digest("hex");
  await writeQuarantine(root, id, bytes);
  await expect(writeQuarantine(root, id, bytes)).rejects.toThrow();
  await expect(readDocument(root, id, "clean", hash)).rejects.toThrow();
  await promoteDocument(root, id);
  expect(await readDocument(root, id, "clean", hash)).toEqual(bytes);
  await expect(readDocument(root, id, "clean", "bad")).rejects.toThrow(
    "integrity",
  );
  expect(() => documentPath(root, "../etc/passwd", "clean")).toThrow();
  expect(detectMime(bytes)).toBe("application/pdf");
  expect(() => detectMime(Buffer.from("<script>"))).toThrow();
  expect(safeFilename('a/\r\n";b.pdf')).toBe("a_____b.pdf");
});
it("hashes recovery storage and preserves remaining hashed codes on atomic consumption", async () => {
  const raw = "ABCDE-ABCDEFGHIJKLMNO";
  const hash = recoveryInput(raw);
  const stored = await hashedRecoveryStorage.encrypt(JSON.stringify([raw]));
  expect(JSON.parse(stored)).toEqual([hash]);
  expect(stored).not.toContain(raw);
  expect(await hashedRecoveryStorage.encrypt(stored)).toBe(stored);
  expect(() => recoveryInput(hash)).toThrow();
});
it("parses quoted CSV while rejecting malformed headers, numeric floors and unknown fields", () => {
  const header =
    "blockId,number,floor,flatType,areaSqFt,billableAreaSqFt,areaBasis,classification\n";
  const csv = header + 'block,"A,101",1,2BHK,1000.125,900,carpet,VACANT';
  expect(parseFlatCsv({ csv, commit: false }).rows[0]).toMatchObject({
    number: "A,101",
    floor: 1,
    areaSqFt: "1000.125",
  });
  expect(() =>
    parseFlatCsv({ csv: csv.replace(",1,", ",NaN,"), commit: false }),
  ).toThrow();
  expect(() =>
    parseFlatCsv({ csv: "blockId,blockId\na,b", commit: false }),
  ).toThrow();
  expect(() => parseFlatCsv({ csv, commit: false, sql: "DROP" })).toThrow();
});
