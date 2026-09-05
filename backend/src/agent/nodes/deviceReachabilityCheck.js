// backend/src/agent/nodes/deviceReachabilityCheck.js
const { checkDeviceReachability } = require("../../services/camaraClient");

/**
 * LangGraph node: deviceReachabilityCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.deviceReachability, state.reasoningTrace
 *
 * Secondary/escalation-path signal — a cheap early filter. An
 * unreachable number is itself a red flag (disconnected, fake, or
 * a burner already discarded), independent of the other signals.
 */
async function deviceReachabilityCheck(state) {
  const result = await checkDeviceReachability(state.phoneNumber);

  if (!result.success) {
    return {
      signals: {
        deviceReachability: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "deviceReachabilityCheck",
          detail: `Device Reachability check failed: ${JSON.stringify(result.error)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // NOTE: field name unconfirmed — test before trusting. Guessing
  // "reachable" (boolean) based on naming conventions seen so far.
  const reachable = result.data.reachable === true;

  return {
    signals: {
      deviceReachability: {
        available: true,
        reachable,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "deviceReachabilityCheck",
        detail: reachable
          ? "Number is currently reachable."
          : "Number is unreachable — could indicate a disconnected or discarded burner number.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { deviceReachabilityCheck };