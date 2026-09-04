const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { runVerification } = require("../agent");

const router = express.Router();

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

module.exports = router;
