// backend/api/index.js
//
// Vercel serverless entry point. Exports the same Express app server.js
// runs locally, minus the app.listen() call — Vercel invokes this as a
// request handler directly, it doesn't need (or want) a bound port.
//
// IMPORTANT: this app was built assuming a long-lived process with
// in-memory storage (see src/services/dbService.js — audit logs, pending
// reports, verified-recruiter status all live in a JS Map by default,
// used whenever DATABASE_URL isn't set). On Vercel, each serverless
// invocation may run in a fresh, isolated container — that in-memory
// state is NOT guaranteed to persist between requests, or to be shared
// across concurrent requests hitting different instances. It often
// appears to work within one "warm" session, but don't rely on it for
// anything that must survive reliably. Set a real DATABASE_URL (Postgres)
// in this project's Vercel environment variables to fix this properly.
const { createApp } = require("../src/app");

module.exports = createApp();
