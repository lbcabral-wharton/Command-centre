import {
  getMarketQuotes,
  getQuoteHistory,
  recordQuoteSnapshot,
} from "@/lib/queries";
import { fmt, fmtPct, changeColor } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { refreshMarkets } from "@/app/actions/markets";
import { Sparkline } from "@/components/sparkline";

export const revalidate = 300;

// `key` matches the value stored in the DB (singular); `label` is for display.
const CATEGORIES = [
  { key: "index", label: "Index" },
  { key: "fx", label: "FX" },
  { key: "rate", label: "Rates" },
  { key: "commodity", label: "Commodities" },
  { key: "crypto", label: "Crypto" },
] as const;

export default async function FinancePage() {
  const quotes = await getMarketQuotes();

  // Capture today's snapshot so the trend history grows, then load it.
  await recordQuoteSnapshot(quotes);
  const history = await getQuoteHistory(30);

  const byCategory = CATEGORIES.reduce<Record<string, typeof quotes>>(
    (acc, cat) => {
      acc[cat.key] = quotes.filter(
        (q) => q.category?.toLowerCase() === cat.key
      );
      return acc;
    },
    {}
  );

  const lastUpdated =
    quotes.length > 0 && quotes[0].updated_at
      ? new Date(quotes[0].updated_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Finance</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last refreshed {lastUpdated}
            </p>
          )}
        </div>
        <form action={refreshMarkets}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-full border border-border bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </form>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No market data yet. Click Refresh to load prices.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const rows = byCategory[cat.key];
            if (!rows || rows.length === 0) return null;
            return (
              <div key={cat.key}>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {cat.label}
                </h2>
                <div className="rounded-lg border border-border bg-card overflow-hidden card-hover">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">
                          Name
                        </th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">
                          Symbol
                        </th>
                        <th className="text-center text-xs text-muted-foreground font-medium px-4 py-3 hidden md:table-cell">
                          30d
                        </th>
                        <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">
                          Price
                        </th>
                        <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((q, i) => (
                        <tr
                          key={q.symbol}
                          className={`transition-colors hover:bg-accent/40 ${
                            i < rows.length - 1 ? "border-b border-border/50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-foreground">{q.label}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {q.symbol}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex justify-center">
                              <Sparkline
                                data={history[q.symbol] ?? []}
                                positive={(q.change_pct ?? 0) >= 0}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">
                            {fmt(q.price)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums ${changeColor(q.change_pct)}`}
                          >
                            {fmtPct(q.change_pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
