const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS scam_reports (
  phone_number   TEXT PRIMARY KEY,
  report_count   INTEGER NOT NULL DEFAULT 0,
  verified_by_ngo BOOLEAN NOT NULL DEFAULT false,
  notes          JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

module.exports = { CREATE_TABLE_SQL };
