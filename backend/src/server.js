// config/env must load first — it's what actually calls dotenv.config().
// app.js pulls in routes -> agent -> camaraClient.js, and camaraClient.js
// reads several CAMARA_* env vars into module-level consts at require time.
// If app.js were required first, camaraClient.js would capture those as
// undefined forever (see camaraClient.js's own dotenv.config() call for the
// second half of this fix).
const env = require("./config/env");
const { createApp } = require("./app");

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`TrustLine backend listening on port ${env.port}`);
});
