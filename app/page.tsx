import { getMarketQuotes, getTasks, getVentures, getDailyBrief } from "@/lib/queries";
import { getUpcomingEvents, getImportantThreads } from "@/lib/google";
import { fmt, fmtPct, changeColor, formatEventTime } from "@/lib/utils";
import {
  CalendarDays,
  CheckSquare,
  Rocket,
  TrendingUp,
  Mail,
  Sparkles,
  ArrowUpRight,
  PieChart as PieIcon,
} from "lucide-react";
import { OverviewDonut } from "@/components/overview-donut";

export const revalidate = 300; // revalidate every 5 minutes

export default async function HomePage() {
  const [quotes, tasks, ventures, brief, events, mail] = await Promise.allSettled([
    getMarketQuotes(),
    getTasks("inbox"),
    getVentures(),
    getDailyBrief(),
    getUpcomingEvents(3),
    getImportantThreads(5),
  ]);

  const mq = quotes.status === "fulfilled" ? quotes.value : [];
  const activeTasks = tasks.status === "fulfilled" ? tasks.value.slice(0, 5) : [];
  const activeVentures = ventures.status === "fulfilled" ? ventures.value.slice(0, 4) : [];
  const dailyBrief = brief.status === "fulfilled" ? brief.value : null;
  const calEvents = events.status === "fulfilled" ? events.value.slice(0, 5) : [];
  const threads = mail.status === "fulfilled" ? mail.value.slice(0, 4) : [];

  // Key market instruments for the landing snapshot.
  // Filter by stable symbols (labels drift, e.g. "NASDAQ Composite"), and
  // preserve this curated order regardless of DB sort.
  const KEY_SYMBOLS = ["^GSPC", "^IXIC", "EURUSD=X", "GBPUSD=X", "GC=F", "BZ=F"];
  const keyIndices = KEY_SYMBOLS.map((sym) => mq.find((q) => q.symbol === sym)).filter(
    (q): q is (typeof mq)[number] => q != null
  );

  // KPI strip data
  const sp500 = mq.find((q) => q.label === "S&P 500");
  const allTasks = tasks.status === "fulfilled" ? tasks.value : [];
  const todayStr = new Date().toISOString().split("T")[0];
  const tasksDueToday = allTasks.filter((t) => t.due_date === todayStr).length;
  // Next event: only events that haven't started yet. getUpcomingEvents filters
  // by end time, so in-progress events (with a past start) can slip through.
  const now = Date.now();
  const upcomingEvents = calEvents.filter((e) => {
    if (!e.start) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(e.start)) return e.start >= todayStr; // all-day
    return new Date(e.start).getTime() >= now;
  });
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  const staleVentures = ventures.status === "fulfilled"
    ? ventures.value.filter((v) => {
        const days = (Date.now() - new Date(v.last_update).getTime()) / (1000 * 60 * 60 * 24);
        return days > 30 && v.stage !== "paused";
      }).length
    : 0;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const allVentures = ventures.status === "fulfilled" ? ventures.value : [];

  // Status banner text: use the stored daily brief, else build a quick summary.
  const briefText =
    dailyBrief?.summary ??
    `You have ${
      tasksDueToday === 0 ? "nothing" : `${tasksDueToday} task${tasksDueToday === 1 ? "" : "s"}`
    } due today${
      nextEvent ? `, and "${nextEvent.summary}" is next on your calendar` : ""
    }. ${
      staleVentures > 0
        ? `${staleVentures} venture${staleVentures === 1 ? "" : "s"} need a nudge.`
        : "Ventures are all up to date."
    }`;

  // Category cards (link to each section with a live count).
  const categories = [
    {
      href: "/personal",
      title: "Personal",
      desc: "Tasks, habits & your week.",
      count: `${allTasks.length} in inbox`,
      icon: CheckSquare,
      bg: "var(--cat-sage)",
    },
    {
      href: "/finance",
      title: "Finance",
      desc: "Markets watchlist & trends.",
      count: `${mq.length} instruments`,
      icon: TrendingUp,
      bg: "var(--cat-blue)",
    },
    {
      href: "/ventures",
      title: "Ventures",
      desc: "Pipeline & next actions.",
      count: `${allVentures.length} ventures`,
      icon: Rocket,
      bg: "var(--cat-cream)",
    },
    {
      href: "/personal",
      title: "Calendar",
      desc: "What's coming up next.",
      count: `${calEvents.length} upcoming`,
      icon: CalendarDays,
      bg: "var(--cat-stone)",
    },
  ];

  // Ventures-by-stage donut.
  const STAGE_META = [
    { key: "idea", label: "Idea", color: "#3b82f6" },
    { key: "validating", label: "Validating", color: "#8b5cf6" },
    { key: "building", label: "Building", color: "#f59e0b" },
    { key: "active", label: "Active", color: "#10b981" },
    { key: "paused", label: "Paused", color: "#9ca3af" },
  ];
  const stageBreakdown = STAGE_META.map((s) => ({
    label: s.label,
    value: allVentures.filter((v) => v.stage === s.key).length,
    color: s.color,
  })).filter((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Good morning, Cabral</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
      </div>

      {/* Status banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-[hsl(252_60%_95%)] to-[hsl(28_60%_94%)] p-5 flex items-start gap-4">
        <div className="rounded-xl bg-card/70 p-2.5 flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary mb-1">
            Today&apos;s brief
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">{briefText}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* S&P 500 */}
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1 card-hover">
          <p className="text-xs text-muted-foreground">S&P 500</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
            {sp500 ? fmt(sp500.price, 0) : "—"}
          </p>
          <p className={`text-xs font-mono tabular-nums ${changeColor(sp500?.change_pct ?? null)}`}>
            {sp500 ? fmtPct(sp500.change_pct) : "—"} today
          </p>
        </div>

        {/* Tasks due today */}
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1 card-hover">
          <p className="text-xs text-muted-foreground">Tasks due today</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
            {tasksDueToday}
          </p>
          <p className="text-xs text-muted-foreground">
            {tasksDueToday === 0 ? "All clear" : tasksDueToday === 1 ? "1 task" : `${tasksDueToday} tasks`}
          </p>
        </div>

        {/* Next event */}
        <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1 card-hover">
          <p className="text-xs text-muted-foreground">Next event</p>
          <p className="text-sm font-medium text-foreground leading-tight truncate">
            {nextEvent ? nextEvent.summary : "Nothing scheduled"}
          </p>
          <p className="text-xs text-muted-foreground">
            {nextEvent ? formatEventTime(nextEvent.start) : "—"}
          </p>
        </div>

        {/* Ventures needing attention */}
        <div className={`rounded-lg border bg-card px-4 py-3 space-y-1 card-hover ${staleVentures > 0 ? "border-amber-300" : "border-border"}`}>
          <p className="text-xs text-muted-foreground">Ventures stale</p>
          <p className={`text-xl font-semibold font-mono tabular-nums ${staleVentures > 0 ? "text-amber-600" : "text-foreground"}`}>
            {staleVentures}
          </p>
          <p className="text-xs text-muted-foreground">
            {staleVentures === 0 ? "All up to date" : `${staleVentures} need update`}
          </p>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <a
              key={c.title}
              href={c.href}
              className="group relative overflow-hidden rounded-2xl p-5 min-h-[148px] flex flex-col card-hover"
              style={{ backgroundColor: `hsl(${c.bg})` }}
            >
              <Icon
                className="absolute -right-4 -bottom-4 w-24 h-24 text-foreground/[0.06]"
                strokeWidth={1}
              />
              <div className="flex items-start justify-between relative">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {c.title}
                </h3>
                <ArrowUpRight className="w-4 h-4 text-foreground/40 group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-foreground/60 mt-1 max-w-[85%] relative">
                {c.desc}
              </p>
              <span className="mt-auto inline-flex w-fit items-center rounded-full bg-card/70 px-2.5 py-1 text-xs font-medium text-foreground/80 relative">
                {c.count}
              </span>
            </a>
          );
        })}
      </div>

      {/* Market snapshot + Calendar row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Markets */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Markets</h2>
          </div>
          {keyIndices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No market data — run the refresh job.</p>
          ) : (
            <div className="space-y-2">
              {keyIndices.map((q) => (
                <div key={q.symbol} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-foreground">{q.label}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{q.symbol}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm tabular-nums text-foreground">
                      {fmt(q.price)}
                    </span>
                    <span className={`ml-2 text-xs tabular-nums ${changeColor(q.change_pct)}`}>
                      {fmtPct(q.change_pct)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href="/finance" className="text-xs text-primary hover:underline block pt-1">
            Full watchlist →
          </a>
        </div>

        {/* Calendar */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Next 3 days</h2>
          </div>
          {calEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No events — connect Google Calendar.
            </p>
          ) : (
            <div className="space-y-2">
              {calEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  <div>
                    <p className="text-sm text-foreground leading-tight">{e.summary}</p>
                    <p className="text-xs text-muted-foreground">{formatEventTime(e.start)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tasks + Mail row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Inbox</h2>
            {activeTasks.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                {activeTasks.length} items
              </span>
            )}
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Inbox zero.</p>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                      t.priority === "high"
                        ? "bg-red-500"
                        : t.priority === "medium"
                        ? "bg-amber-500"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-foreground leading-tight">{t.title}</p>
                    {t.due_date && (
                      <p className="text-xs text-muted-foreground">Due {t.due_date}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href="/personal" className="text-xs text-primary hover:underline block pt-1">
            All tasks →
          </a>
        </div>

        {/* Mail */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Important mail</h2>
          </div>
          {threads.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No important threads — connect Gmail.
            </p>
          ) : (
            <div className="space-y-2.5">
              {threads.map((t) => (
                <div key={t.id}>
                  <p className="text-sm text-foreground leading-tight truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.from}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overview donut */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
        <div className="flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Ventures overview</h2>
        </div>
        {allVentures.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ventures yet.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <OverviewDonut
              data={stageBreakdown}
              total={allVentures.length}
              centerLabel="ventures"
              size={180}
            />
            <div className="flex-1 w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium py-1.5">Stage</th>
                    <th className="text-right font-medium py-1.5">Count</th>
                    <th className="text-right font-medium py-1.5">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {stageBreakdown.map((s) => (
                    <tr
                      key={s.label}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-1.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-foreground">{s.label}</span>
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-foreground">
                        {s.value}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {Math.round((s.value / allVentures.length) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ventures snapshot */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-hover">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Ventures</h2>
        </div>
        {activeVentures.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active ventures.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeVentures.map((v) => (
              <div key={v.id} className="rounded-md border border-border p-3 space-y-1 card-hover">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{v.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
                    {v.stage}
                  </span>
                </div>
                {v.next_action && (
                  <p className="text-xs text-muted-foreground truncate">→ {v.next_action}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <a href="/ventures" className="text-xs text-primary hover:underline block pt-1">
          Full board →
        </a>
      </div>
    </div>
  );
}
