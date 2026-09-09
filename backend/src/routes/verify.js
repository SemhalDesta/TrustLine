const express = require("express");

// THE SEAM: swap this single import for Track A's real module when ready.
// e.g. change to: const { runVerification } = require("../agent/graph-wrapper");
// as long as the new module exports a `runVerification` matching the
// contract documented in agent/index.js, nothing below needs to change.
const { runVerification } = require("../agent");

const { logVerdict, submitWorkerReport } = require("../services/dbService");
const { verifyRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();

/**
 * POST /api/verify
 * Body: { phoneNumber: string, claimedLocation?: object }
 */
router.post("/", verifyRateLimiter, async (req, res) => {
  const { phoneNumber, claimedLocation } = req.body || {};

  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber is required" });
  }

  try {
    const result = await runVerification(phoneNumber, claimedLocation || null);

    // Fire-and-forget audit log — don't block the response on it.
    logVerdict(result.phoneNumber, result.verdict, { escalated: result.escalated }).catch((err) =>
      console.error("[audit-log] failed", err)
    );

    return res.json(result);
  } catch (err) {
    // Invalid input (e.g. bad phone number) throws from runVerification —
    // treat as a 400, not a 500.
    if (err.message && err.message.toLowerCase().includes("invalid")) {
      return res.status(400).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error("[verify] agent execution failed", err);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

/**
 * POST /api/verify/report
 * Lets a worker flag a number that scammed them.
 */
router.post("/report", async (req, res) => {
  const { phoneNumber, details } = req.body || {};
  if (!phoneNumber || !details) {
    return res.status(400).json({ error: "phoneNumber and details are required" });
  }
  await submitWorkerReport(phoneNumber, details);
  return res.status(201).json({ status: "received" });
});

module.exports = router;
