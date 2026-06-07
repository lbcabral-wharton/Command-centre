import { supabaseAdmin, OWNER } from "./supabase";

// ── Market quotes ─────────────────────────────────────────────
export type MarketQuote = {
  symbol: string;
  name: string;
  category: string;
  price: number;
  prev_close: number | null;
  change_pct: number | null;
  currency: string;
  updated_at: string;
};

export async function getMarketQuotes(): Promise<MarketQuote[]> {
  const { data, error } = await supabaseAdmin
    .from("market_quotes")
    .select("*")
    .order("category")
    .order("name");

  if (error) {
    console.error("getMarketQuotes error:", error);
    return [];
  }
  return data ?? [];
}

// ── Tasks ─────────────────────────────────────────────────────
export type Task = {
  id: string;
  title: string;
  status: "inbox" | "doing" | "waiting" | "done";
  area: string;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  notes: string | null;
  done_at: string | null;
  created_at: string;
};

export async function getTasks(status?: Task["status"]): Promise<Task[]> {
  let query = supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("owner", OWNER)
    .order("priority", { ascending: false })
    .order("created_at");

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("getTasks error:", error);
    return [];
  }
  return data ?? [];
}

// ── Habits ────────────────────────────────────────────────────
export type Habit = {
  id: string;
  name: string;
  cadence: string;
  active: boolean;
};

export type HabitLog = {
  habit_id: string;
  log_date: string;
  done: boolean;
};

export async function getHabits(): Promise<Habit[]> {
  const { data, error } = await supabaseAdmin
    .from("habits")
    .select("*")
    .eq("owner", OWNER)
    .eq("active", true)
    .order("name");
  if (error) return [];
  return data ?? [];
}

export async function getHabitLogs(daysBack = 30): Promise<HabitLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const { data, error } = await supabaseAdmin
    .from("habit_logs")
    .select("habit_id, log_date, done")
    .eq("owner", OWNER)
    .gte("log_date", since.toISOString().split("T")[0])
    .order("log_date");
  if (error) return [];
  return data ?? [];
}

// ── Ventures ──────────────────────────────────────────────────
export type Venture = {
  id: string;
  name: string;
  thesis: string | null;
  stage: string;
  priority: string;
  next_action: string | null;
  next_action_date: string | null;
  invested: number | null;
  last_update: string;
  created_at: string;
};

export async function getVentures(): Promise<Venture[]> {
  const { data, error } = await supabaseAdmin
    .from("ventures")
    .select("*")
    .eq("owner", OWNER)
    .neq("stage", "killed")
    .order("last_update", { ascending: false });
  if (error) return [];
  return data ?? [];
}

// ── Daily brief ───────────────────────────────────────────────
export async function getDailyBrief() {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabaseAdmin
    .from("daily_brief")
    .select("*")
    .eq("owner", OWNER)
    .eq("brief_date", today)
    .single();
  return data ?? null;
}
