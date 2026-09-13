/**
 * agent/index.js
 *
 * BRIDGE — wires the real LangGraph agent (agent/graph.js) to the contract
 * that routes/verify.js and routes/platform.js were built against.
 *
 * Why this file exists at all: graph.js's own `runVerification` export
 * returns the graph's raw internal shape ({ riskLevel, explanation,
 * reasoningTrace, signalsUsed }), which doesn't match what the routes
 * expect ({ phoneNumber, escalated, verdict: { riskLevel, reasoning,
 * signalsUsed } }). Rather than change every route, this file translates
 * once, in one place.
 *
 * CONTRACT (extended — reasoningTrace and signals added, everything else
 * unchanged):
 *   runVerification(phoneNumber: string, claimedLocation?: string)
 *     -> Promise<{
 *          phoneNumber: string,
 *          escalated: boolean,
 *          verdict: {
 *            riskLevel: "LOW" | "MEDIUM" | "HIGH",
 *            reasoning: string,
 *            signalsUsed: string[]
 *          },
 *          reasoningTrace: { step: string, detail: string }[],
 *          signals: Record<string, { available: boolean, ... } | null>
 *        }>
 *   Throws on invalid input (route layer catches and returns 400).
 *
 * NOTE on `signals`: this is the graph's raw per-check state (e.g.
 * signals.simSwap = { available: true, swapped: false }), added so the
 * frontend can render a real per-signal status breakdown (a colored chip
 * per check) instead of parsing it back out of the free-text reasoning
 * trace. A key is `null` if that node never ran at all (e.g. not
 * escalated to); `{ available: false, error }` if it ran but failed.
 *
 * NOTE on claimedLocation: despite the generic name (kept for route
 * compatibility), agent/graph.js's locationVerificationCheck node expects
 * a plain region name string from a small lookup table (e.g. "Dubai",
 * "Doha", "Riyadh" — see agent/nodes/locationVerificationCheck.js), NOT a
 * {latitude, longitude} object. Pass a string or omit it.
 */

const { compiledGraph } = require("./graph");

async function runVerification(phoneNumber, claimedLocation = null) {
  const state = await compiledGraph.invoke({
    phoneNumber,
    claimedRegion: claimedLocation,
  });

  // intake.js sets riskLevel = "INVALID" and routes straight to END on bad
  // input, rather than throwing itself — translate that into a real throw
  // here so routes/verify.js's existing 400-vs-500 handling still works.
  if (state.riskLevel === "INVALID") {
    throw new Error(`Invalid input: ${state.explanation}`);
  }

  return {
    phoneNumber: state.phoneNumber,
    escalated: Boolean(state.escalate),
    verdict: {
      riskLevel: state.riskLevel,
      reasoning: state.explanation,
      signalsUsed: state.signalsUsed || [],
    },
    // Additive field — graph.js's raw state already tracks this per-step
    // trace internally; the frontend's expandable "how we got this" panel
    // consumes it directly.
    reasoningTrace: state.reasoningTrace || [],
    // Additive field — see CONTRACT note above.
    signals: state.signals || {},
  };
}

module.exports = { runVerification };

