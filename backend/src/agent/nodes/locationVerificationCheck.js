// backend/src/agent/nodes/locationVerificationCheck.js
const { verifyLocation } = require("../../services/camaraClient");

/**
 * Minimal region → coordinates lookup for common Gulf/MENA recruitment
 * hubs. Radius is generous (city-wide, ~50km) since we're checking
 * "is this number roughly where it claims to operate," not pinpointing
 * an exact address.
 *
 * Expand this table as needed — it's intentionally small for the hackathon.
 */
const REGION_COORDINATES = {
  dubai: { latitude: 25.2048, longitude: 55.2708, radius: 50000 },
  "abu dhabi": { latitude: 24.4539, longitude: 54.3773, radius: 50000 },
  doha: { latitude: 25.2854, longitude: 51.531, radius: 50000 },
  riyadh: { latitude: 24.7136, longitude: 46.6753, radius: 50000 },
  kuwait: { latitude: 29.3759, longitude: 47.9774, radius: 50000 },
  manama: { latitude: 26.2285, longitude: 50.586, radius: 50000 },
};

function resolveRegion(claimedRegion) {
  if (!claimedRegion) return null;
  return REGION_COORDINATES[claimedRegion.trim().toLowerCase()] || null;
}

/**
 * LangGraph node: locationVerificationCheck
 * Reads: state.phoneNumber, state.claimedRegion
 * Writes: state.signals.locationVerification, state.reasoningTrace
 */
async function locationVerificationCheck(state) {
  const coords = resolveRegion(state.claimedRegion);

  if (!coords) {
    return {
      signals: {
        locationVerification: {
          available: false,
          error: `Unknown or missing claimed region: "${state.claimedRegion}"`,
        },
      },
      reasoningTrace: [
        {
          step: "locationVerificationCheck",
          detail: `Skipped — no coordinates on file for claimed region "${state.claimedRegion}".`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const result = await verifyLocation(
    state.phoneNumber,
    coords.latitude,
    coords.longitude,
    coords.radius
  );

  if (!result.success) {
    return {
      signals: {
        locationVerification: { available: false, error: result.error },
      },
      reasoningTrace: [
        {
          step: "locationVerificationCheck",
          detail: `Location Verification check failed: ${JSON.stringify(result.error)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // NOTE: field name assumed based on typical CAMARA verify-style responses
  // (a boolean "verificationResult" or similar). NOT yet confirmed against
  // a real response — test before trusting, same caution as other nodes.
  const verified = result.data.verificationResult === "TRUE" || result.data.verified === true;

  return {
    signals: {
      locationVerification: {
        available: true,
        verified,
        claimedRegion: state.claimedRegion,
        raw: result.data,
      },
    },
    reasoningTrace: [
      {
        step: "locationVerificationCheck",
        detail: verified
          ? `Number's location matches claimed region (${state.claimedRegion}).`
          : `Number's location does NOT match claimed region (${state.claimedRegion}) — potential red flag.`,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

module.exports = { locationVerificationCheck };