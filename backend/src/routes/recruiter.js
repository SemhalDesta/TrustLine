// backend/src/routes/recruiter.js
//
// Recruiter self-registration: proves a recruiter owns the phone number
// they're advertising, using the real CAMARA Number Verification API via
// its three-legged OAuth Authorization Code flow.
//
// This is fundamentally different from the worker-lookup flow in
// routes/verify.js: here, the recruiter is verifying THEMSELVES, on their
// OWN device, over REAL cellular data (not WiFi/VPN/hotspot — the network
// operator checks the request's source IP against the SIM's assigned IP).
// A worker cannot run this against a recruiter remotely, which is exactly
// why Number Verification has no place in the worker-lookup graph.
//
// Flow:
//   1. GET /api/recruiter/register/start?phoneNumber=...
//        -> returns { authorizeUrl } for the frontend to redirect to
//   2. Recruiter's browser follows that redirect on their own phone,
//      completes Nokia's consent flow
//   3. Nokia redirects back to CAMARA_REDIRECT_URI, which must point here:
//      GET /api/recruiter/register/callback?code=...&state=...
//        -> exchanges the code for a real user-consented token,
//           calls Number Verification with it, stores the result,
//           redirects the browser to a frontend result page

const express = require("express");
const crypto = require("crypto");
const camara = require("../services/camaraClient");
const { markRecruiterVerified, isRecruiterVerified } = require("../services/dbService");

const router = express.Router();

// Short-lived state -> phoneNumber mapping, so the callback (which only
// gets `state` back from Nokia, not the original phone number) knows which
// recruiter this verification belongs to. In-memory is fine here — these
// only need to live for the few minutes a real registration flow takes.
const pendingRegistrations = new Map(); // state -> { phoneNumber, createdAt }

const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupExpiredPending() {
  const now = Date.now();
  for (const [state, entry] of pendingRegistrations) {
    if (now - entry.createdAt > PENDING_TTL_MS) pendingRegistrations.delete(state);
  }
}

/**
 * GET /api/recruiter/register/start?phoneNumber=+971...
 * Returns the URL the recruiter's own browser must be redirected to.
 */
router.get("/register/start", (req, res) => {
  const { phoneNumber } = req.query;
  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber query parameter is required" });
  }

  cleanupExpiredPending();

  const state = crypto.randomBytes(16).toString("hex");
  pendingRegistrations.set(state, { phoneNumber, createdAt: Date.now() });

  try {
    const authorizeUrl = camara.buildRecruiterAuthorizeUrl(state);
    res.json({ authorizeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/recruiter/register/callback?code=...&state=...
 * Nokia redirects the recruiter's browser here after consent. This must
 * be a real, publicly-reachable URL registered as CAMARA_REDIRECT_URI in
 * your Nokia app config, or Nokia will refuse to redirect here at all.
 */
router.get("/register/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontendBase = process.env.FRONTEND_BASE_URL || "http://localhost:8080";

  if (oauthError) {
    return res.redirect(`${frontendBase}/recruiter-register.html?status=failed&reason=${encodeURIComponent(oauthError)}`);
  }

  const pending = pendingRegistrations.get(state);
  if (!pending) {
    return res.redirect(`${frontendBase}/recruiter-register.html?status=failed&reason=${encodeURIComponent("Registration session expired or invalid — please try again.")}`);
  }
  pendingRegistrations.delete(state);

  try {
    const accessToken = await camara.exchangeAuthorizationCode(code);
    const result = await camara.verifyNumberWithUserToken(pending.phoneNumber, accessToken);

    if (!result.success) {
      const reason = camara.describeSignalFailure(result.error);
      return res.redirect(`${frontendBase}/recruiter-register.html?status=failed&reason=${encodeURIComponent(reason)}`);
    }

    // The CAMARA response shape for a successful match typically includes
    // a boolean verification result — confirm the exact field name against
    // your Nokia dashboard once you can test this live; devicePhoneNumberVerified
    // is the field name used in Nokia's own published OpenAPI spec.
    const verified = result.data?.devicePhoneNumberVerified === true;

    if (!verified) {
      return res.redirect(`${frontendBase}/recruiter-register.html?status=failed&reason=${encodeURIComponent("This phone did not match the number provided.")}`);
    }

    await markRecruiterVerified(pending.phoneNumber);
    return res.redirect(`${frontendBase}/recruiter-register.html?status=verified&phoneNumber=${encodeURIComponent(pending.phoneNumber)}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[recruiter-callback] failed", err);
    return res.redirect(`${frontendBase}/recruiter-register.html?status=failed&reason=${encodeURIComponent("Verification failed. Please try again.")}`);
  }
});

/**
 * GET /api/recruiter/status?phoneNumber=+971...
 * Lets any page (e.g. the worker verify flow) check whether a number has
 * completed recruiter registration — the tie-in between the two flows
 * your mentor asked to see presented together.
 */
router.get("/status", async (req, res) => {
  const { phoneNumber } = req.query;
  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber query parameter is required" });
  }
  const verifiedAt = await isRecruiterVerified(phoneNumber);
  res.json({ phoneNumber, registered: Boolean(verifiedAt), verifiedAt });
});

module.exports = router;
