CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Flat" ADD CONSTRAINT flat_area_positive CHECK ("areaSqFt" > 0 AND "billableAreaSqFt" > 0);
ALTER TABLE "Ownership" ADD CONSTRAINT ownership_dates CHECK ("endsOn" IS NULL OR "endsOn" > "startsOn");
ALTER TABLE "Occupancy" ADD CONSTRAINT occupancy_dates CHECK ("endsOn" IS NULL OR "endsOn" > "startsOn");
ALTER TABLE "ResidentAccessGrant" ADD CONSTRAINT grant_dates CHECK ("endsOn" IS NULL OR "endsOn" > "startsOn");
ALTER TABLE "ParkingEntitlement" ADD CONSTRAINT entitlement_dates CHECK ("endsOn" IS NULL OR "endsOn" > "startsOn");
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT allocation_dates CHECK ("endsOn" IS NULL OR "endsOn" > "startsOn");
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT no_exclusive_parking_overlap
  EXCLUDE USING gist ("societyId" WITH =, "slotId" WITH =, daterange("startsOn", "endsOn", '[)') WITH &&);

CREATE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit evidence is append-only';
END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION audit_append_only();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION audit_append_only();

-- A grant cannot attach another person's occupancy or an interval outside it.
CREATE FUNCTION validate_occupancy_grant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE occupied "Occupancy"%ROWTYPE; member "SocietyMembership"%ROWTYPE;
BEGIN
  IF NEW."occupancyId" IS NOT NULL THEN
    SELECT * INTO occupied FROM "Occupancy" WHERE "societyId" = NEW."societyId" AND id = NEW."occupancyId" FOR SHARE;
    SELECT * INTO member FROM "SocietyMembership" WHERE "societyId" = NEW."societyId" AND id = NEW."membershipId";
    IF occupied.id IS NULL OR member.id IS NULL OR occupied."personId" IS DISTINCT FROM member."personId"
       OR occupied."flatId" <> NEW."flatId" OR NEW."startsOn" < occupied."startsOn"
       OR (occupied."endsOn" IS NOT NULL AND (NEW."endsOn" IS NULL OR NEW."endsOn" > occupied."endsOn")) THEN
      RAISE EXCEPTION 'Grant must match person, flat and occupancy interval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER grant_occupancy_check BEFORE INSERT OR UPDATE OF "occupancyId", "membershipId", "flatId", "startsOn", "endsOn" ON "ResidentAccessGrant" FOR EACH ROW EXECUTE FUNCTION validate_occupancy_grant();

-- Defense in depth: DB updates ending occupancy revoke access even outside services.
CREATE FUNCTION revoke_occupancy_grants() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."endsOn" IS DISTINCT FROM OLD."endsOn" AND NEW."endsOn" IS NOT NULL THEN
    UPDATE "ResidentAccessGrant" SET "revokedAt" = COALESCE("revokedAt", now()) WHERE "societyId" = NEW."societyId" AND "occupancyId" = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER occupancy_revoke AFTER UPDATE OF "endsOn" ON "Occupancy" FOR EACH ROW EXECUTE FUNCTION revoke_occupancy_grants();
