/**
 * dbService.js
 *
 * Scam-report lookups/writes + audit logging. Uses Postgres if DATABASE_URL
 * is configured (see config/db.js + models/*.js for schema), otherwise
 * falls back to an in-memory Map — so you can build and demo this today
 * without standing up a database first.
 *
 * NOTE: Track A's agent will eventually call lookupScamReport() too (as
 * their "dbCrossCheck" node) — that's fine, this module doesn't care who
 * calls it, it's just a shared service.
 */

const { pool, isConfigured } = require("../config/db");

const memoryStore = new Map();
const auditLog = [];

// Seed a known-bad number for demo purposes.
memoryStore.set("+920000000001", {
  reportCount: 12,
  verifiedByNgo: true,
  notes: ["Reported by 12 workers in the same recruitment cycle", "Flagged by IOM partner NGO"],
});

async function lookupScamReport(phoneNumber) {
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT report_count, verified_by_ngo, notes FROM scam_reports WHERE phone_number = $1`,
      [phoneNumber]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return { reportCount: row.report_count, verifiedByNgo: row.verified_by_ngo, notes: row.notes || [] };
  }
  return memoryStore.get(phoneNumber) || null;
}

async function submitWorkerReport(phoneNumber, reportDetails) {
  if (isConfigured) {
    await pool.query(
      `INSERT INTO scam_reports (phone_number, report_count, verified_by_ngo, notes)
       VALUES ($1, 1, false, $2)
       ON CONFLICT (phone_number)
       DO UPDATE SET report_count = scam_reports.report_count + 1,
                     notes = scam_reports.notes || $2`,
      [phoneNumber, JSON.stringify([reportDetails])]
    );
    return;
  }
  const existing = memoryStore.get(phoneNumber) || { reportCount: 0, verifiedByNgo: false, notes: [] };
  existing.reportCount += 1;
  existing.notes.push(reportDetails);
  memoryStore.set(phoneNumber, existing);
}

/** Every verdict gets logged — this is what gives NGO/government partners audit confidence. */
async function logVerdict(phoneNumber, verdict, signals) {
  if (isConfigured) {
    await pool.query(
      `INSERT INTO verification_logs (phone_number, risk_level, reasoning, signals, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [phoneNumber, verdict.riskLevel, verdict.reasoning, JSON.stringify(signals || {})]
    );
    return;
  }
  auditLog.push({ phoneNumber, verdict, signals, at: new Date().toISOString() });
}

async function getRecentLogs(limit = 50) {
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT phone_number, risk_level, reasoning, signals, created_at
       FROM verification_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  return auditLog.slice(-limit).reverse();
}

async function getPendingReports() {
  if (isConfigured) {
    const { rows } = await pool.query(
      `SELECT phone_number, report_count, notes FROM scam_reports WHERE verified_by_ngo = false`
    );
    return rows;
  }
  return [...memoryStore.entries()]
    .filter(([, v]) => !v.verifiedByNgo)
    .map(([phoneNumber, v]) => ({ phoneNumber, ...v }));
}

async function markVerifiedByNgo(phoneNumber) {
  if (isConfigured) {
    await pool.query(`UPDATE scam_reports SET verified_by_ngo = true WHERE phone_number = $1`, [phoneNumber]);
    return;
  }
  const existing = memoryStore.get(phoneNumber);
  if (existing) existing.verifiedByNgo = true;
}

module.exports = {
  lookupScamReport,
  submitWorkerReport,
  logVerdict,
  getRecentLogs,
  getPendingReports,
  markVerifiedByNgo,
};
