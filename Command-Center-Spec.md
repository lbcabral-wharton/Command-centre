# Command Center — Build Spec (Supabase + Next.js)

**Owner:** Cabral · **Version:** 2.0 · **Date:** 2026-06-07
**Goal:** One custom web app to run all personal + professional activity. A landing page surfaces the most important items from three sections — **Personal**, **Finance** (portfolio + risk), and **Ventures** — each with its own dashboard, refreshed automatically every day.

**Architecture decision:** pure **Supabase backend + custom Next.js web app**. Supabase is the single source of truth (Postgres) plus auth, API, storage, and the server-side daily job. Next.js on Vercel is the cockpit you actually look at.

---

## 1. Stack

| Layer | Tool | Role |
|---|---|---|
| **Database** | Supabase Postgres | Single source of truth: tasks, holdings, prices, risk snapshots, ventures, daily brief. |
| **Auth** | Supabase Auth | Login (just you). Row-level security locks every row to your user id. |
| **API** | Supabase auto REST + Realtime | Tables exposed as a secure API; dashboards subscribe to live updates. |
| **Daily job** | Supabase Edge Function + `pg_cron` | Each weekday morning: pull prices, compute risk, write the brief. No external glue. |
| **Storage** | Supabase Storage | Files/attachments per venture. |
| **Frontend** | **Next.js (App Router) + React + TypeScript** | The command center UI: landing page + 3 dashboards. |
| **Styling/UI** | Tailwind CSS + shadcn/ui | Clean, fast component layer. |
| **Charts** | Recharts (or Tremor) | Portfolio value, allocation, drawdown, performance. |
| **Hosting** | Vercel | Deploys the Next.js app; env vars hold Supabase keys. |
| **Market data** | A stock-quote API (called only from the Edge Function) | Daily closes feed the `prices` table. |
| **AI brief (optional)** | LLM call inside the Edge Function | Turns the day's data into a 3–5 line narrative. |

**Why this fits you:** you don't use Obsidian, and your data-heavy part is Finance/risk — exactly where a real Postgres database beats notes or spreadsheets (time-series prices, risk history, relational queries). One account, one app, multi-device for free.

---

## 2. Data model

Full SQL is in **`supabase/schema.sql`**. Tables:

- **Personal:** `tasks`, `habits`, `habit_logs`
- **Finance:** `holdings`, `prices` (daily time series), `risk_snapshots` (one per day), `risk_settings` (your limits)
- **Ventures:** `ventures`, `venture_log`
- **Landing:** `daily_brief` (written each morning)
- **View:** `portfolio_live` — joins holdings to the latest price for live value, day P/L, total P/L, weights.

Every table has **row-level security** so only your authenticated user can read/write its rows. A single generic owner policy is applied to all tables in the schema file.

---

## 3. App routes (Next.js App Router)

```
app/
├── (auth)/login/             ← Supabase Auth UI
├── page.tsx                  ← "/"  LANDING PAGE
├── personal/page.tsx         ← Personal dashboard
├── finance/page.tsx          ← Finance dashboard
├── ventures/page.tsx         ← Ventures dashboard
├── api/                      ← server actions / route handlers (mutations)
└── components/               ← cards, tables, charts, snapshot widgets
lib/
├── supabase/                 ← server + browser clients
└── queries.ts                ← typed data fetchers
supabase/
├── schema.sql                ← database (this repo)
└── functions/daily-refresh/  ← the morning Edge Function
```

Data fetching: **Server Components** read via the Supabase server client for initial render; **Realtime** subscriptions on the client keep cards live without refresh. Mutations (add task, edit holding, log venture) go through server actions.

---

## 4. Landing page ("/")

Top to bottom — the whole picture in 10 seconds:

1. **Daily brief** — the latest `daily_brief.summary` (auto-written each morning) + cross-section `flags`.
2. **Today** — today's tasks (due/overdue) and habits to check off.
3. **Personal snapshot** — open high-priority count, top habit streak, next priority. Links to `/personal`.
4. **Finance snapshot** — portfolio total value, day P/L %, top risk flag (from latest `risk_snapshots`). Links to `/finance`.
5. **Ventures snapshot** — active ventures with `next_action` + date; flag any stale >7 days. Links to `/ventures`.
6. **Flags & follow-ups** — everything `priority: high` and not done, across sections.

Each snapshot is a small server query + a Realtime subscription so it stays current.

---

## 5. Section dashboards

### 5.1 Personal — `/personal`
- **Today / week:** tasks grouped by day; habit check-off grid.
- **Task board:** columns Inbox → Doing → Waiting → Done (drag to change `status`), filter by `area`.
- **Habits:** weekly grid from `habit_logs`, streak counts.
- **Quick capture:** add-task input always visible.

### 5.2 Finance — `/finance` (portfolio + risk)
- **Portfolio table** (from `portfolio_live`): ticker, qty, cost basis, price, market value, weight %, day P/L, total return; totals row.
- **Allocation charts:** by asset class / sector / geography (pie or bar) — surfaces concentration.
- **Performance:** `risk_snapshots.total_value` over time vs. an optional benchmark; MTD / YTD.
- **Risk panel** (latest `risk_snapshots`): largest position % and top-5 weight vs. your limits; current drawdown vs. limit; cash %; rebalancing flags when weights drift past `rebalance_band`. Breaches shown in red.
- **Settings:** edit `risk_settings` (max position %, top-5 %, max drawdown, min cash, rebalance band).

### 5.3 Ventures — `/ventures`
- **Pipeline (Kanban):** columns by `stage` (Idea → Validating → Building → Active → Paused/Killed), drag to move.
- **Venture card:** thesis, priority, next action + date, invested, links, last update.
- **Momentum flags:** active venture with no update in 7+ days, or overdue `next_action_date`.
- **Log:** append-only `venture_log` entries per venture.

---

## 6. Daily refresh

Server-side, no manual step. Full code in **`supabase/functions/daily-refresh/index.ts`**.

1. **`pg_cron` fires** the `daily-refresh` Edge Function every weekday at 06:00 (schedule block at the bottom of `schema.sql`).
2. The function: pulls the latest close for each held ticker → upserts `prices`; recomputes total value, day P/L, weights, top-5, cash %, peak/drawdown → writes a `risk_snapshots` row; evaluates **flags** against `risk_settings`; assembles the **daily brief** (portfolio move + flags + tasks due + stale ventures) → upserts `daily_brief`.
3. **You open the app** → landing + dashboards render the fresh data; Realtime keeps them live through the day as you edit.

The brief is rule-based out of the box; drop in an LLM call inside the function for a natural-language narrative (hook noted in the code).

---

## 7. Build phases

**Phase 0 — Provision:** create Supabase project; run `schema.sql`; create your auth user; insert your `risk_settings` row. Create the Next.js app, connect Supabase env vars, deploy a blank shell to Vercel.

**Phase 1 — Read path:** Supabase clients + typed queries; build the landing page and three dashboards as read-only views over seed data.

**Phase 2 — Write path:** server actions for tasks, holdings, ventures, habit logs; quick-capture and Kanban drag.

**Phase 3 — Finance engine:** load real holdings; wire the market-data API; deploy the Edge Function; schedule `pg_cron`; verify a full morning run writes prices + snapshot + brief.

**Phase 4 — Polish:** charts, Realtime subscriptions, risk-flag styling, mobile layout, auth hardening.

---

## 8. What I need from you to start building

- **Market-data provider:** do you have a preferred stock API, or should I pick a free one and code against it?
- **Risk limits:** confirm defaults (max single position 10%, top-5 40%, max drawdown 15%, min cash 5%) or give me yours.
- **AI brief:** plain rule-based summary, or wire in an LLM for a written narrative?
- **Seed data:** want to hand me your current holdings (ticker, qty, cost basis) so Finance is live from day one?

Files in this folder:
- `Command-Center-Spec.md` (this doc)
- `supabase/schema.sql` — database + RLS + cron
- `supabase/functions/daily-refresh/index.ts` — daily job

Give me the four answers above and I'll scaffold the Next.js app and the Supabase project structure next.
