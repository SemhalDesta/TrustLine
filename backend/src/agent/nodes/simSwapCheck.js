// backend/src/agent/nodes/simSwapCheck.js
const { checkSimSwap } = require("../../services/camaraClient");

/**
 * LangGraph node: simSwapCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.simSwap, state.reasoningTrace
 *
 * Never throws — if the API call fails, the signal is recorded as
 * unavailable rather than crashing the whole graph. A single flaky
 * signal shouldn't take down the entire verification.
 */
async function simSwapCheck(state) {
  const result = await checkSimSwap(state.phoneNumber);

  if (!result.success) {
    return {
      signals: {
        simSwap: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "simSwapCheck",
          detail: `SIM Swap check failed: ${JSON.stringify(result.error)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const swapped = result.data.swapped === true;

  return {
    signals: {
      simSwap: {
        available: true,
        swapped,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "simSwapCheck",
        detail: swapped
          ? "SIM has been swapped recently — potential red flag."
          : "No recent SIM swap detected.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { simSwapCheck };
