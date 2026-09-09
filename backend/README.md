# TrustLine — Backend

AI agent backend that orchestrates GSMA Open Gateway CAMARA APIs (via Nokia
Network-as-Code) to verify recruiter phone numbers and produce an
explainable fraud-risk verdict for migrant workers in the MENA region.

Built for the MENA Ignite Hackathon — Theme 1: Trusted Digital Identity &
Cross-Border Verification.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values — see below
node src/server.js
```

Confirm it's running:
```bash
curl http://localhost:4000/health
# {"status":"ok"}
```

## Environment variables

```dotenv
PORT=4000

# Nokia Network-as-Code (CAMARA APIs) — get these at networkascode.nokia.io
CAMARA_API_BASE_URL=
CAMARA_RAPIDAPI_KEY=

# Number Verification specifically needs its own OAuth2 client-credentials
# setup, separate from the RapidAPI key above — check the Number
# Verification API's page on your Nokia dashboard for these three values
CAMARA_TOKEN_URL=
CAMARA_CLIENT_ID=
CAMARA_CLIENT_SECRET=
CAMARA_BEARER_TOKEN=          # optional — a static token instead of the above, if your dashboard gives you one directly

# AI reasoning step
GROQ_API_KEY=

# Leave blank to use in-memory storage (fine for local dev/demo — this is
# what all development and testing has used). Only set this if you have a
# real Postgres instance ready; a bad connection string will break the
# database cross-check with a real (not silent) error.
DATABASE_URL=

JWT_SECRET=some-long-random-string

# Optional — SMS/USSD channel falls back to a console-log mock if these
# aren't set or aren't shaped like real Twilio credentials (a real Account
# SID always starts with "AC")
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

## Architecture

Two workstreams meet at one file:

```
Worker submits a phone number
  -> POST /api/verify
  -> agent/index.js  (the bridge/seam between the two tracks below)
  -> LangGraph agent:
       intake
         -> parallel: simSwapCheck, deviceSwapCheck
         -> triage (escalate only if signals disagree or are unavailable)
         -> [if escalated] dbCrossCheck, deviceReachabilityCheck,
            deviceRoamingCheck, locationVerificationCheck
         -> synthesize (Groq LLM reasoning, with a rule-based fallback)
  -> explainable verdict returned to the caller
```

- **AI Agent** (`src/agent/`, `src/services/camaraClient.js`) — the LangGraph
  reasoning graph and all direct CAMARA API calls.
- **Platform & Integrations** (`src/routes/`, `src/middleware/`,
  `src/models/`, `src/config/`, `src/services/dbService.js`,
  `src/services/smsService.js`) — the Express API layer, auth, rate
  limiting, database, and SMS channel.

`src/agent/index.js` is the seam: it wraps the LangGraph graph and returns a
fixed contract shape so the route layer never has to know about the graph's
internal state:

```json
{
  "phoneNumber": "+971...",
  "escalated": true,
  "verdict": { "riskLevel": "HIGH", "reasoning": "...", "signalsUsed": [...] },
  "reasoningTrace": [{ "step": "intake", "detail": "...", "timestamp": "..." }]
}
```

## API reference

| Method & Path | Auth | Purpose |
|---|---|---|
| `POST /api/verify` | None | Runs the full agent, returns a verdict |
| `POST /api/verify/report` | None | Worker reports a scam number |
| `POST /api/auth/login` | None | Issues a JWT for a selected role (see Known Limitations) |
| `GET /api/ngo/reports/pending` | JWT — `ngo_admin` | Worker-submitted reports awaiting review |
| `POST /api/ngo/reports/:phoneNumber/verify` | JWT — `ngo_admin` | Marks a report as NGO-verified |
| `GET /api/ngo/logs?limit=50` | JWT — `ngo_admin` | Recent verification audit log |
| `GET /api/ngo/analytics/summary` | JWT — `ngo_admin` | Aggregate check volume / risk breakdown |
| `GET /api/platform/usage` | JWT — `platform_account` | Usage summary from the audit log |
| `GET /api/platform/numbers` | JWT — `platform_account` | Recently checked numbers + status |
| `POST /api/platform/bulk-verify` | JWT — `platform_account` | Verifies up to 50 numbers at once |
| `GET /api/platform/badge/:phoneNumber` | JWT — `platform_account` | Badge eligibility check |
| `POST /api/sms/incoming` | Twilio webhook | SMS/USSD channel (mock mode without real Twilio creds) |

## Testing

Three standalone scripts, meant to be run in this order:

```bash
node test-camara.js +9999991000    # tests each CAMARA API call in isolation
node test-agent.js +9999991000     # tests the full agent end-to-end
bash test-http.sh                  # tests the real HTTP routes (requires the server running)
```

`test-camara.js` reads its keys from `.env` directly — no need to prefix
the command with inline environment variables.

## Known limitations

- **CAMARA rate limits**: the current RapidAPI tier gets exhausted under
  repeated testing, causing intermittent `"Too many requests"` / `"Invalid
  API key"` errors that can land on any of SIM Swap, Device Swap, Device
  Reachability, or Device Roaming — these are believed to be one root cause
  (quota exhaustion) rather than four separate bugs, based on the errors
  moving between endpoints across runs.
- **Number Verification is implemented but not wired into the live graph.**
  It requires a three-legged OAuth flow that must originate from the end
  user's mobile device over real cellular data (the carrier correlates the
  request's IP against the SIM), which a backend-only call can't satisfy —
  unlike the other six CAMARA APIs. Treated as a designed extension point,
  not a bug.
- **Login is a demo-level stub.** `POST /api/auth/login` issues a real,
  fully-functional JWT for any non-empty email/password — there's no
  account table populated yet. This matches the product's intended
  real-world model (manual partner onboarding, not public signup).
- **Storage defaults to in-memory.** Leave `DATABASE_URL` blank unless you
  have a real Postgres instance ready — a bad connection string produces a
  real (visible) connection error rather than silently working.
- **AI provider (Groq)** has not yet been confirmed against the
  hackathon's approved AI Resource & Tooling Guide.