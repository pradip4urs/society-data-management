import { randomUUID, createHash } from "node:crypto";
import { db } from "./db";
import {
  flatScope,
  currentRange,
  requireCapability,
  type Context,
} from "./permissions";
import { missing, denied, DomainError } from "./errors";
import {
  detectMime,
  safeFilename,
  writeQuarantine,
  readDocument,
  promoteDocument,
} from "./storage";
import { scannerReady, scanBytes } from "./scanner";
const root = () => process.env.DOCUMENT_ROOT ?? ".local/documents";
export async function authorizeDocument(ctx: Context, id: string) {
  if (!["ADMIN", "RESIDENT"].includes(ctx.role)) throw denied();
  const row = await db.attachment.findFirst({
    where: {
      id,
      societyId: ctx.societyId,
      status: "CLEAN",
      flat: flatScope(ctx),
      ...(ctx.role === "RESIDENT"
        ? {
            residentVisible: true,
            audienceMembershipIds: { has: ctx.membershipId },
          }
        : {}),
    },
  });
  if (!row) throw missing();
  return row;
}
export async function uploadDocument(
  ctx: Context,
  flatId: string,
  file: File,
  residentVisible: boolean,
) {
  requireCapability(ctx, "master.write");
  if (!file.size || file.size > 10485760)
    throw new DomainError(413, "Document must be 1 byte to 10 MiB");
  if (
    !(await db.flat.findFirst({
      where: { id: flatId, societyId: ctx.societyId },
    }))
  )
    throw missing();
  try {
    await scannerReady();
  } catch {
    throw new DomainError(
      503,
      "Uploads are closed until scanning is available and current",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mimeType: string;
  try {
    mimeType = detectMime(bytes);
  } catch {
    throw new DomainError(400, "Only PDF, PNG and JPEG files are supported");
  }
  if (file.type !== mimeType)
    throw new DomainError(400, "Declared file type does not match its content");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Society" WHERE id=${ctx.societyId} FOR UPDATE`;
    const usage = await tx.attachment.aggregate({
      where: { societyId: ctx.societyId },
      _sum: { byteSize: true },
    });
    if ((usage._sum.byteSize ?? 0) + bytes.length > 1024 * 1024 * 1024)
      throw new DomainError(413, "Society document quota reached");
    const id = randomUUID();
    const audience = residentVisible
      ? await tx.residentAccessGrant.findMany({
          where: {
            societyId: ctx.societyId,
            flatId,
            revokedAt: null,
            ...currentRange(),
            membership: { active: true, role: "RESIDENT" },
            AND: [
              {
                OR: [
                  { occupancyId: null },
                  { occupancy: { is: currentRange() } },
                ],
              },
            ],
          },
          select: { membershipId: true },
        })
      : [];
    await writeQuarantine(root(), id, bytes);
    const row = await tx.attachment.create({
      data: {
        id,
        societyId: ctx.societyId,
        flatId,
        creatorId: ctx.userId,
        originalName: safeFilename(file.name),
        mimeType,
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        residentVisible,
        audienceMembershipIds: [
          ...new Set(audience.map((a) => a.membershipId)),
        ],
      },
    });
    await tx.auditEvent.create({
      data: {
        societyId: ctx.societyId,
        actorId: ctx.userId,
        action: "DOCUMENT_QUARANTINED",
        entityType: "Attachment",
        entityId: id,
      },
    });
    return { id: row.id, status: row.status };
  });
}
export async function listDocuments(ctx: Context, flatId: string) {
  if (!["ADMIN", "RESIDENT"].includes(ctx.role)) throw denied();
  if (!(await db.flat.findFirst({ where: { ...flatScope(ctx), id: flatId } })))
    throw missing();
  return db.attachment.findMany({
    where: {
      societyId: ctx.societyId,
      flatId,
      ...(ctx.role === "RESIDENT"
        ? {
            status: "CLEAN",
            residentVisible: true,
            audienceMembershipIds: { has: ctx.membershipId },
          }
        : {}),
    },
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      byteSize: true,
      status: true,
      createdAt: true,
      residentVisible: true,
    },
  });
}
export async function downloadDocument(ctx: Context, id: string) {
  const row = await authorizeDocument(ctx, id);
  const bytes = await readDocument(root(), row.id, "clean", row.sha256);
  await db.auditEvent.create({
    data: {
      societyId: ctx.societyId,
      actorId: ctx.userId,
      action: "DOCUMENT_DOWNLOADED",
      entityType: "Attachment",
      entityId: id,
    },
  });
  return { row, bytes };
}
export async function scanPending() {
  // PostgreSQL row locks serialize scanners; restart resumes quarantined rows.
  return db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; societyId: string; sha256: string }[]
      >`SELECT id,"societyId",sha256 FROM "Attachment" WHERE status='QUARANTINED' ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      const row = rows[0];
      if (!row) return false;
      let bytes: Buffer;
      try {
        bytes = await readDocument(root(), row.id, "quarantine", row.sha256);
      } catch {
        bytes = await readDocument(root(), row.id, "clean", row.sha256);
      } // crash after rename before commit
      const clean = await scanBytes(bytes);
      if (clean) {
        try {
          await promoteDocument(root(), row.id);
        } catch {
          await readDocument(root(), row.id, "clean", row.sha256);
        }
      }
      await tx.attachment.update({
        where: { id: row.id },
        data: { status: clean ? "CLEAN" : "REJECTED", scannedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          societyId: row.societyId,
          actorId: "scanner-worker",
          action: clean ? "DOCUMENT_CLEAN" : "DOCUMENT_REJECTED",
          entityType: "Attachment",
          entityId: row.id,
        },
      });
      return true;
    },
    { timeout: 30000 },
  );
}
