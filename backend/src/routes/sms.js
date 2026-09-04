const express = require("express");
const { runVerification } = require("../agent");
const { sendSms, formatVerdictForSms } = require("../services/smsService");

const router = express.Router();

/**
 * Twilio incoming-SMS webhook. Expects Twilio's standard form-encoded
 * payload (Body = message text, From = sender's number).
 * Worker texts a recruiter's number in the message body -> gets a verdict back via SMS.
 */
router.post("/incoming", async (req, res) => {
  const workerNumber = req.body.From;
  const recruiterNumber = (req.body.Body || "").trim();

  try {
    const result = await runVerification(recruiterNumber);
    await sendSms(workerNumber, formatVerdictForSms(result.verdict));
  } catch (err) {
    await sendSms(workerNumber, "TrustLine: couldn't check that number. Please include the country code and try again.");
  }

  res.status(200).type("text/xml").send("<Response></Response>");
});

module.exports = router;
