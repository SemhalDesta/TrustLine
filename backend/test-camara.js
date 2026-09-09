/**
 * test-camara.js
 *
 * Run this FIRST, before testing the full agent. It calls each CAMARA API
 * directly and prints the raw response — isolates "is my Nokia key/setup
 * correct" from "is my agent logic correct."
 *
 * Usage (works the same on Windows, Mac, Linux — reads from .env):
 *   1. Put CAMARA_RAPIDAPI_KEY=your_real_key in backend/.env
 *   2. cd backend
 *   3. node test-camara.js +9999991000
 *
 * Use one of Nokia's own simulator numbers if you have them (check your
 * Network-as-Code dashboard/docs for the current list — these change and
 * I don't have live access to confirm which ones are active right now).
 * A real number CAN also work against the sandbox depending on how Nokia's
 * simulator is configured, but simulator numbers give predictable results.
 */

require("dotenv").config();
const camara = require("./src/services/camaraClient");

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error("Usage: node test-camara.js <phoneNumber>");
  console.error("Example: node test-camara.js +9999991000");
  process.exit(1);
}

if (!process.env.CAMARA_RAPIDAPI_KEY) {
  console.error("CAMARA_RAPIDAPI_KEY is not set.");
  console.error("Open backend/.env and add this line (no quotes):");
  console.error("  CAMARA_RAPIDAPI_KEY=your_real_key_here");
  console.error("Then save the file and run: node test-camara.js " + phoneNumber);
  process.exit(1);
}

async function testOne(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    const result = await fn();
    if (result.success) {
      console.log("✅ SUCCESS");
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log("❌ API RETURNED AN ERROR (this is Nokia's response, not a crash):");
      console.log("   status:", result.status);
      console.log("   error:", JSON.stringify(result.error, null, 2));
    }
  } catch (err) {
    console.log("❌ THREW UNEXPECTEDLY (network/code issue, not a normal API error):");
    console.log("  ", err.message);
  }
}

async function main() {
  console.log(`Testing CAMARA APIs against: ${phoneNumber}`);
  console.log(`Using key ending in: ...${process.env.CAMARA_RAPIDAPI_KEY.slice(-6)}`);

  await testOne("SIM Swap", () => camara.checkSimSwap(phoneNumber));
  await testOne("Device Swap", () => camara.checkDeviceSwap(phoneNumber));
  await testOne("Number Verification", () => camara.verifyNumber(phoneNumber));
  await testOne("Device Reachability", () => camara.checkDeviceReachability(phoneNumber));
  await testOne("Device Roaming", () => camara.checkDeviceRoaming(phoneNumber));
  await testOne("Location Verification (Dubai)", () =>
    camara.verifyLocation(phoneNumber, 25.2048, 55.2708, 50000)
  );
  await testOne("Location Retrieval", () => camara.retrieveLocation(phoneNumber));

  console.log("\n\nDone. Read the output above:");
  console.log("- ✅ SUCCESS with real-looking data => that API is working, note the exact field names for later.");
  console.log("- ❌ API RETURNED AN ERROR with a 401/403 => your key is wrong or not activated for that API.");
  console.log("- ❌ API RETURNED AN ERROR with a 404 => the endpoint path in camaraClient.js is wrong for that API.");
  console.log("- ❌ THREW UNEXPECTEDLY => likely a network/DNS/timeout issue, not a credentials issue.");
}

main();
