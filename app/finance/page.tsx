import { getMarketQuotes } from "@/lib/queries";
import { fmt, fmtPct, changeColor } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { refreshMarkets } from "@/app/actions/markets";

export const revalidate = 300;

const CATEGORIES = ["Index", "FX", "Rates", "Commodities", "Crypto"] as const;

export default async function FinancePage() {
  const quotes = await getMarketQuotes();

  const byCategory = CATEGORIES.reduce<Record<string, typeof quotes>>(
    (acc, cat) => {
      acc[cat] = quotes.filter(
        (q) => q.category?.toLowerCase() === cat.toLowerCase()
      );
      return acc;
    },
    {}
  );

  const lastUpdated =
    quotes.length > 0
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
          <h1 className="text-2xl font-semibold text-foreground">Finance</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last refreshed {lastUpdated}
            </p>
          )}
        </div>
        <form action={refreshMarkets}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </form>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No market data yet. Click Refresh to load prices.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const rows = byCategory[cat];
            if (!rows || rows.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {cat}
                </h2>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5">
                          Name
                        </th>
                        <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5 hidden sm:table-cell">
                          Symbol
                        </th>
                        <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5">
                          Price
                        </th>
                        <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((q, i) => (
                        <tr
                          key={q.symbol}
                          className={i < rows.length - 1 ? "border-b border-border/50" : ""}
                        >
                          <td className="px-4 py-2.5 text-foreground">{q.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                            {q.symbol}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                            {q.currency && q.currency !== "USD" ? `${q.currency} ` : ""}
                            {fmt(q.price)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right tabular-nums ${changeColor(q.change_pct)}`}
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
