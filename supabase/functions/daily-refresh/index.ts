// ============================================================
// Command Center — daily-refresh Edge Function (Deno / Supabase)
// Runs each weekday morning (triggered by pg_cron, see schema.sql).
// 1. Pull latest close prices for every held ticker
// 2. Compute portfolio value + risk metrics, write a risk_snapshot
// 3. Generate the landing-page daily brief
//
// Secrets needed (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MARKET_API_KEY
//   OWNER_ID  (your auth user id — single-user app)
//   OPENAI_API_KEY or ANTHROPIC_API_KEY (optional, for the AI brief)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role bypasses RLS for the job
);
const OWNER = Deno.env.get("OWNER_ID")!;
const MARKET_API_KEY = Deno.env.get("MARKET_API_KEY")!;

// ---- 1. fetch a daily quote (swap for your provider of choice) ----
async function fetchQuote(ticker: string): Promise<{ close: number; prevClose: number }> {
  // Example shape — replace URL/parsing with your market-data API.
  const r = await fetch(
    `https://api.example-market.com/quote?symbol=${ticker}&token=${MARKET_API_KEY}`,
  );
  const j = await r.json();
  return { close: Number(j.c), prevClose: Number(j.pc) };
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);

  // ---- holdings + risk settings ----
  const { data: holdings } = await supabase
    .from("holdings").select("*").eq("owner", OWNER);
  const { data: settings } = await supabase
    .from("risk_settings").select("*").eq("owner", OWNER).single();

  if (!holdings?.length) return new Response("no holdings", { status: 200 });

  // ---- 1. prices ----
  for (const h of holdings) {
    try {
      const q = await fetchQuote(h.ticker);
      await supabase.from("prices").upsert(
        { owner: OWNER, ticker: h.ticker, price_date: today, close: q.close, prev_close: q.prevClose },
        { onConflict: "owner,ticker,price_date" },
      );
    } catch (e) { console.error("quote failed", h.ticker, e); }
  }

  // ---- 2. compute portfolio + risk ----
  const { data: live } = await supabase
    .from("portfolio_live").select("*").eq("owner", OWNER);

  const totalValue = live!.reduce((s, p) => s + Number(p.market_value ?? 0), 0);
  const dayPl      = live!.reduce((s, p) => s + Number(p.day_pl ?? 0), 0);
  const cashValue  = live!.filter(p => p.asset_class === "cash")
                          .reduce((s, p) => s + Number(p.market_value ?? 0), 0);

  const weights = live!
    .map(p => ({ ticker: p.ticker, w: Number(p.market_value ?? 0) / totalValue }))
    .sort((a, b) => b.w - a.w);
  const largest    = weights[0];
  const top5Weight = weights.slice(0, 5).reduce((s, x) => s + x.w, 0);
  const cashPct    = cashValue / totalValue;

  // running peak / drawdown from prior snapshots
  const { data: prior } = await supabase
    .from("risk_snapshots").select("peak_value")
    .eq("owner", OWNER).order("snapshot_date", { ascending: false }).limit(1);
  const peak = Math.max(totalValue, Number(prior?.[0]?.peak_value ?? totalValue));
  const drawdown = (totalValue - peak) / peak;

  // ---- flags vs. limits ----
  const flags: string[] = [];
  if (largest && largest.w > Number(settings.max_position_pct)) flags.push(`concentration:${largest.ticker}`);
  if (top5Weight > Number(settings.max_top5_pct))               flags.push("top5_concentration");
  if (drawdown < -Number(settings.max_drawdown_pct))            flags.push("drawdown_breach");
  if (cashPct < Number(settings.min_cash_pct))                  flags.push("low_cash");
  for (const p of live!) {
    if (p.target_weight) {
      const w = Number(p.market_value ?? 0) / totalValue;
      if (Math.abs(w - Number(p.target_weight)) > Number(settings.rebalance_band))
        flags.push(`rebalance:${p.ticker}`);
    }
  }

  await supabase.from("risk_snapshots").upsert({
    owner: OWNER, snapshot_date: today,
    total_value: totalValue, day_pl: dayPl,
    day_pl_pct: totalValue ? dayPl / (totalValue - dayPl) : 0,
    cash_pct: cashPct, largest_position: largest?.ticker, largest_weight: largest?.w,
    top5_weight: top5Weight, peak_value: peak, drawdown_pct: drawdown, flags,
  }, { onConflict: "owner,snapshot_date" });

  // ---- 3. daily brief (cross-section) ----
  const { data: dueTasks } = await supabase
    .from("tasks").select("title,priority").eq("owner", OWNER)
    .neq("status", "done").lte("due_date", today);
  const { data: staleVentures } = await supabase
    .from("ventures").select("name,next_action")
    .eq("owner", OWNER).in("stage", ["validating", "building", "active"])
    .lt("last_update", new Date(Date.now() - 7 * 864e5).toISOString());

  const summary =
    `Portfolio ${totalValue.toLocaleString(undefined,{style:"currency",currency:"USD"})} ` +
    `(${dayPl >= 0 ? "+" : ""}${(100*dayPl/(totalValue-dayPl)).toFixed(2)}% today). ` +
    `${flags.length ? `Risk flags: ${flags.join(", ")}. ` : "No risk flags. "}` +
    `${dueTasks?.length ?? 0} task(s) due/overdue. ` +
    `${staleVentures?.length ? `Ventures needing attention: ${staleVentures.map(v=>v.name).join(", ")}.` : "Ventures on track."}`;

  // Optional: replace `summary` with an LLM-written narrative here.

  await supabase.from("daily_brief").upsert({
    owner: OWNER, brief_date: today, summary,
    flags: [
      ...flags.map(f => ({ type: "finance", item: f })),
      ...(dueTasks ?? []).filter(t => t.priority === "high").map(t => ({ type: "task", item: t.title })),
      ...(staleVentures ?? []).map(v => ({ type: "venture", item: v.name })),
    ],
  }, { onConflict: "owner,brief_date" });

  return new Response(JSON.stringify({ ok: true, totalValue, flags }), {
    headers: { "Content-Type": "application/json" },
  });
});
