const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/** Prevents hammering the Nokia sandbox / AI model with repeat requests. */
const verifyRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many verification requests. Please wait a moment and try again.",
  },
});

module.exports = { verifyRateLimiter };
