ALTER TABLE workspace_memberships
ADD COLUMN record_version INTEGER NOT NULL DEFAULT 0
  CHECK (record_version >= 0);

CREATE TRIGGER prevent_last_active_workspace_owner_update
BEFORE UPDATE OF role, status ON workspace_memberships
WHEN OLD.role = 'owner'
  AND OLD.status = 'active'
  AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_memberships AS other
    WHERE other.workspace_id = OLD.workspace_id
      AND other.user_id <> OLD.user_id
      AND other.role = 'owner'
      AND other.status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'WORKSPACE_LAST_OWNER');
END;

CREATE TRIGGER prevent_last_active_workspace_owner_delete
BEFORE DELETE ON workspace_memberships
WHEN OLD.role = 'owner'
  AND OLD.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_memberships AS other
    WHERE other.workspace_id = OLD.workspace_id
      AND other.user_id <> OLD.user_id
      AND other.role = 'owner'
      AND other.status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'WORKSPACE_LAST_OWNER');
END;

UPDATE rigstage_metadata
SET value = '16', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
