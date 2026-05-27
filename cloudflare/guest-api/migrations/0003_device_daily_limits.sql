CREATE TABLE IF NOT EXISTS checkin_device_daily_limits (
  device_hash TEXT NOT NULL,
  day_key TEXT NOT NULL,
  count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (device_hash, day_key)
);

CREATE INDEX IF NOT EXISTS idx_checkin_device_daily_limits_day_key
  ON checkin_device_daily_limits (day_key);
