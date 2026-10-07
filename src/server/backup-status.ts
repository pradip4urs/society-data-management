import { readFile } from "node:fs/promises";
import { z } from "zod";
import { requireCapability, type Context } from "./permissions";
export async function backupStatus(ctx: Context) {
  requireCapability(ctx, "master.write");
  try {
    const raw = await readFile(
      /*turbopackIgnore: true*/ process.env.BACKUP_STATUS_FILE ??
        ".local/backup-status/status.json",
      "utf8",
    );
    if (raw.length > 2048) throw new Error("Invalid status");
    return z
      .object({
        state: z.enum(["complete", "failed"]),
        updatedAt: z.iso.datetime(),
        archive: z
          .string()
          .regex(/^society-[a-zA-Z0-9.-]+\.tar\.age$/)
          .optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
  } catch {
    return { state: "unknown" as const };
  }
}
