const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getPendingReports, markVerifiedByNgo, getRecentLogs } = require("../services/dbService");
const { resolveCorridor } = require("../utils/corridor");

const router = express.Router();

router.get("/reports/pending", requireAuth(["ngo_admin"]), async (req, res) => {
  const pending = await getPendingReports();
  res.json({ pending });
});

router.post("/reports/:phoneNumber/verify", requireAuth(["ngo_admin"]), async (req, res) => {
  await markVerifiedByNgo(req.params.phoneNumber);
  res.json({ status: "verified", phoneNumber: req.params.phoneNumber });
});

router.get("/logs", requireAuth(["ngo_admin"]), async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const logs = await getRecentLogs(limit);
  res.json({ logs });
});

router.get("/analytics/summary", requireAuth(["ngo_admin"]), async (req, res) => {
  const logs = await getRecentLogs(500);
  const total = logs.length;
  const highRisk = logs.filter((l) => (l.risk_level || l.verdict?.riskLevel) === "HIGH").length;

  // Real corridor breakdown: origin country of each checked number,
  // derived from its calling code (see utils/corridor.js) — grouped and
  // counted from the same log data every other stat on this page uses,
  // not a separate/fabricated dataset. Sorted highest-volume first.
  const corridorCounts = new Map();
  for (const l of logs) {
    const phoneNumber = l.phone_number || l.phoneNumber;
    const corridor = resolveCorridor(phoneNumber);
    corridorCounts.set(corridor, (corridorCounts.get(corridor) || 0) + 1);
  }
  const byCorridor = [...corridorCounts.entries()]
    .map(([corridor, count]) => ({ corridor, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    totalChecks: total,
    highRiskPct: total ? Math.round((highRisk / total) * 100) : 0,
    byCorridor,
  });
});

/**
 * GET /api/ngo/export
 * Real CSV export of the audit log, for the policy/reporting work this
 * dashboard's copy already promised. Auth-gated the same as every other
 * NGO route — this is decrypted, identifiable phone-number data, not
 * something to expose publicly. Streams the same data source as /logs
 * (getRecentLogs), just formatted as CSV instead of JSON.
 */
router.get("/export", requireAuth(["ngo_admin"]), async (req, res) => {
  const logs = await getRecentLogs(1000);

  const escapeCsv = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ["Phone Number", "Corridor", "Risk Level", "Reasoning", "Checked At"];
  const rows = logs.map((l) => {
    const phoneNumber = l.phone_number || l.phoneNumber;
    const riskLevel = l.risk_level || l.verdict?.riskLevel || "";
    const reasoning = l.reasoning || l.verdict?.reasoning || "";
    const checkedAt = l.created_at || l.at || "";
    return [phoneNumber, resolveCorridor(phoneNumber), riskLevel, reasoning, checkedAt]
      .map(escapeCsv)
      .join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="trustline-verification-log-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

module.exports = router;
