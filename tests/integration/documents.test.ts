import { afterAll, expect, it } from "vitest";
import { db } from "@/server/db";
import { getContext } from "@/server/permissions";
import {
  authorizeDocument,
  listDocuments,
  uploadDocument,
} from "@/server/documents";
import {
  bootstrapAdmin,
  bootstrapStatus,
  InstallationAlreadyInitialized,
} from "@/server/bootstrap";
import { randomUUID } from "node:crypto";
afterAll(() => db.$disconnect());
it("denies quarantined/private/cross-flat documents and prevents access inheritance or revocation", async () => {
  const admin = await getContext("admin", "demo-society");
  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      name: "Document Test",
      email: `${userId}@example.test`,
    },
  });
  const membership = await db.societyMembership.create({
    data: { societyId: "demo-society", userId, role: "RESIDENT" },
  });
  const resident = await getContext(userId, "demo-society");
  const otherUserId = randomUUID();
  await db.user.create({
    data: {
      id: otherUserId,
      name: "Other Document Test",
      email: `${otherUserId}@example.test`,
    },
  });
  await db.societyMembership.create({
    data: { societyId: "demo-society", userId: otherUserId, role: "RESIDENT" },
  });
  const stranger = await getContext(otherUserId, "demo-society");
  const flat = await db.flat.findFirstOrThrow({
    where: { societyId: "demo-society" },
  });
  const grant = await db.residentAccessGrant.create({
    data: {
      societyId: "demo-society",
      membershipId: membership.id,
      flatId: flat.id,
      startsOn: new Date("2020-01-01"),
    },
  });
  const id = randomUUID();
  await db.attachment.create({
    data: {
      id,
      societyId: admin.societyId,
      flatId: grant.flatId,
      creatorId: admin.userId,
      originalName: "test.pdf",
      mimeType: "application/pdf",
      byteSize: 20,
      sha256: "0".repeat(64),
      residentVisible: true,
      audienceMembershipIds: [resident.membershipId],
    },
  });
  await expect(authorizeDocument(resident, id)).rejects.toThrow(
    "Record not found",
  );
  await db.attachment.update({ where: { id }, data: { status: "CLEAN" } });
  expect(await authorizeDocument(resident, id)).toHaveProperty("id", id);
  await expect(authorizeDocument(stranger, id)).rejects.toThrow();
  const cashier = await getContext("cashier", "demo-society");
  await expect(listDocuments(cashier, grant.flatId)).rejects.toThrow(
    "Access denied",
  );
  await expect(
    db.attachment.update({ where: { id }, data: { sha256: "1".repeat(64) } }),
  ).rejects.toThrow();
  await expect(
    db.attachment.update({
      where: { id },
      data: { audienceMembershipIds: [stranger.membershipId] },
    }),
  ).rejects.toThrow();
  const newGrant = await db.residentAccessGrant.create({
    data: {
      societyId: admin.societyId,
      membershipId: stranger.membershipId,
      flatId: grant.flatId,
      startsOn: new Date("2020-01-01"),
    },
  });
  await expect(authorizeDocument(stranger, id)).rejects.toThrow();
  await db.residentAccessGrant.update({
    where: { id: grant.id },
    data: { revokedAt: new Date() },
  });
  await expect(authorizeDocument(resident, id)).rejects.toThrow();
  await db.residentAccessGrant.update({
    where: { id: grant.id },
    data: { revokedAt: null },
  });
  await db.residentAccessGrant.update({
    where: { id: newGrant.id },
    data: { revokedAt: new Date() },
  });
});
it("fails closed when the real scanner connection is unavailable", async () => {
  const admin = await getContext("admin", "demo-society");
  const flat = await db.flat.findFirstOrThrow({
    where: { societyId: admin.societyId },
  });
  process.env.CLAMAV_HOST = "127.0.0.1";
  process.env.CLAMAV_PORT = "1";
  await expect(
    uploadDocument(
      admin,
      flat.id,
      new File(["%PDF-1.7"], "test.pdf", { type: "application/pdf" }),
      true,
    ),
  ).rejects.toThrow("Uploads are closed");
});
it("refuses bootstrap in a populated database without adding users", async () => {
  const before = await db.user.count();
  expect(await bootstrapStatus()).toEqual({ initialized: true });
  await expect(
    bootstrapAdmin({
      name: "Operator",
      societyName: "Example",
      email: "new@example.test",
      password: "Synthetic-Long-Password-123",
    }),
  ).rejects.toBeInstanceOf(InstallationAlreadyInitialized);
  expect(await db.user.count()).toBe(before);
});
