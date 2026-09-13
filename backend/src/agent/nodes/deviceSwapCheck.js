// backend/src/agent/nodes/deviceSwapCheck.js
const { checkDeviceSwap, describeSignalFailure } = require("../../services/camaraClient");

/**
 * LangGraph node: deviceSwapCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.deviceSwap, state.reasoningTrace
 */
async function deviceSwapCheck(state) {
  const result = await checkDeviceSwap(state.phoneNumber);

  if (!result.success) {
    return {
      signals: {
        deviceSwap: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "deviceSwapCheck",
          detail: `Device Swap check unavailable (${describeSignalFailure(result.error)}) — treated as inconclusive, not a red flag.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const swapped = result.data.swapped === true;

  return {
    signals: {
      deviceSwap: {
        available: true,
        swapped,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "deviceSwapCheck",
        detail: swapped
          ? "Device recently changed for this number — potential burner-device pattern."
          : "No recent device change detected.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { deviceSwapCheck };