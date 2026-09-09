/**
 * test-agent.js
 *
 * Run AFTER test-camara.js shows real CAMARA responses. This runs the
 * FULL agent (all 3 layers: CAMARA calls -> triage -> LLM reasoning) and
 * prints the full reasoning trace, so you can see exactly what happened
 * at each step — not just the final verdict.
 *
 * Usage:
 *   CAMARA_RAPIDAPI_KEY=your_key GROQ_API_KEY=your_key node test-agent.js +9999991000
 */

const { runVerification } = require("./src/agent");

const phoneNumber = process.argv[2];
if (!phoneNumber) {
  console.error("Usage: node test-agent.js <phoneNumber>");
  process.exit(1);
}

async function main() {
  console.log(`Running full agent for: ${phoneNumber}\n`);
  try {
    const result = await runVerification(phoneNumber);
    console.log("=== FINAL RESULT (this is what the frontend receives) ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log("=== THREW (expected only for invalid input) ===");
    console.log(err.message);
  }
}

main();
