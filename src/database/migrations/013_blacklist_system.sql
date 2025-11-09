-- Reconcile blacklist schema to match current security module (entity-based blacklist)
DROP TABLE IF EXISTS blacklist CASCADE;

CREATE TABLE blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'guild', 'role')),
  entity_id VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  added_by VARCHAR(20) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_entity ON blacklist(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(active);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'update_blacklist_updated_at'
    ) THEN
      CREATE TRIGGER update_blacklist_updated_at
        BEFORE UPDATE ON blacklist
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END;
$$;
