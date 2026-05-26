CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  photo TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guests_created_at
  ON guests (created_at);

CREATE TABLE IF NOT EXISTS uploads (
  upload_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  purpose TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  external_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'deleted')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  uploaded_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_uploads_status_created_at
  ON uploads (status, created_at);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('poster', 'program', 'work')),
  slug TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (section, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_items_section_active
  ON content_items (section, is_active, sort_order, updated_at);
