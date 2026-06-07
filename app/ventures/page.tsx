import { getVentures, type Venture } from "@/lib/queries";

export const revalidate = 60;

const STAGES = [
  "idea",
  "validating",
  "building",
  "active",
  "paused",
] as const;

const STAGE_COLORS: Record<string, string> = {
  idea: "text-blue-400 bg-blue-400/10",
  validating: "text-purple-400 bg-purple-400/10",
  building: "text-amber-400 bg-amber-400/10",
  active: "text-emerald-400 bg-emerald-400/10",
  paused: "text-muted-foreground bg-muted",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-muted-foreground",
};

function isStale(v: Venture): boolean {
  const days =
    (Date.now() - new Date(v.last_update).getTime()) / (1000 * 60 * 60 * 24);
  return days > 30 && v.stage !== "paused";
}

export default async function VenturesPage() {
  const ventures = await getVentures();

  const byStage = STAGES.reduce<Record<string, Venture[]>>((acc, s) => {
    acc[s] = ventures.filter((v) => v.stage === s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Ventures</h1>
        <span className="text-xs text-muted-foreground">{ventures.length} total</span>
      </div>

      {ventures.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">No ventures yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {STAGES.map((stage) => {
            const items = byStage[stage] ?? [];
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${STAGE_COLORS[stage]}`}
                  >
                    {stage}
                  </span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs text-muted-foreground/40 text-center">—</p>
                  </div>
                ) : (
                  items.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-lg border bg-card p-3 space-y-1.5 card-hover ${
                        isStale(v) ? "border-amber-900/50" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {v.name}
                        </p>
                        {isStale(v) && (
                          <span className="text-xs text-amber-500 flex-shrink-0">stale</span>
                        )}
                      </div>
                      {v.thesis && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{v.thesis}</p>
                      )}
                      {v.next_action && (
                        <p className="text-xs text-foreground/70 truncate">→ {v.next_action}</p>
                      )}
                      {v.next_action_date && (
                        <p className="text-xs text-muted-foreground">{v.next_action_date}</p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span
                          className={`text-xs capitalize ${
                            PRIORITY_COLORS[v.priority] ?? "text-muted-foreground"
                          }`}
                        >
                          {v.priority}
                        </span>
                        {v.invested && v.invested > 0 && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ${v.invested.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
