const axios = require("axios");

const CAMARA_RAPIDAPI_KEY = process.env.CAMARA_RAPIDAPI_KEY;
const CAMARA_HOSTNAME = "network-as-code.p-eu.apihub.nokia.io";
const CAMARA_HOST_HEADER = "network-as-code.nokia.rapidapi.com";
const CAMARA_BASE_URL = `https://${CAMARA_HOSTNAME}`;

const CAMARA_TOKEN_URL = process.env.CAMARA_TOKEN_URL;
const CAMARA_CLIENT_ID = process.env.CAMARA_CLIENT_ID;
const CAMARA_CLIENT_SECRET = process.env.CAMARA_CLIENT_SECRET;
// Fallback: if your dashboard gives you a token directly instead of a
// token URL + client credentials, set this and skip the fetch entirely.
const CAMARA_STATIC_BEARER_TOKEN = process.env.CAMARA_BEARER_TOKEN;

function camaraHeaders() {
  return {
    "x-rapidapi-key": CAMARA_RAPIDAPI_KEY,
    "x-rapidapi-host": CAMARA_HOST_HEADER,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// OAuth2 client-credentials token.
//
// IMPORTANT CORRECTION: this is NOT sufficient for Number Verification.
// Client-credentials proves this backend application is legitimate — it
// does NOT prove that a specific phone is in a specific person's hand,
// which is what Number Verification actually checks. That requires the
// three-legged Authorization Code flow further down this file
// (buildRecruiterAuthorizeUrl / exchangeAuthorizationCode /
// verifyNumberWithUserToken), which must run on the phone's owner's own
// device over real cellular data.
//
// This function is kept for any other API that genuinely does use
// client-credentials, but verifyNumber() below (which uses this) is not
// wired into the worker-verification graph — see agent/nodes/
// numberVerificationCheck.js for why.
// ---------------------------------------------------------------------------

let cachedToken = null;
let cachedTokenExpiresAt = 0; // epoch ms

async function fetchBearerToken() {
  // If your Nokia dashboard gave you a long-lived static token instead of
  // client-credentials, use it directly — no fetch needed.
  if (CAMARA_STATIC_BEARER_TOKEN) {
    return CAMARA_STATIC_BEARER_TOKEN;
  }

  if (!CAMARA_TOKEN_URL || !CAMARA_CLIENT_ID || !CAMARA_CLIENT_SECRET) {
    throw new Error(
      "Number Verification needs CAMARA_TOKEN_URL + CAMARA_CLIENT_ID + CAMARA_CLIENT_SECRET " +
        "(or CAMARA_BEARER_TOKEN) set in .env — check your Nokia NaC dashboard for these values."
    );
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }

  // Standard OAuth2 client-credentials grant (RFC 6749) — HTTP Basic auth
  // with client_id/client_secret, grant_type in the body. This is the most
  // common pattern for token endpoints; confirm against your dashboard's
  // exact docs if this doesn't work — some providers expect client_id/
  // client_secret in the body instead of Basic auth.
  const response = await axios.post(
    CAMARA_TOKEN_URL,
    new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        username: CAMARA_CLIENT_ID,
        password: CAMARA_CLIENT_SECRET,
      },
      timeout: 8000,
    }
  );

  cachedToken = response.data.access_token;
  // expires_in is in seconds; refresh 60s early to be safe.
  const expiresInMs = (response.data.expires_in || 3600) * 1000;
  cachedTokenExpiresAt = now + expiresInMs - 60000;

  return cachedToken;
}

async function camaraPost(path, body) {
  try {
    const response = await axios.post(`${CAMARA_BASE_URL}${path}`, body, {
      headers: camaraHeaders(),
      timeout: 8000,
    });
    return { success: true, data: response.data };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message,
      status: err.response?.status || null,
    };
  }
}

/** Same as camaraPost, but attaches an OAuth2 Bearer token — for APIs like
 * Number Verification that require it on top of the RapidAPI key. */
async function camaraPostWithBearer(path, body) {
  try {
    const token = await fetchBearerToken();
    const response = await axios.post(`${CAMARA_BASE_URL}${path}`, body, {
      headers: {
        ...camaraHeaders(),
        Authorization: `Bearer ${token}`,
      },
      timeout: 8000,
    });
    return { success: true, data: response.data };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message,
      status: err.response?.status || null,
    };
  }
}


async function camaraGet(path) {
  try {
    const response = await axios.get(`${CAMARA_BASE_URL}${path}`, {
      headers: camaraHeaders(),
      timeout: 8000,
    });
    return { success: true, data: response.data };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message,
      status: err.response?.status || null,
    };
  }
}

// ---------------------------------------------------------------------------
// Three-legged Authorization Code flow — the CORRECT way to call Number
// Verification. Used only by the recruiter self-registration flow
// (routes/recruiter.js), never by the worker-lookup graph, because it
// requires the phone's actual owner to complete a redirect on their own
// device over real cellular data — a worker cannot run this against a
// recruiter's number, only a recruiter can run it against their own.
//
// Standard CAMARA / RFC 6749 shape, cross-referenced against publicly
// documented CAMARA Number Verification implementations (exact parameter
// names can vary slightly by operator — confirm against your Nokia
// dashboard's Number Verification page if the authorize step fails).
// ---------------------------------------------------------------------------

const CAMARA_AUTHORIZE_URL = process.env.CAMARA_AUTHORIZE_URL;
const CAMARA_REDIRECT_URI = process.env.CAMARA_REDIRECT_URI;
const CAMARA_SCOPE =
  process.env.CAMARA_SCOPE || "dpv:FraudPreventionAndDetection#number-verification:verify";

/**
 * Builds the URL to send the recruiter's own browser to. This must be
 * opened on the recruiter's own phone using their mobile data connection —
 * WiFi, VPN, or hotspot tethering will not work, because the network
 * verifies the request's source IP against the SIM's assigned IP.
 */
function buildRecruiterAuthorizeUrl(state) {
  if (!CAMARA_AUTHORIZE_URL || !CAMARA_CLIENT_ID || !CAMARA_REDIRECT_URI) {
    throw new Error(
      "Recruiter registration needs CAMARA_AUTHORIZE_URL, CAMARA_CLIENT_ID, and " +
        "CAMARA_REDIRECT_URI set in .env — check your Nokia dashboard's Number " +
        "Verification page for the authorize endpoint and register your redirect URI there."
    );
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CAMARA_CLIENT_ID,
    redirect_uri: CAMARA_REDIRECT_URI,
    scope: CAMARA_SCOPE,
    state,
  });
  return `${CAMARA_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchanges the authorization code Nokia redirected back with for a real,
 * user-consented access token. This is a DIFFERENT grant type
 * (authorization_code) from fetchBearerToken's client_credentials above —
 * the two are not interchangeable.
 */
async function exchangeAuthorizationCode(code) {
  if (!CAMARA_TOKEN_URL || !CAMARA_CLIENT_ID || !CAMARA_CLIENT_SECRET || !CAMARA_REDIRECT_URI) {
    throw new Error(
      "Missing CAMARA_TOKEN_URL / CAMARA_CLIENT_ID / CAMARA_CLIENT_SECRET / CAMARA_REDIRECT_URI in .env"
    );
  }
  const response = await axios.post(
    CAMARA_TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CAMARA_REDIRECT_URI,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: CAMARA_CLIENT_ID, password: CAMARA_CLIENT_SECRET },
      timeout: 8000,
    }
  );
  return response.data.access_token;
}

/**
 * Calls the real Number Verification endpoint using a three-legged,
 * user-consented access token (NOT the client-credentials token from
 * fetchBearerToken). This is the call that actually proves the recruiter
 * owns the phone they're registering.
 */
async function verifyNumberWithUserToken(phoneNumber, userAccessToken) {
  try {
    const response = await axios.post(
      `${CAMARA_BASE_URL}/passthrough/camara/v1/number-verification/number-verification/v0/verify`,
      { phoneNumber },
      {
        headers: {
          ...camaraHeaders(),
          Authorization: `Bearer ${userAccessToken}`,
        },
        timeout: 8000,
      }
    );
    return { success: true, data: response.data };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message,
      status: err.response?.status || null,
    };
  }
}


async function checkSimSwap(phoneNumber, maxAgeHours = 240) {
  return camaraPost("/passthrough/camara/v1/sim-swap/sim-swap/v0/check", {
    phoneNumber,
    maxAge: maxAgeHours,
  });
}

async function checkDeviceSwap(phoneNumber, maxAgeHours = 120) {
  return camaraPost(
    "/passthrough/camara/v1/device-swap/device-swap/v1/check",
    { phoneNumber, maxAge: maxAgeHours }
  );
}

async function verifyNumber(phoneNumber) {
  return camaraPostWithBearer(
    "/passthrough/camara/v1/number-verification/number-verification/v0/verify",
    { phoneNumber }
  );
}

async function verifyLocation(phoneNumber, latitude, longitude, radius = 50000) {
  return camaraPost("/location-verification/v1/verify", {
    device: { phoneNumber },
    area: {
      areaType: "CIRCLE",
      center: { latitude, longitude },
      radius,
    },
  });
}

async function retrieveLocation(phoneNumber, maxAgeSeconds = 60) {
  return camaraPost("/location-retrieval/v0/retrieve", {
    device: { phoneNumber },
    maxAge: maxAgeSeconds,
  });
}

async function checkDeviceReachability(phoneNumber) {
  return camaraPost(
    "/device-status/device-reachability-status/v1/retrieve",
    { device: { phoneNumber } }
  );
}

async function checkDeviceRoaming(phoneNumber) {
  return camaraPost("/device-status/device-roaming-status/v1/retrieve", {
    device: { phoneNumber },
  });
}

/**
 * Turns a raw CAMARA/RapidAPI error (often something like
 * {"message":"Too many requests"} or {"message":"Invalid API key..."})
 * into a short, human-readable phrase — used in the reasoning trace shown
 * to users instead of dumping raw JSON at them.
 *
 * This does NOT hide the failure — the trace still says the check was
 * unavailable and why in plain terms — it just avoids showing a raw
 * API error blob in a user-facing product.
 */
function describeSignalFailure(error) {
  const raw = typeof error === "string" ? error : error?.message || error?.error || "";
  const text = String(raw).toLowerCase();

  if (text.includes("too many requests") || text.includes("rate limit")) {
    return "rate-limited by the network provider right now";
  }
  if (text.includes("invalid api key") || text.includes("unauthorized") || text.includes("bad token")) {
    return "an authentication issue with this signal";
  }
  if (text.includes("timeout") || text.includes("econnrefused") || text.includes("network")) {
    return "a network connectivity issue";
  }
  return "temporarily unavailable";
}

module.exports = {
  checkSimSwap,
  checkDeviceSwap,
  verifyNumber,
  verifyLocation,
  retrieveLocation,
  checkDeviceReachability,
  checkDeviceRoaming,
  describeSignalFailure,
  buildRecruiterAuthorizeUrl,
  exchangeAuthorizationCode,
  verifyNumberWithUserToken,
};