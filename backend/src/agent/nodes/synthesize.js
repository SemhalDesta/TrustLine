// backend/src/agent/nodes/synthesize.js
const { ChatGroq } = require("@langchain/groq");

// Lazily created — only built the first time synthesize() actually runs,
// not the moment this file is required. Avoids crashing on import if
// env vars aren't loaded yet (e.g., during testing/inspection).
let model = null;
function getModel() {
  if (!model) {
    model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "openai/gpt-oss-120b",
      temperature: 0,
    });
  }
  return model;
}

function summarizeSignalsForPrompt(signals) {
  const lines = [];

  if (signals.simSwap?.available) {
    lines.push(`- SIM Swap: ${signals.simSwap.swapped ? "SWAPPED recently" : "no recent swap"}`);
  } else {
    lines.push(`- SIM Swap: unavailable (${signals.simSwap?.error || "unknown error"})`);
  }

  if (signals.deviceSwap?.available) {
    lines.push(`- Device Swap: ${signals.deviceSwap.swapped ? "SWAPPED recently" : "no recent swap"}`);
  } else {
    lines.push(`- Device Swap: unavailable (${signals.deviceSwap?.error || "unknown error"})`);
  }

  if (signals.dbCrossCheck?.available) {
    if (signals.dbCrossCheck.found) {
      lines.push(
        `- NGO scam-report database: ${signals.dbCrossCheck.reportCount} report(s), ` +
        `${signals.dbCrossCheck.verifiedByNgo ? "NGO-VERIFIED" : "unverified worker submissions only"}`
      );
    } else {
      lines.push(`- NGO scam-report database: no reports found`);
    }
  }

  if (signals.locationVerification?.available) {
    lines.push(`- Location Verification: ${signals.locationVerification.verified ? "matches claimed region" : "does NOT match claimed region"}`);
  }
  if (signals.deviceRoaming?.available) {
    lines.push(`- Device Roaming: ${signals.deviceRoaming.roaming ? "currently roaming internationally" : "not roaming"}`);
  }
  if (signals.deviceReachability?.available) {
    lines.push(`- Device Reachability: ${signals.deviceReachability.reachable ? "reachable" : "unreachable"}`);
  }

  return lines.join("\n");
}

/**
 * Deterministic fallback — used only if the LLM call itself fails
 * (network error, rate limit, outage). Keeps the demo from ever hard-crashing.
 */
function fallbackVerdict(signals) {
  const flags = [
    signals.simSwap?.swapped,
    signals.deviceSwap?.swapped,
    signals.dbCrossCheck?.found,
  ].filter(Boolean).length;

  if (flags >= 2) return { riskLevel: "HIGH", explanation: "Multiple independent signals flagged this number as high risk." };
  if (flags === 1) return { riskLevel: "MEDIUM", explanation: "One signal flagged this number — treat with caution." };
  return { riskLevel: "LOW", explanation: "No red flags found across available signals." };
}

/**
 * LangGraph node: synthesize
 * Reads: state.signals, state.reasoningTrace
 * Writes: state.riskLevel, state.explanation, state.signalsUsed, state.reasoningTrace
 */
async function synthesize(state) {
  const signalSummary = summarizeSignalsForPrompt(state.signals);
  const signalsUsed = Object.keys(state.signals).filter((key) => state.signals[key]?.available);

  const prompt = `You are TrustLine's fraud-verification reasoning agent. A migrant worker is checking whether a recruiter's phone number is trustworthy, before paying a fee or traveling for a job.

Evidence gathered so far:
${signalSummary}

Weigh these signals by:
- Recency (a very recent SIM/device swap is more suspicious than an old one)
- Consistency (do multiple independent signals agree?)
- Independence (an NGO-verified report is stronger evidence than a single unverified worker complaint)

Respond with ONLY valid JSON, no other text, no markdown fences, in exactly this shape:
{"riskLevel": "HIGH" | "MEDIUM" | "LOW", "explanation": "one or two plain-language sentences a non-technical worker can understand"}`;

  try {
    const response = await getModel().invoke(prompt);
    const cleaned = response.content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      riskLevel: parsed.riskLevel,
      explanation: parsed.explanation,
      signalsUsed,
      reasoningTrace: [
        {
          step: "synthesize",
          detail: `Verdict: ${parsed.riskLevel}. ${parsed.explanation}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } catch (err) {
    const fallback = fallbackVerdict(state.signals);
    return {
      riskLevel: fallback.riskLevel,
      explanation: fallback.explanation,
      signalsUsed,
      reasoningTrace: [
        {
          step: "synthesize",
          detail: `LLM reasoning unavailable (${err.message}) — used rule-based fallback: ${fallback.riskLevel}.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

module.exports = { synthesize };