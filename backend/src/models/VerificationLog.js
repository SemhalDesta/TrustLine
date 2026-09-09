const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS verification_logs (
  id            SERIAL PRIMARY KEY,
  phone_number  TEXT NOT NULL,
  risk_level    TEXT NOT NULL,
  reasoning     TEXT NOT NULL,
  signals       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_logs_phone_number
  ON verification_logs (phone_number);
`;

module.exports = { CREATE_TABLE_SQL };
