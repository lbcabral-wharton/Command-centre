# Command Center — Standalone App Spec (Option 3)

**Owner:** Cabral · **Version:** 1.0 · **Date:** 2026-06-07
**Goal:** Turn the Cowork artifact into a real, installable web app at its own URL — Personal, Markets/Finance, and Ventures on one landing page — that works **outside Cowork**, on desktop and phone, refreshed daily.

**Key difference from the artifact:** the artifact borrowed Cowork's Google connectors for Calendar/Gmail. A standalone app can't do that, so it brings its **own Google OAuth**. Everything else (Supabase backend, market refresh job) is reused as-is.

---

## 1. What already exists (reuse, don't rebuild)

The backend is live and stays exactly as is:

- **Supabase project** `command-center` (ref `snrxsnmoaujhzlujmroh`, London, free tier).
- **Schema**: `tasks`, `habits`, `habit_logs`, `holdings`, `prices`, `risk_snapshots`, `risk_settings`, `ventures`, `venture_log`, `daily_brief`, `market_quotes`, plus the `portfolio_live` view. RLS enabled. `owner` defaults to a fixed personal UUID (`a0000000-0000-4000-8000-000000000001`).
- **Edge Function** `market-refresh` (Yahoo Finance) + **`pg_cron`** job `market-refresh-daily` (weekdays 05:00 UTC). No change needed.

The standalone app is a **new frontend** in front of this backend, plus a **Google OAuth integration** to replace the Cowork connectors.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server Components for data fetch, Server Actions for writes. |
| Auth | **Auth.js (NextAuth v5)** with Google provider | Logs you in *and* obtains Google API tokens for Calendar/Gmail. |
| Google APIs | **googleapis** npm SDK | Calendar `events.list`, Gmail `users.threads.list/get`. |
| Data | **Supabase** (`@supabase/supabase-js`) | Server-side reads/writes with the **service role key**; app enforces single-user gate. |
| Styling | Tailwind CSS + shadcn/ui | Same look as the artifact, more components. |
| Charts | Recharts | Market history, allocation later. |
| Hosting | **Vercel** | Auto-deploy from GitHub; env vars hold all secrets. |
| Installable | **PWA** (manifest + service worker, e.g. `next-pwa`) | Gives a home-screen/desktop app icon on phone and Mac. |

---

## 3. Authentication & access model

Single-user app, so keep it simple and secure:

1. **Google sign-in (Auth.js).** On login, request scopes:
   - `openid email profile`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/gmail.readonly`
   Request **offline access** so Google returns a **refresh token** (needed for the daily job and long sessions).
2. **Gate to one identity.** In the Auth.js `signIn` callback, allow only `lbcabral@gmail.com`; reject everyone else. This makes the app effectively private without building multi-tenant auth.
3. **Supabase access.** The Next.js server uses the Supabase **service role key** (server-only, never shipped to the browser) to read/write the single owner's rows. RLS stays on to protect the public API; the server bypasses it intentionally. No Supabase Auth wiring required.
4. **Token storage.** Persist the Google refresh token in a new `google_tokens` table (or Auth.js's DB adapter) so server jobs and SSR can call Google without re-consent.

```sql
-- new table for the app
create table google_tokens (
  owner          uuid primary key default 'a0000000-0000-4000-8000-000000000001'::uuid,
  refresh_token  text not null,
  access_token   text,
  expires_at     timestamptz,
  updated_at     timestamptz default now()
);
alter table google_tokens enable row level security;  -- server uses service role
```

---

## 4. Google Cloud setup (one-time)

1. Create a project in Google Cloud Console.
2. **APIs & Services → Enable**: Google Calendar API, Gmail API.
3. **OAuth consent screen**: External, app name "Command Center", add your email as a **Test user** (keeps it in testing mode — no Google verification needed for personal use), add the Calendar/Gmail read-only scopes.
4. **Credentials → OAuth client ID** (Web application):
   - Authorized origins: `http://localhost:3000`, `https://<your-app>.vercel.app`
   - Redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://<your-app>.vercel.app/api/auth/callback/google`
5. Copy **Client ID** and **Client secret** into env vars (below).

> Testing-mode caveat: Google refresh tokens for unverified apps can expire after ~7 days of inactivity. For a daily-use app that's rarely an issue; if it bites, publish the consent screen (a light review) to remove the limit.

---

## 5. Routes & structure

```
app/
├── api/auth/[...nextauth]/route.ts   ← Auth.js handler
├── layout.tsx                        ← session guard (redirect to login if not Cabral)
├── page.tsx                          ← "/"  LANDING PAGE
├── personal/page.tsx
├── finance/page.tsx
├── ventures/page.tsx
└── actions/                          ← server actions (add task, edit venture, log)
lib/
├── auth.ts                           ← Auth.js config (Google provider, gate, callbacks)
├── google.ts                         ← Calendar + Gmail fetchers (refresh-token aware)
├── supabase.ts                       ← server client (service role)
└── queries.ts                        ← typed Supabase reads
components/                            ← cards, market table, ventures board, charts
public/manifest.webmanifest, icons    ← PWA install
```

Data flow: **Server Components** fetch on render — Supabase reads for Markets/Ventures/Tasks, Google API reads for Calendar/Mail — so nothing sensitive runs client-side. Mutations go through **Server Actions**. Optional client polling or a Reload button for freshness.

---

## 6. Pages (parity with the artifact, then more)

**Landing `/`** — daily brief; today's calendar + tasks due; snapshots for Personal, Markets (S&P headline), Ventures; important-mail follow-ups. Same layout as the artifact.

**Personal `/personal`** — task board (Inbox→Doing→Waiting→Done) with quick capture; habit grid; today/this-week calendar.

**Finance `/finance`** — the full Markets watchlist (Indices / FX / Rates / Commodities) with daily % change and a small history sparkline per instrument (from the `prices`/`market_quotes` history). Room to add a real holdings portfolio + risk panel later (schema already supports it).

**Ventures `/ventures`** — Kanban by stage; venture cards (thesis, next action, stale-flag); append-only log.

---

## 7. Calendar & Gmail (replacing Cowork connectors)

`lib/google.ts` mirrors what the artifact did, but via the Google SDK with your own tokens:

- **Calendar**: `calendar.events.list({ timeMin: now, timeMax: now+7d, singleEvents: true, orderBy: 'startTime' })`.
- **Gmail**: `gmail.users.threads.list({ q: 'is:important in:inbox newer_than:7d' })`, then `threads.get` for subject/sender.
- A helper refreshes the access token from the stored refresh token when expired.

The rendered output is identical to today's panels — same data, different plumbing.

---

## 8. Markets & daily refresh

Unchanged. The existing `market-refresh` Edge Function + `pg_cron` keep `market_quotes` current; the app just reads the table. Optionally add an **on-demand "Refresh now"** button that calls the function from a Server Action.

---

## 9. Environment variables (Vercel + local `.env.local`)

```
# Auth.js
AUTH_SECRET=<random 32+ chars>
AUTH_URL=https://<your-app>.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ALLOWED_EMAIL=lbcabral@gmail.com

# Supabase (server only)
SUPABASE_URL=https://snrxsnmoaujhzlujmroh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — keep secret>
SUPABASE_PROJECT_ID=snrxsnmoaujhzlujmroh
```

The service role key must never be exposed to the browser — it's used only in Server Components/Actions/route handlers.

---

## 10. Installable app (PWA)

Add `manifest.webmanifest` (name, icons, `display: standalone`, theme color) and a service worker (via `next-pwa`). Result: on iPhone "Add to Home Screen" and on Mac/Chrome "Install" give a real app icon that opens chrome-less, like a native app. Offline shows the last-rendered shell; data needs network.

---

## 11. Security checklist

- Single-email gate in the Auth.js `signIn` callback.
- Service role key server-only; never in client bundles or `NEXT_PUBLIC_*`.
- Google scopes are **read-only** (calendar + gmail).
- RLS stays enabled on all tables.
- Refresh token stored server-side (Supabase), not in cookies accessible to JS.
- Vercel project set to your account only; preview deployments protected.

---

## 12. Build phases

**Phase 0 — Scaffold:** `create-next-app` (TS, App Router, Tailwind); add shadcn/ui; deploy a blank shell to Vercel; wire Supabase server client; confirm it reads `market_quotes`.

**Phase 1 — Auth:** Auth.js + Google provider; consent screen + OAuth client; single-email gate; store refresh token; protected layout.

**Phase 2 — Read pages:** build landing + three dashboards as read-only — Markets/Ventures/Tasks from Supabase, Calendar/Mail from Google. Reach parity with the artifact.

**Phase 3 — Writes:** Server Actions for tasks, ventures, habit logs; Kanban drag; quick capture.

**Phase 4 — Polish:** charts/sparklines, "Refresh now", daily-brief panel (reuse `daily_brief` or generate server-side), mobile layout.

**Phase 5 — PWA + ship:** manifest + service worker, icons, install on phone/desktop; final security pass.

---

## 13. What I need from you to start

- **GitHub**: should I scaffold the repo and you connect it to Vercel, or do you want to create the repo?
- **Google Cloud**: you'll create the OAuth client (I'll give exact click-by-click) — or share the Client ID/secret once made and I wire it.
- **App name / URL**: preferred Vercel subdomain (e.g. `cabral-command-center.vercel.app`) or a custom domain.
- **Holdings (optional)**: if you want a real portfolio + risk panel in Finance alongside the watchlist, send tickers/qty/cost basis.

Backend is done; this spec is purely the frontend + Google OAuth layer on top of it. Say go and I'll start Phase 0.
