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
    from: env.twilio.smsFromNumber,
    body,
  });
  return { sid: message.sid, to: toNumber };
}

// Twilio's WhatsApp Business API — uses the SAME account/client as SMS,
// just with numbers prefixed "whatsapp:". This works today against
// Twilio's WhatsApp sandbox for testing, without needing Meta's own
// business verification process (which takes days). To go from sandbox
// to a real production WhatsApp number, you'd register that number with
// Twilio's WhatsApp onboarding — the code below doesn't change either way.
//
// NOTE: this is a DIFFERENT number from the plain-SMS sender above — a
// WhatsApp send must go "from" a WhatsApp-enabled number (the shared
// sandbox number below during testing), never the SMS-only number.
const TWILIO_WHATSAPP_FROM = env.twilio.whatsappFromNumber; // e.g. "whatsapp:+14155238886" for the sandbox

async function sendWhatsApp(toNumber, body) {
  const toWhatsApp = toNumber.startsWith("whatsapp:") ? toNumber : `whatsapp:${toNumber}`;

  if (USE_MOCK || !TWILIO_WHATSAPP_FROM) {
    // eslint-disable-next-line no-console
    console.log(`[smsService MOCK] Would send WhatsApp to ${toWhatsApp}:\n${body}`);
    return { mocked: true, to: toWhatsApp, body };
  }

  const message = await twilioClient.messages.create({
    to: toWhatsApp,
    from: TWILIO_WHATSAPP_FROM,
    body,
  });
  return { sid: message.sid, to: toWhatsApp };
}

/** Formats a verdict into a short SMS-friendly message (no rich formatting, no links). */
function formatVerdictForSms(verdict) {
  const riskWord = { LOW: "LOW RISK", MEDIUM: "MEDIUM RISK", HIGH: "HIGH RISK" }[verdict.riskLevel] || "UNKNOWN";
  return `TrustLine: ${riskWord}. ${verdict.reasoning}`.slice(0, 320); // keep it to ~2 SMS segments
}

/** WhatsApp allows richer formatting and longer messages than SMS — no length cap needed. */
function formatVerdictForWhatsApp(verdict) {
  const riskWord = { LOW: "✅ LOW RISK", MEDIUM: "⚠️ CAUTION", HIGH: "🚨 HIGH RISK" }[verdict.riskLevel] || "UNKNOWN";
  return `*TrustLine Verdict: ${riskWord}*\n\n${verdict.reasoning}\n\n_Reply with another number to check someone else._`;
}

module.exports = {
  sendSms,
  sendWhatsApp,
  formatVerdictForSms,
  formatVerdictForWhatsApp,
  USE_MOCK,
};
