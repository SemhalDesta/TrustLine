// backend/src/models/VerifiedRecruiter.js
//
// Tracks recruiters who have completed real Number Verification against
// their own phone via the three-legged OAuth flow (routes/recruiter.js).
// This is the record that lets TrustLine say "this recruiter proved they
// own this number" — distinct from ScamReport (worker complaints) and
// VerificationLog (worker lookup audit trail).

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS verified_recruiters (
  phone_number_hash       TEXT PRIMARY KEY,
  phone_number_encrypted  TEXT NOT NULL,
  verified_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

module.exports = { CREATE_TABLE_SQL };
