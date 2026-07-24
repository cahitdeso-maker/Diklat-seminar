-- Add composite indexes to optimize certificate number generation queries
-- These indexes prevent full table scans on MAX() queries and filter conditions

-- Index for "per_tahun" reset mode: filter by year
CREATE INDEX IF NOT EXISTS idx_cert_settings_year 
  ON certificate_number_settings (year, is_config, is_deleted, certificate_number);

-- Index for "per_seminar" reset mode: filter by seminar_id
CREATE INDEX IF NOT EXISTS idx_cert_settings_seminar 
  ON certificate_number_settings (seminar_id, is_config, is_deleted, certificate_number);

-- Index for "never" reset mode: global MAX
CREATE INDEX IF NOT EXISTS idx_cert_settings_global 
  ON certificate_number_settings (is_config, is_deleted, certificate_number);

-- Index for registrations table: optimize validation queries
CREATE INDEX IF NOT EXISTS idx_registrations_cert_number 
  ON registrations (seminar_id, certificate_number, is_deleted);

-- Index for registrations: optimize lookup by id with certificate fields
CREATE INDEX IF NOT EXISTS idx_registrations_cert_lookup 
  ON registrations (id, certificate_number, certificate_code, is_deleted);