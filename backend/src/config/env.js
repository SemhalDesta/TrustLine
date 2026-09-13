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


  nokia: {
    baseUrl: required("CAMARA_API_BASE_URL"),
    apiKey: required("CAMARA_RAPIDAPI_KEY"),
    clientId: required("CAMARA_CLIENT_ID"),
    clientSecret: required("CAMARA_CLIENT_SECRET"),
  },

  agent: {
    anthropicApiKey: required("GROQ_API_KEY"),
    model: process.env.AGENT_MODEL || "claude-sonnet-4-5",
  },

  db: {
    url: process.env.DATABASE_URL || "",
  },

  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    // Two DIFFERENT sender numbers — Twilio does not let a plain SMS send
    // "from" a WhatsApp sandbox number (whatsapp:+1415...) and vice versa.
    // smsFromNumber must be a real, SMS-capable number on this account
    // (Console -> Phone Numbers). whatsappFromNumber is normally the
    // shared Twilio WhatsApp Sandbox number for testing.
    smsFromNumber: process.env.TWILIO_FROM_NUMBER,
    whatsappFromNumber: process.env.TWILIO_WHATSAPP_FROM,
  },

  rateLimit: {
    windowMs: Number(process.env.VERIFY_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.VERIFY_RATE_LIMIT_MAX || 10),
  },
};
