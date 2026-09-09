# TrustLine — Frontend

Five static pages, plain HTML/CSS/JavaScript — no build step, no framework,
no bundler. Requires the backend running first (see `backend/README.md`).

## Pages

| File | Auth required? | Purpose |
|---|---|---|
| `verify.html` | No | Public worker-facing flow — enter a number, get a verdict, optionally report it |
| `login.html` | No | Role selector (NGO / Recruitment Platform) + login form |
| `ngo-dashboard.html` | Yes — `ngo_admin` | Review pending reports, verify them, view analytics |
| `platform-dashboard.html` | Yes — `platform_account` | Usage stats, registered numbers, bulk-verify |
| `about.html` | No | Informational / marketing page |

**File names matter.** The pages link to each other by exact filename —
`ngo-dashboard.html` and `platform-dashboard.html` specifically (hyphenated,
lowercase), and `about.html` (not `aboutUs.html`). If you rename any of
these files, update every `href` and redirect that points to them, or the
navigation between pages will 404.

## Running it

```bash
# Terminal 1 — backend must be running first
cd backend && node src/server.js

# Terminal 2 — serve the frontend as static files
cd frontend
python3 -m http.server 8080
```

Open `http://localhost:8080/verify.html` (no login needed) or
`http://localhost:8080/login.html` to reach the dashboards.

## Configuration

Each page has its own `API_BASE` constant near the top of its `<script>`
block:
```js
const API_BASE = "http://localhost:4000/api";
```
Change this in all five files if your backend runs somewhere other than
`localhost:4000`.

## Authentication flow

`login.html` calls `POST /api/auth/login` and stores the response in
`localStorage`:
```js
localStorage.setItem("trustline_token", data.token);
localStorage.setItem("trustline_role", data.role);
```

`ngo-dashboard.html` and `platform-dashboard.html` each read this on load,
redirect to `login.html` if there's no valid token for the right role, and
attach it as `Authorization: Bearer <token>` on every API call. The "Log
out" link on both dashboards clears these two keys.

`verify.html` and `about.html` are intentionally public — no auth guard.

## The "demo data" indicator

`verify.html` has a visible **"⚠ DEMO DATA — backend unreachable"** badge
that appears only when a real API call fails and the page falls back to
local mock data. If you see this badge, the frontend isn't the problem —
check that the backend is actually running and reachable at the `API_BASE`
configured above.

## Known limitations

- **No signup/account-creation flow.** Matches the backend's current
  scope — see `backend/README.md`'s note on the login stub. The "Don't
  have access yet?" link on the login page reflects the intended real-world
  model (manual partner onboarding), not a missing feature.
- **The recruitment-platform bulk-verify** and **NGO logs/analytics** views
  are backed by real audit-log data, but there's no data model yet linking
  a specific platform account to "its" numbers — every account currently
  sees the same shared global activity.
- **No multi-language support** in this version of the frontend.