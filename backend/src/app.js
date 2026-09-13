const express = require("express");
const cors = require("cors");

const verifyRoutes = require("./routes/verify");
const ngoRoutes = require("./routes/ngo");
const platformRoutes = require("./routes/platform");
const smsRoutes = require("./routes/sms");
const whatsappRoutes = require("./routes/whatsapp");
const authRoutes = require("./routes/auth");
const recruiterRoutes = require("./routes/recruiter");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded payloads

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/verify", verifyRoutes);
  app.use("/api/ngo", ngoRoutes);
  app.use("/api/platform", platformRoutes);
  app.use("/api/sms", smsRoutes);
  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/recruiter", recruiterRoutes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Unexpected server error" });
  });

  return app;
}

module.exports = { createApp };
