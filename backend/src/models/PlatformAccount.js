const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS platform_accounts (
  id             SERIAL PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('ngo_admin', 'platform_account')),
  organization   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

module.exports = { CREATE_TABLE_SQL };
