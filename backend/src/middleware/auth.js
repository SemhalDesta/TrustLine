const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Guards NGO and recruitment-platform routes. The public worker-facing
 * /verify endpoint deliberately does NOT use this — it must stay anonymous
 * and frictionless.
 */
function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = { requireAuth };
