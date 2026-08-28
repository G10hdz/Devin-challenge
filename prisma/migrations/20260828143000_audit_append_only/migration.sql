-- Append-only enforcement for AuditLog at the database level.
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only: updates are not allowed');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only: deletes are not allowed');
END;
