const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getPendingReports, markVerifiedByNgo, getRecentLogs } = require("../services/dbService");

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
  res.json({
    totalChecks: total,
    highRiskPct: total ? Math.round((highRisk / total) * 100) : 0,
  });
});

module.exports = router;
