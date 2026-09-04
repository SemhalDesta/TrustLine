/**
 * agent/index.js
 *
 * TEMPORARY STUB — this is the agreed contract/seam between your track
 * (Platform & Integrations) and your teammate's track (AI Agent, which
 * owns agent/graph.js + agent/nodes/* + services/camaraClient.js).
 *
 * Build routes/verify.js against THIS function today. When your teammate's
 * real graph.js is ready, either:
 *   (a) they overwrite this file to export the same `runVerification`
 *       function name and return shape, backed by the real LangGraph graph, or
 *   (b) you change ONE line in routes/verify.js to import from their
 *       module instead of this one.
 *
 * Either way, nothing else in your 15 files needs to change — that's the
 * point of agreeing on this contract now.
 *
 * CONTRACT:
 *   runVerification(phoneNumber: string, claimedLocation?: object)
 *     -> Promise<{
 *          phoneNumber: string,
 *          escalated: boolean,
 *          verdict: {
 *            riskLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN",
 *            reasoning: string,
 *            signalsUsed: string[]
 *          }
 *        }>
 *   Throws on invalid input (route layer catches and returns 400/500).
 */

function seedFromNumber(number) {
  let sum = 0;
  for (const ch of number) sum += ch.charCodeAt(0);
  return sum;
}

async function runVerification(phoneNumber, claimedLocation = null) {
  if (!phoneNumber || String(phoneNumber).replace(/[^0-9]/g, "").length < 8) {
    throw new Error("Invalid phone number — please include country code, e.g. +92 71 234 5678");
  }

  // Deterministic mock so your route/DB/rate-limit tests are repeatable —
  // the same number always returns the same stub verdict.
  const seed = seedFromNumber(phoneNumber);
  const riskLevel = seed % 3 === 0 ? "HIGH" : seed % 3 === 1 ? "MEDIUM" : "LOW";

  return {
    phoneNumber,
    escalated: seed % 2 === 0,
    verdict: {
      riskLevel,
      reasoning: `[STUB] Mock verdict for ${phoneNumber} — replace with real agent output once graph.js is ready.`,
      signalsUsed: ["sim_swap", "number_verification", "device_status"],
    },
  };
}

module.exports = { runVerification };
