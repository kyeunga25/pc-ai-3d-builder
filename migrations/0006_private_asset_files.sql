PRAGMA foreign_keys = ON;

ALTER TABLE product_assets
ADD COLUMN source_object_key TEXT;

ALTER TABLE product_assets
ADD COLUMN source_content_type TEXT
  CHECK (
    source_content_type IS NULL
    OR source_content_type IN ('image/jpeg', 'image/png', 'image/webp')
  );

ALTER TABLE product_assets
ADD COLUMN source_size_bytes INTEGER
  CHECK (source_size_bytes IS NULL OR source_size_bytes > 0);

ALTER TABLE product_assets
ADD COLUMN source_sha256 TEXT
  CHECK (source_sha256 IS NULL OR length(source_sha256) = 64);

ALTER TABLE product_assets
ADD COLUMN model_object_key TEXT;

ALTER TABLE product_assets
ADD COLUMN model_content_type TEXT
  CHECK (
    model_content_type IS NULL
    OR model_content_type = 'model/gltf-binary'
  );

ALTER TABLE product_assets
ADD COLUMN model_size_bytes INTEGER
  CHECK (model_size_bytes IS NULL OR model_size_bytes > 0);

ALTER TABLE product_assets
ADD COLUMN model_sha256 TEXT
  CHECK (model_sha256 IS NULL OR length(model_sha256) = 64);

UPDATE rigstage_metadata
SET value = '6', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_phase';
