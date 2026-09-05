/**
 * LangGraph node: triage
 * Reads: state.signals (simSwap, deviceSwap so far)
 * Writes: state.escalate, state.reasoningTrace
 *
 * Decision logic:
 * - Both signals agree and are unavailable-free means confident, skip escalation
 * - Any signal unavailable, OR signals disagree/are ambiguous → escalate
 *
 * "Confident" cases (no escalation needed):
 *   - Both clean (no swap on either) means likely legitimate, low risk
 *   - Both flagged (swap on both) means likely fraud, high risk
 *
 * "Ambiguous" cases (escalate):
 *   - One flagged, one clean means conflicting evidence, need more signals
 *   - Either signal came back unavailable (API failure) means need to fill the gap
 */
function triage(state) {
  const { simSwap, deviceSwap } = state.signals;

  const simUnavailable = !simSwap || simSwap.available === false;
  const deviceUnavailable = !deviceSwap || deviceSwap.available === false;

  if (simUnavailable || deviceUnavailable) {
    return {
      escalate: true,
      reasoningTrace: [
        {
          step: "triage",
          detail:
            "One or more core signals unavailable — escalating to secondary checks to fill the gap.",
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const bothClean = !simSwap.swapped && !deviceSwap.swapped;
  const bothFlagged = simSwap.swapped && deviceSwap.swapped;

  if (bothClean || bothFlagged) {
    return {
      escalate: false,
      reasoningTrace: [
        {
          step: "triage",
          detail: bothClean
            ? "SIM Swap and Device Swap both clean — signals agree, confident result without escalation."
            : "SIM Swap and Device Swap both flagged — signals agree, confident high-risk result without escalation.",
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // one flagged, one clean — conflicting evidence
  return {
    escalate: true,
    reasoningTrace: [
      {
        step: "triage",
        detail:
          "SIM Swap and Device Swap disagree — escalating to secondary signals to resolve the conflict.",
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { triage };