const express = require("express");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { email: string, password: string, role: "ngo_admin" | "platform_account" }
 *
 * SCOPE NOTE — DEMO-LEVEL AUTH, NOT PRODUCTION SECURITY:
 * There's no PlatformAccount table populated yet, and no password hashing
 * check against real accounts (the schema exists in models/PlatformAccount.js
 * but nothing writes to it). This route issues a valid JWT for the selected
 * role as long as email/password are both non-empty — matching the current
 * frontend's role-selector-driven login UI, which doesn't validate real
 * credentials either.
 *
 * Before any real deployment, replace the body of this handler with:
 *   1. Look up the account by email in platform_accounts
 *   2. bcrypt.compare(password, account.password_hash)
 *   3. Issue the JWT only on success, with the account's real role or org
 */
router.post("/login", (req, res) => {
  const { email, password, role } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (!["ngo_admin", "platform_account"].includes(role)) {
    return res.status(400).json({ error: "role must be 'ngo_admin' or 'platform_account'" });
  }

  const token = jwt.sign({ email, role }, env.jwtSecret, { expiresIn: "8h" });
  res.json({ token, role });
});

module.exports = router;
