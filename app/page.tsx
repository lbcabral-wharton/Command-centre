import { getMarketQuotes, getTasks, getVentures, getDailyBrief } from "@/lib/queries";
import { getUpcomingEvents, getImportantThreads } from "@/lib/google";
import { fmt, fmtPct, changeColor, formatEventTime } from "@/lib/utils";
import { CalendarDays, CheckSquare, Rocket, TrendingUp, Mail } from "lucide-react";

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

  // Key market indices for the landing snapshot
  const keyIndices = mq.filter((q) =>
    ["S&P 500", "NASDAQ", "FTSE 100", "Bitcoin", "EUR/USD", "GBP/USD"].includes(q.name)
  );

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Good morning, Cabral</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
      </div>

      {/* Daily brief */}
      {dailyBrief?.summary && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{dailyBrief.summary}</p>
        </div>
      )}

      {/* Market snapshot + Calendar row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Markets */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
                    <span className="text-sm text-foreground">{q.name}</span>
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
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
                        ? "bg-red-400"
                        : t.priority === "medium"
                        ? "bg-amber-400"
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
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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

      {/* Ventures snapshot */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Ventures</h2>
        </div>
        {activeVentures.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active ventures.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeVentures.map((v) => (
              <div key={v.id} className="rounded-md border border-border p-3 space-y-1">
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
