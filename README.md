# TrustLine

AI-powered recruitment verification to stop labor scams in MENA.

Built for the **MENA Ignite Hackathon** — Theme 1: *Trusted Digital Identity
& Cross-Border Verification*.

## The problem

Migrant workers across South Asia and Africa lose money — sometimes their
life savings — to fraudulent recruitment agents promising jobs in the Gulf,
typically operating through disposable phone numbers on WhatsApp. Workers
have no reliable way to check whether a recruiter is legitimate before
paying a fee or accepting an offer.

## The solution

A worker enters a recruiter's phone number and gets back an instant,
plain-language risk verdict — powered by live telecom network signals a
scammer can't fake, reasoned over by an AI agent rather than a simple
pass/fail rule.

```
Worker enters a phone number
        │
        ▼
   AI Agent (LangGraph)
        │
        ├── SIM Swap ──────────────┐
        ├── Device Swap ───────────┤  parallel CAMARA API calls
        │                          │  via Nokia Network-as-Code
        ▼                          │
     Triage ◄──────────────────────┘
        │
        │ (escalates only if signals disagree or are unavailable)
        ▼
  DB cross-check, Device Reachability,
  Device Roaming, Location Verification
        │
        ▼
   AI reasoning (Groq LLM, with a rule-based fallback)
        │
        ▼
   Explainable verdict: LOW / MEDIUM / HIGH + plain-language reasoning
```

## Repo structure

```
TrustLine/
├── backend/     → Express API + LangGraph AI agent. See backend/README.md
└── frontend/    → 5 static HTML/CSS/JS pages, no build step. See frontend/README.md
```

## Quick start

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env   # fill in real API keys — see backend/README.md
node src/server.js

# Terminal 2 — frontend
cd frontend
python3 -m http.server 8080
```

Open `http://localhost:8080/verify.html` — no login needed for the core
worker-facing flow. Full setup details, environment variables, and the API
reference live in the two README files linked above.

## What's working today

- A worker can enter a phone number and get a real AI-generated risk
  verdict with plain-language reasoning
- The AI agent makes a genuine routing decision — it escalates to
  additional signals only when the initial checks disagree or fail, not on
  a fixed schedule
- Six of seven CAMARA APIs are integrated: SIM Swap, Device Swap, Device
  Reachability, Device Roaming, Location Verification, and an independent
  scam-report database cross-check
- The agent degrades gracefully under real API failures — it still returns
  a coherent, reasoned verdict rather than crashing
- Worker scam-reporting, plus authenticated NGO and recruitment-platform
  dashboards (report review, analytics, bulk verification)

## Known limitations

- **CAMARA API rate limits** — the current tier gets exhausted under
  repeated use, causing intermittent failures across four of the six live
  APIs. The agent still produces a valid verdict when this happens.
- **Number Verification is implemented but not wired into the live
  graph** — it requires a three-legged OAuth flow that must originate from
  the end user's mobile device over real cellular data, which isn't
  achievable the same way as the other six backend-only integrations.
  Treated as a designed extension point.
- **Login is a demo-level stub** — any non-empty email/password succeeds,
  since no account table is populated. This matches the product's intended
  real-world model of manual partner onboarding rather than public signup.
- **Storage defaults to in-memory** — a real Postgres instance is
  supported but optional; nothing about the demo requires it.

See `backend/README.md` and `frontend/README.md` for full detail on each.

## Team

Built across two parallel tracks against an agreed interface contract, so
neither side blocked on the other:

- **AI Agent** — the LangGraph reasoning graph and CAMARA API integration
- **Platform & Integrations** — the Express API layer, auth, database, SMS
  channel, and frontend integration

## Tech stack

Node.js / Express, LangGraph, Groq (LLM reasoning), GSMA Open Gateway
CAMARA APIs via Nokia Network-as-Code, PostgreSQL (optional), Twilio
(optional), plain HTML/CSS/JavaScript frontend.