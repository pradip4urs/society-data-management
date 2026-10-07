ALTER TABLE "Vehicle" ADD COLUMN "make" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vehicle" ADD COLUMN "model" TEXT NOT NULL DEFAULT '';
CREATE TYPE "ScanStatus" AS ENUM ('QUARANTINED', 'CLEAN', 'REJECTED');
CREATE TABLE "Attachment" (
 "id" TEXT PRIMARY KEY, "societyId" TEXT NOT NULL, "flatId" TEXT NOT NULL,
 "creatorId" TEXT NOT NULL, "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "byteSize" INTEGER NOT NULL CHECK ("byteSize" > 0 AND "byteSize" <= 10485760),
 "sha256" TEXT NOT NULL, "status" "ScanStatus" NOT NULL DEFAULT 'QUARANTINED',
 "residentVisible" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "scannedAt" TIMESTAMP(3),
 CONSTRAINT "Attachment_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"(id),
 CONSTRAINT "Attachment_societyId_flatId_fkey" FOREIGN KEY ("societyId","flatId") REFERENCES "Flat"("societyId",id)
);
CREATE UNIQUE INDEX "Attachment_societyId_id_key" ON "Attachment"("societyId",id);
CREATE INDEX "Attachment_status_createdAt_idx" ON "Attachment"(status,"createdAt");
CREATE FUNCTION attachment_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."societyId",NEW."flatId",NEW."creatorId",NEW."sha256",NEW."byteSize",NEW."mimeType") IS DISTINCT FROM ROW(OLD."societyId",OLD."flatId",OLD."creatorId",OLD."sha256",OLD."byteSize",OLD."mimeType") THEN
  RAISE EXCEPTION 'Attachment content versions are immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER attachment_immutable BEFORE UPDATE ON "Attachment" FOR EACH ROW EXECUTE FUNCTION attachment_content_immutable();
