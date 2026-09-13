// backend/src/routes/whatsapp.js
//
// Twilio WhatsApp incoming-message webhook. Twilio sends WhatsApp messages
// through the same webhook shape as SMS (form-encoded, From/Body fields),
// just with "whatsapp:" prefixed on the From number — so this mirrors
// routes/sms.js closely, reusing the exact same verification agent.
//
// Worker sends a recruiter's number as a WhatsApp message -> gets a
// formatted verdict back as a WhatsApp reply.

const express = require("express");
const { runVerification } = require("../agent");
const { sendWhatsApp, formatVerdictForWhatsApp } = require("../services/smsService");

const router = express.Router();

router.post("/incoming", async (req, res) => {
  const workerNumber = req.body.From; // arrives as "whatsapp:+1234567890"
  const recruiterNumber = (req.body.Body || "").trim();

  try {
    const result = await runVerification(recruiterNumber);
    await sendWhatsApp(workerNumber, formatVerdictForWhatsApp(result.verdict));
  } catch (err) {
    await sendWhatsApp(
      workerNumber,
      "TrustLine: couldn't check that number. Please include the country code and try again."
    );
  }

  res.status(200).type("text/xml").send("<Response></Response>");
});

module.exports = router;
