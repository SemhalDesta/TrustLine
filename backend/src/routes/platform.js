const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { runVerification } = require("../agent");
const { getRecentLogs, isRecruiterVerified } = require("../services/dbService");

const router = express.Router();

/**
 * Usage summary + registered-numbers list for the platform dashboard.
 *
 * SCOPE NOTE: there's no data model yet linking a specific platform
 * account to "their" registered numbers — VerificationLog just records
 * every check globally. These routes derive real numbers from that shared
 * audit log rather than fabricating data, but until per-account ownership
 * exists, every platform account sees the same global activity. Revisit
 * once PlatformAccount <-> phone number ownership is modeled.
 */
router.get("/usage", requireAuth(["platform_account"]), async (req, res) => {
  const logs = await getRecentLogs(500);
  const distinctNumbers = new Set(logs.map((l) => l.phone_number || l.phoneNumber));
  const verifiedCount = logs.filter((l) => (l.risk_level || l.verdict?.riskLevel) === "LOW").length;

  res.json({
    registered: distinctNumbers.size,
    verified: verifiedCount,
    pending: 0, // no "pending verification" concept yet — every check completes synchronously
    checksThisMonth: logs.length,
    planLimit: 200, // static placeholder until billing/plans are modeled
  });
});

router.get("/numbers", requireAuth(["platform_account"]), async (req, res) => {
  const logs = await getRecentLogs(100);
  const seen = new Set();
  const numbers = [];

  for (const log of logs) {
    const phoneNumber = log.phone_number || log.phoneNumber;
    if (seen.has(phoneNumber)) continue; // keep only the most recent check per number
    seen.add(phoneNumber);

    const riskLevel = log.risk_level || log.verdict?.riskLevel;
    numbers.push({
      phoneNumber,
      status: riskLevel === "HIGH" ? "flagged" : "verified",
      lastChecked: log.created_at || log.at || null,
    });
  }

  res.json(numbers);
});

/** Bulk-verify a list of numbers — reuses the exact same contract as the worker flow. */
router.post("/bulk-verify", requireAuth(["platform_account"]), async (req, res) => {
  const { phoneNumbers } = req.body || {};
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return res.status(400).json({ error: "phoneNumbers must be a non-empty array" });
  }
  if (phoneNumbers.length > 50) {
    return res.status(400).json({ error: "Max 50 numbers per bulk request" });
  }

  const results = await Promise.all(
    phoneNumbers.map(async (number) => {
      try {
        return await runVerification(number);
      } catch (err) {
        return { phoneNumber: number, error: err.message };
      }
    })
  );

  res.json({ results });
});

router.get("/badge/:phoneNumber", requireAuth(["platform_account"]), async (req, res) => {
  const result = await runVerification(req.params.phoneNumber);
  const eligible = result.verdict.riskLevel === "LOW";
  res.json({
    phoneNumber: req.params.phoneNumber,
    eligible,
    badgeText: eligible ? "TrustLine Verified" : "Not Verified",
  });
});

/**
 * GET /api/platform/badge-image/:phoneNumber
 * PUBLIC, no auth — this is the actual image a recruiter embeds on their
 * job listing (<img src="...">), so it must be fetchable by anyone
 * browsing that listing, not gated behind a platform login.
 *
 * Tied to real recruiter registration status (isRecruiterVerified — see
 * routes/recruiter.js), not a fresh re-run of the worker-verification
 * agent, since "has this recruiter proved they own this number" is the
 * actual claim a badge should make.
 */
router.get("/badge-image/:phoneNumber", async (req, res) => {
  const verifiedAt = await isRecruiterVerified(req.params.phoneNumber);
  const verified = Boolean(verifiedAt);

  const fill = verified ? "#1FA398" : "#8a8f98";
  const label = verified ? "TrustLine Verified" : "Not Yet Verified";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="36" viewBox="0 0 180 36">
  <rect width="180" height="36" rx="6" fill="${fill}"/>
  <text x="90" y="23" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">${label}</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5 min — status can change if a recruiter registers
  res.send(svg);
});

module.exports = router;
