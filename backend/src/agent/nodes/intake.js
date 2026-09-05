// backend/src/agent/nodes/intake.js

/**
 * Basic E.164-ish normalization: strips spaces, dashes, parentheses,
 * ensures a leading "+", and does a loose length/format sanity check.
 * This is intentionally simple for the hackathon — swap in a proper
 * library (e.g. libphonenumber-js) later if time allows.
 */
function normalizePhoneNumber(raw) {
  if (!raw || typeof raw !== "string") {
    return { valid: false, normalized: null, reason: "empty_or_not_string" };
  }

  let cleaned = raw.trim().replace(/[\s\-().]/g, "");

  // allow a leading "00" as an alternative to "+"
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  if (!cleaned.startsWith("+")) {
    return { valid: false, normalized: null, reason: "missing_country_code" };
  }

  // + followed by 8–15 digits covers the vast majority of real numbers
  const digitsOnly = cleaned.slice(1);
  const isAllDigits = /^\d+$/.test(digitsOnly);
  const lengthOk = digitsOnly.length >= 8 && digitsOnly.length <= 15;

  if (!isAllDigits || !lengthOk) {
    return { valid: false, normalized: null, reason: "invalid_format" };
  }

  return { valid: true, normalized: cleaned, reason: null };
}

/**
 * LangGraph node: intake
 * Reads: state.phoneNumber (raw, as entered by the worker)
 * Writes: state.phoneNumber (normalized), state.reasoningTrace
 */
async function intake(state) {
  const result = normalizePhoneNumber(state.phoneNumber);

  if (!result.valid) {
    return {
      reasoningTrace: [
        {
          step: "intake",
          detail: `Rejected input: ${result.reason}`,
          timestamp: new Date().toISOString(),
        },
      ],
      riskLevel: "INVALID",
      explanation:
        "That doesn't look like a valid phone number. Please include the country code (e.g. +971...).",
    };
  }

  return {
    phoneNumber: result.normalized,
    reasoningTrace: [
      {
        step: "intake",
        detail: `Normalized input to ${result.normalized}`,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { intake, normalizePhoneNumber };