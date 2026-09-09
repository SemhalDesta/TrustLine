const { Pool } = require("pg");
const env = require("./env");

// Leave DATABASE_URL unset in .env for local dev — dbService.js falls back
// to an in-memory store so you're never blocked waiting on a real Postgres
// instance to build/test your routes.
let pool = null;

if (env.db.url) {
  pool = new Pool({ connectionString: env.db.url });
  pool.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[db] Unexpected Postgres error", err);
  });
}

module.exports = {
  pool,
  isConfigured: Boolean(pool),
};
