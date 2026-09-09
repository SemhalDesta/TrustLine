// backend/src/agent/graph.js
const { StateGraph, START, END } = require("@langchain/langgraph");
const { TrustLineState } = require("./state");

const { intake } = require("./nodes/intake");
const { simSwapCheck } = require("./nodes/simSwapCheck");
const { deviceSwapCheck } = require("./nodes/deviceSwapCheck");
const { triage } = require("./nodes/triage");
const { dbCrossCheck } = require("./nodes/dbCrossCheck");
const { locationVerificationCheck } = require("./nodes/locationVerificationCheck");
const { deviceRoamingCheck } = require("./nodes/deviceRoamingCheck");
const { deviceReachabilityCheck } = require("./nodes/deviceReachabilityCheck");
const { synthesize } = require("./nodes/synthesize");

// NOTE: numberVerificationCheck still intentionally NOT wired in —
// see comment at the top of that file.

function afterIntake(state) {
  if (state.riskLevel === "INVALID") return END;
  return ["simSwapCheck", "deviceSwapCheck"];
}

function afterTriage(state) {
  if (!state.escalate) return "synthesize";
  // fan out to all 4 secondary signals in parallel
  return [
    "dbCrossCheck",
    "locationVerificationCheck",
    "deviceRoamingCheck",
    "deviceReachabilityCheck",
  ];
}

const graph = new StateGraph(TrustLineState)
  .addNode("intake", intake)
  .addNode("simSwapCheck", simSwapCheck)
  .addNode("deviceSwapCheck", deviceSwapCheck)
  .addNode("triage", triage)
  .addNode("dbCrossCheck", dbCrossCheck)
  .addNode("locationVerificationCheck", locationVerificationCheck)
  .addNode("deviceRoamingCheck", deviceRoamingCheck)
  .addNode("deviceReachabilityCheck", deviceReachabilityCheck)
  .addNode("synthesize", synthesize)

  .addEdge(START, "intake")
  .addConditionalEdges("intake", afterIntake, {
    simSwapCheck: "simSwapCheck",
    deviceSwapCheck: "deviceSwapCheck",
    [END]: END,
  })

  .addEdge("simSwapCheck", "triage")
  .addEdge("deviceSwapCheck", "triage")

  .addConditionalEdges("triage", afterTriage, {
    dbCrossCheck: "dbCrossCheck",
    locationVerificationCheck: "locationVerificationCheck",
    deviceRoamingCheck: "deviceRoamingCheck",
    deviceReachabilityCheck: "deviceReachabilityCheck",
    synthesize: "synthesize",
  })

  // all 4 secondary signals fan back into synthesize
  .addEdge("dbCrossCheck", "synthesize")
  .addEdge("locationVerificationCheck", "synthesize")
  .addEdge("deviceRoamingCheck", "synthesize")
  .addEdge("deviceReachabilityCheck", "synthesize")

  .addEdge("synthesize", END);

const compiledGraph = graph.compile();

async function runVerification(phoneNumber, claimedRegion = null) {
  const result = await compiledGraph.invoke({ phoneNumber, claimedRegion });

  return {
    riskLevel: result.riskLevel,
    explanation: result.explanation,
    reasoningTrace: result.reasoningTrace,
    signalsUsed: result.signalsUsed,
  };
}

module.exports = { runVerification, compiledGraph };