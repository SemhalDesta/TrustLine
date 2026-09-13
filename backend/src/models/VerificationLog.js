// PRIVACY: see backend/src/utils/privacy.js — phone numbers are hashed
// for lookup and encrypted for storage, never stored in plaintext.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS verification_logs (
  id                      SERIAL PRIMARY KEY,
  phone_number_hash       TEXT NOT NULL,
  phone_number_encrypted  TEXT NOT NULL,
  risk_level              TEXT NOT NULL,
  reasoning               TEXT NOT NULL,
  signals                 JSONB NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_logs_phone_number_hash
  ON verification_logs (phone_number_hash);
`;

module.exports = { CREATE_TABLE_SQL };
