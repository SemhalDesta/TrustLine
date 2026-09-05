const axios = require("axios");

const CAMARA_RAPIDAPI_KEY = process.env.CAMARA_RAPIDAPI_KEY;
const CAMARA_HOSTNAME = "network-as-code.p-eu.apihub.nokia.io";
const CAMARA_HOST_HEADER = "network-as-code.nokia.rapidapi.com";
const CAMARA_BASE_URL = `https://${CAMARA_HOSTNAME}`;

function camaraHeaders() {
  return {
    "x-rapidapi-key": CAMARA_RAPIDAPI_KEY,
    "x-rapidapi-host": CAMARA_HOST_HEADER,
    "Content-Type": "application/json",
  };
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
  return camaraPost(
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