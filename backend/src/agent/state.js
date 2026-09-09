// backend/src/agent/state.js
const { Annotation } = require("@langchain/langgraph");

/**
 * Shared state for the TrustLine verification graph.
 * Every node reads from and writes to this shape.
 */
const TrustLineState = Annotation.Root({
  phoneNumber: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),
  claimedRegion: Annotation({
  reducer: (_, next) => next,
  default: () => null,
}),


  signals: Annotation({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      simSwap: null,
      numberVerification: null,
      deviceSwap: null,
      locationVerification: null,
      deviceRoaming: null,
      deviceReachability: null,
      dbCrossCheck: null,
    }),
  }),

  // --- routing decision made by triage.js ---
  escalate: Annotation({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // --- human-readable trace of what the agent did and why ---
  // each entry: { step: string, detail: string, timestamp: string }
  reasoningTrace: Annotation({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  // --- final output, set by synthesize.js ---
  riskLevel: Annotation({
    reducer: (_, next) => next,
    default: () => null, // "HIGH" | "MEDIUM" | "LOW"
  }),

  explanation: Annotation({
    reducer: (_, next) => next,
    default: () => null, // plain-language string shown to the worker
  }),

  signalsUsed: Annotation({
    reducer: (_, next) => next,
    default: () => [], // e.g. ["simSwap", "numberVerification", ...]
  }),
});

module.exports = { TrustLineState };