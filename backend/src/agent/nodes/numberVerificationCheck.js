// backend/src/agent/nodes/numberVerificationCheck.js
const { verifyNumber, describeSignalFailure } = require("../../services/camaraClient");

/**
 * LangGraph node: numberVerificationCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.numberVerification, state.reasoningTrace
 */
async function numberVerificationCheck(state) {
  const result = await verifyNumber(state.phoneNumber);

  if (!result.success) {
    return {
      signals: {
        numberVerification: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "numberVerificationCheck",
          detail: `Number Verification check unavailable (${describeSignalFailure(result.error)}) — treated as inconclusive, not a red flag.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const verified = result.data.devicePhoneNumberVerified === true;

  return {
    signals: {
      numberVerification: {
        available: true,
        verified,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "numberVerificationCheck",
        detail: verified
          ? "Number verified against carrier records."
          : "Number could not be verified — no matching carrier/registration record.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { numberVerificationCheck };