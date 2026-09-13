// PRIVACY: phone numbers are never stored in plaintext — see
// backend/src/utils/privacy.js. phone_number_hash is a deterministic,
// one-way lookup key; phone_number_encrypted is reversible (with the
// server's key) so NGO staff can still see and act on real numbers.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS scam_reports (
  phone_number_hash       TEXT PRIMARY KEY,
  phone_number_encrypted  TEXT NOT NULL,
  report_count            INTEGER NOT NULL DEFAULT 0,
  verified_by_ngo         BOOLEAN NOT NULL DEFAULT false,
  notes                   JSONB NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

module.exports = { CREATE_TABLE_SQL };
