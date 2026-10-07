import { resolve, join, relative, isAbsolute } from "node:path";
import { mkdir, open, lstat, readFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
const idPattern = /^[a-f0-9-]{36}$/i;
export function documentPath(
  root: string,
  id: string,
  zone: "quarantine" | "clean",
) {
  if (!idPattern.test(id)) throw new Error("Invalid internal document ID");
  const base = resolve(root);
  const path = join(base, zone, id);
  const rel = relative(base, path);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Invalid document path");
  return path;
}
export async function initStorage(root: string) {
  for (const zone of ["quarantine", "clean"] as const) {
    const path = join(/*turbopackIgnore: true*/ resolve(root), zone);
    await mkdir(path, { recursive: true, mode: 0o700 });
    if (
      !(await lstat(path)).isDirectory() ||
      (await lstat(path)).isSymbolicLink()
    )
      throw new Error("Unsafe storage directory");
  }
}
export async function writeQuarantine(
  root: string,
  id: string,
  bytes: Uint8Array,
) {
  await initStorage(root);
  const file = await open(documentPath(root, id, "quarantine"), "wx", 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
}
export async function readDocument(
  root: string,
  id: string,
  zone: "clean" | "quarantine",
  hash: string,
) {
  const path = documentPath(root, id, zone);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Unsafe document object");
  const bytes = await readFile(path);
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw new Error("Document integrity failure");
  return bytes;
}
export async function promoteDocument(root: string, id: string) {
  await rename(
    documentPath(root, id, "quarantine"),
    documentPath(root, id, "clean"),
  );
}
export function safeFilename(name: string) {
  return name.replace(/[\x00-\x1f\x7f/\\";]/g, "_").slice(0, 120) || "document";
}
export function detectMime(bytes: Uint8Array): string {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  throw new Error("Only PDF, PNG and JPEG content is accepted");
}
