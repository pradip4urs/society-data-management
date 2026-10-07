import { createHash } from "node:crypto";
// Better Auth still owns secret generation, challenges and atomic code removal.
const digest = (code: string) =>
  createHash("sha256").update(code).digest("hex");
export function recoveryInput(code: unknown) {
  if (
    typeof code !== "string" ||
    !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{15}$/.test(code)
  )
    throw new Error("Invalid recovery code format");
  return digest(code);
}
export const hashedRecoveryStorage = {
  async encrypt(json: string) {
    const codes: string[] = JSON.parse(json);
    // Atomic consumption re-encodes the remaining hashes; don't hash them twice.
    return JSON.stringify(
      codes.map((code) => (/^[a-f0-9]{64}$/.test(code) ? code : digest(code))),
    );
  },
  async decrypt(json: string) {
    return json;
  },
};
