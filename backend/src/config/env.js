require("dotenv").config();

function required(name) {
  const val = process.env[name];
  if (val === undefined || val === "") {
    // eslint-disable-next-line no-console
    console.warn(`[config] Missing env var ${name} — set it in backend/.env`);
  }
  return val;
}

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Owned by Track B (this file), consumed by Track A's camaraClient.js.
  // Filling these in now means Track A can plug in the real API the moment
  // their code is ready — no waiting on you.
  nokia: {
    baseUrl: required("NOKIA_NAC_BASE_URL"),
    apiKey: required("NOKIA_NAC_API_KEY"),
    clientId: required("NOKIA_NAC_CLIENT_ID"),
    clientSecret: required("NOKIA_NAC_CLIENT_SECRET"),
  },

  agent: {
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    model: process.env.AGENT_MODEL || "claude-sonnet-4-5",
  },

  db: {
    url: process.env.DATABASE_URL || "",
  },

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },

  rateLimit: {
    windowMs: Number(process.env.VERIFY_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.VERIFY_RATE_LIMIT_MAX || 10),
  },
};
