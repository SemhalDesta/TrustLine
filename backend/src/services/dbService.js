/**
 * dbService.js
 *
 * Scam-report lookups/writes + audit logging. Uses Postgres if DATABASE_URL
 * is configured (see config/db.js + models/*.js for schema), otherwise
 * falls back to an in-memory Map — so you can build and demo this today
 * without standing up a database first.
 *
 * PRIVACY HARDENING: phone numbers are never stored in plaintext. Each
 * record is keyed by a one-way hash (hashPhoneNumber) for lookups, with
 * the actual number stored separately, encrypted (encryptPhoneNumber) so
 * it can still be decrypted for legitimate display to NGO/platform staff.
 * See utils/privacy.js for why a one-way hash alone isn't enough — NGO
 * staff need to actually see the number to act on a report.
 *
 * RETENTION: verification logs older than DATA_RETENTION_DAYS are purged
 * automatically on write, so audit data doesn't accumulate indefinitely.
 *
 * NOTE: Track A's agent will eventually call lookupScamReport() too (as
 * their "dbCrossCheck" node) — that's fine, this module doesn't care who
 * calls it, it's just a shared service. The public function signatures
 * below are unchanged from before this hardening pass — callers always
 * pass/receive plain phone number strings; hashing/encryption happens
 * internally.
 */

const { pool, isConfigured } = require("../config/db");
const { hashPhoneNumber, encryptPhoneNumber, decryptPhoneNumber } = require("../utils/privacy");

const RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS || 90);

// Keyed by hash(phoneNumber) — the value objects carry the phone number
// only in encrypted form (field: phoneNumberEncrypted).
const memoryStore = new Map();
const auditLog = []; // each entry: { phoneNumberEncrypted, verdict, signals, at }
const verifiedRecruiters = new Map(); // hash -> { phoneNumberEncrypted, verifiedAt }

// Seed a known-bad number for demo purposes (same seeded scenario as
// before, just stored the hardened way now).
{
  const seedNumber = "+920000000001";
  memoryStore.set(hashPhoneNumber(seedNumber), {
    phoneNumberEncrypted: encryptPhoneNumber(seedNumber),
    reportCount: 12,
    verifiedByNgo: true,
    notes: ["Reported by 12 workers in the same recruitment cycle", "Flagged by IOM partner NGO"],
  });
}

function purgeExpiredLogs() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  while (auditLog.length && new Date(auditLog[0].at).getTime() < cutoff) {
    auditLog.shift();
  }
}

async function lookupScamReport(phoneNumber) {
  const key = hashPhoneNumber(phoneNumber);
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT report_count, verified_by_ngo, notes FROM scam_reports WHERE phone_number_hash = $1`,
      [key]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return { reportCount: row.report_count, verifiedByNgo: row.verified_by_ngo, notes: row.notes || [] };
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  return { reportCount: entry.reportCount, verifiedByNgo: entry.verifiedByNgo, notes: entry.notes };
}

async function submitWorkerReport(phoneNumber, reportDetails) {
  const key = hashPhoneNumber(phoneNumber);
  if (isConfigured) {
    await pool.query(
      `INSERT INTO scam_reports (phone_number_hash, phone_number_encrypted, report_count, verified_by_ngo, notes)
       VALUES ($1, $2, 1, false, $3)
       ON CONFLICT (phone_number_hash)
       DO UPDATE SET report_count = scam_reports.report_count + 1,
                     notes = scam_reports.notes || $3`,
      [key, encryptPhoneNumber(phoneNumber), JSON.stringify([reportDetails])]
    );
    return;
  }
  const existing = memoryStore.get(key) || {
    phoneNumberEncrypted: encryptPhoneNumber(phoneNumber),
    reportCount: 0,
    verifiedByNgo: false,
    notes: [],
  };
  existing.reportCount += 1;
  existing.notes.push(reportDetails);
  memoryStore.set(key, existing);
}

/** Every verdict gets logged — this is what gives NGO/government partners audit confidence. */
async function logVerdict(phoneNumber, verdict, signals) {
  purgeExpiredLogs();
  if (isConfigured) {
    await pool.query(
      `INSERT INTO verification_logs (phone_number_hash, phone_number_encrypted, risk_level, reasoning, signals, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [hashPhoneNumber(phoneNumber), encryptPhoneNumber(phoneNumber), verdict.riskLevel, verdict.reasoning, JSON.stringify(signals || {})]
    );
    return;
  }
  auditLog.push({
    phoneNumberEncrypted: encryptPhoneNumber(phoneNumber),
    verdict,
    signals,
    at: new Date().toISOString(),
  });
}

async function getRecentLogs(limit = 50) {
  purgeExpiredLogs();
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT phone_number_encrypted, risk_level, reasoning, signals, created_at
       FROM verification_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      phoneNumber: decryptPhoneNumber(r.phone_number_encrypted),
      risk_level: r.risk_level,
      reasoning: r.reasoning,
      signals: r.signals,
      created_at: r.created_at,
    }));
  }
  return auditLog
    .slice(-limit)
    .reverse()
    .map((entry) => ({
      phoneNumber: decryptPhoneNumber(entry.phoneNumberEncrypted),
      verdict: entry.verdict,
      signals: entry.signals,
      at: entry.at,
    }));
}

async function getPendingReports() {
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT phone_number_encrypted, report_count, notes FROM scam_reports WHERE verified_by_ngo = false`
    );
    return rows.map((r) => ({
      phoneNumber: decryptPhoneNumber(r.phone_number_encrypted),
      reportCount: r.report_count,
      notes: r.notes,
    }));
  }
  return [...memoryStore.entries()]
    .filter(([, v]) => !v.verifiedByNgo)
    .map(([, v]) => ({
      phoneNumber: decryptPhoneNumber(v.phoneNumberEncrypted),
      reportCount: v.reportCount,
      notes: v.notes,
    }));
}

async function markVerifiedByNgo(phoneNumber) {
  const key = hashPhoneNumber(phoneNumber);
  if (isConfigured) {
    await pool.query(`UPDATE scam_reports SET verified_by_ngo = true WHERE phone_number_hash = $1`, [key]);
    return;
  }
  const existing = memoryStore.get(key);
  if (existing) existing.verifiedByNgo = true;
}

/**
 * Returns the count of NGO-verified reports — used to surface the
 * "the agent gets smarter as more reports come in" feedback loop as a
 * real, public, non-sensitive statistic (no phone numbers exposed).
 */
async function getVerifiedReportCount() {
  if (isConfigured) {
    const { rows } = await pool.query(`SELECT COUNT(*) FROM scam_reports WHERE verified_by_ngo = true`);
    return Number(rows[0].count);
  }
  return [...memoryStore.values()].filter((v) => v.verifiedByNgo).length;
}

/**
 * Records that a recruiter completed real Number Verification against
 * their own phone (see routes/recruiter.js). Called only after a
 * successful three-legged OAuth verification — never on a client-
 * credentials-only check.
 */
async function markRecruiterVerified(phoneNumber) {
  const key = hashPhoneNumber(phoneNumber);
  const verifiedAt = new Date().toISOString();
  if (isConfigured) {
    await pool.query(
      `INSERT INTO verified_recruiters (phone_number_hash, phone_number_encrypted, verified_at) VALUES ($1, $2, $3)
       ON CONFLICT (phone_number_hash) DO UPDATE SET verified_at = $3`,
      [key, encryptPhoneNumber(phoneNumber), verifiedAt]
    );
    return;
  }
  verifiedRecruiters.set(key, { phoneNumberEncrypted: encryptPhoneNumber(phoneNumber), verifiedAt });
}

/** Returns the verification timestamp if this recruiter has registered, or null. */
async function isRecruiterVerified(phoneNumber) {
  const key = hashPhoneNumber(phoneNumber);
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT verified_at FROM verified_recruiters WHERE phone_number_hash = $1`,
      [key]
    );
    return rows.length ? rows[0].verified_at : null;
  }
  const entry = verifiedRecruiters.get(key);
  return entry ? entry.verifiedAt : null;
}

module.exports = {
  lookupScamReport,
  submitWorkerReport,
  logVerdict,
  getRecentLogs,
  getPendingReports,
  markVerifiedByNgo,
  markRecruiterVerified,
  isRecruiterVerified,
  getVerifiedReportCount,
};
