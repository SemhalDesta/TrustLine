/**
 * smsService.js
 *
 * Twilio wrapper for the SMS/USSD channel — lets a worker text a number
 * and get a verdict back, for low-bandwidth / no-smartphone access.
 *
 * Falls back to a console-log mock if TWILIO_* env vars aren't set, so
 * routes/sms.js can be built and tested without a real Twilio account.
 */

const env = require("../config/env");

// Any of these mean "not a real, usable Twilio credential" — checking the
// actual required shape (real SIDs always start with "AC") is more robust
// than trying to guess every possible placeholder string someone might type.
const USE_MOCK =
  !env.twilio.accountSid ||
  !env.twilio.authToken ||
  !env.twilio.accountSid.startsWith("AC");

let twilioClient = null;
if (!USE_MOCK) {
  const twilio = require("twilio");
  twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);
}

async function sendSms(toNumber, body) {
  if (USE_MOCK) {
    // eslint-disable-next-line no-console
    console.log(`[smsService MOCK] Would send SMS to ${toNumber}:\n${body}`);
    return { mocked: true, to: toNumber, body };
  }

  const message = await twilioClient.messages.create({
    to: toNumber,
    from: env.twilio.fromNumber,
    body,
  });
  return { sid: message.sid, to: toNumber };
}

/** Formats a verdict into a short SMS-friendly message (no rich formatting, no links). */
function formatVerdictForSms(verdict) {
  const riskWord = { LOW: "LOW RISK", MEDIUM: "MEDIUM RISK", HIGH: "HIGH RISK" }[verdict.riskLevel] || "UNKNOWN";
  return `TrustLine: ${riskWord}. ${verdict.reasoning}`.slice(0, 320); // keep it to ~2 SMS segments
}

module.exports = { sendSms, formatVerdictForSms, USE_MOCK };
