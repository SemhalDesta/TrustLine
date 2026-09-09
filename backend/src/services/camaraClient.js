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
// OAuth2 client-credentials token — needed specifically by Number
// Verification, which (unlike SIM Swap/Device Status/etc.) requires an
// actual Authorization: Bearer header on top of the RapidAPI key.
//
// Cached in-memory and refreshed shortly before expiry so we're not
// fetching a new token on every single request.
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

module.exports = {
  checkSimSwap,
  checkDeviceSwap,
  verifyNumber,
  verifyLocation,
  retrieveLocation,
  checkDeviceReachability,
  checkDeviceRoaming,
};