DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='society_app') THEN
  REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent" FROM society_app;
  REVOKE DELETE ON "Attachment", "Ownership", "Occupancy", "ResidentAccessGrant" FROM society_app;
 END IF;
END $$;
