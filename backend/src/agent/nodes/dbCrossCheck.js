// backend/src/agent/nodes/dbCrossCheck.js
const { lookupScamReport } = require("../../services/dbService");

/**
 * LangGraph node: dbCrossCheck
 * Reads: state.phoneNumber
 * Writes: state.signals.dbCrossCheck, state.reasoningTrace
 */
async function dbCrossCheck(state) {
  try {
    const report = await lookupScamReport(state.phoneNumber);

    if (!report) {
      return {
        signals: {
          dbCrossCheck: { available: true, found: false, reportCount: 0, verifiedByNgo: false },
        },
        reasoningTrace: [
          {
            step: "dbCrossCheck",
            detail: "No prior scam reports found for this number in the NGO database.",
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    return {
      signals: {
        dbCrossCheck: {
          available: true,
          found: true,
          reportCount: report.reportCount,
          verifiedByNgo: report.verifiedByNgo,
          notes: report.notes,
        },
      },
      reasoningTrace: [
        {
          step: "dbCrossCheck",
          detail: report.verifiedByNgo
            ? `Number matches ${report.reportCount} NGO-verified scam report(s).`
            : `Number matches ${report.reportCount} unverified worker-submitted report(s), not yet reviewed by an NGO.`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  } catch (err) {
    let errorMessage = err?.message || err?.code;
    if (!errorMessage) {
      try {
        errorMessage = JSON.stringify(err);
      } catch {
        errorMessage = String(err);
      }
    }
    return {
      signals: {
        dbCrossCheck: { available: false, error: errorMessage },
      },
      reasoningTrace: [
        {
          step: "dbCrossCheck",
          detail: `Database cross-check failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

module.exports = { dbCrossCheck };