ALTER TABLE "Attachment" ADD COLUMN "audienceMembershipIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE OR REPLACE FUNCTION attachment_content_immutable() RETURNS trigger AS $$
BEGIN
  IF ROW(NEW."societyId", NEW."flatId", NEW."creatorId", NEW.sha256, NEW."byteSize", NEW."mimeType", NEW."audienceMembershipIds")
    IS DISTINCT FROM ROW(OLD."societyId", OLD."flatId", OLD."creatorId", OLD.sha256, OLD."byteSize", OLD."mimeType", OLD."audienceMembershipIds") THEN
    RAISE EXCEPTION 'Document content and audience are immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
