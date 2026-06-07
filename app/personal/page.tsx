import { getTasks, getHabits, getHabitLogs } from "@/lib/queries";
import { getUpcomingEvents } from "@/lib/google";
import { formatEventTime } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

export const revalidate = 60;

const COLUMNS = [
  { status: "inbox" as const, label: "Inbox" },
  { status: "doing" as const, label: "Doing" },
  { status: "waiting" as const, label: "Waiting" },
  { status: "done" as const, label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-muted-foreground",
};

export default async function PersonalPage() {
  const [allTasks, habits, logs, events] = await Promise.allSettled([
    Promise.all(COLUMNS.map((c) => getTasks(c.status))),
    getHabits(),
    getHabitLogs(14),
    getUpcomingEvents(7),
  ]);

  const tasksByStatus =
    allTasks.status === "fulfilled" ? allTasks.value : COLUMNS.map(() => []);
  const habitList = habits.status === "fulfilled" ? habits.value : [];
  const habitLogs = logs.status === "fulfilled" ? logs.value : [];
  const calEvents = events.status === "fulfilled" ? events.value : [];

  // Build habit completion map: habitId -> Set<dateStr>
  const completedDates = habitLogs.reduce<Record<string, Set<string>>>(
    (acc, log) => {
      if (log.done) {
        if (!acc[log.habit_id]) acc[log.habit_id] = new Set();
        acc[log.habit_id].add(log.log_date);
      }
      return acc;
    },
    {}
  );

  // Last 14 days for habit grid
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Personal</h1>

      {/* Task board */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Tasks
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map(({ status, label }, i) => {
            const tasks = tasksByStatus[i] ?? [];
            return (
              <div key={status} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">{tasks.length}</span>
                </div>
                {tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 py-2">Empty</p>
                ) : (
                  <div className="space-y-1.5">
                    {tasks.slice(0, 8).map((t) => (
                      <div key={t.id} className="flex items-start gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                            PRIORITY_DOT[t.priority] ?? "bg-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-foreground leading-tight truncate">
                            {t.title}
                          </p>
                          {t.due_date && (
                            <p className="text-xs text-muted-foreground">{t.due_date}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {tasks.length > 8 && (
                      <p className="text-xs text-muted-foreground">+{tasks.length - 8} more</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Habits */}
      {habitList.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Habits — last 14 days
          </h2>
          <div className="rounded-lg border border-border bg-card p-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-normal pb-2 pr-4 min-w-[120px]">
                    Habit
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="text-center text-muted-foreground font-normal pb-2 px-0.5 min-w-[20px]"
                    >
                      {new Date(d + "T12:00:00").getDate()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habitList.map((h) => (
                  <tr key={h.id}>
                    <td className="text-foreground py-1 pr-4 truncate max-w-[120px]">
                      {h.name}
                    </td>
                    {days.map((d) => {
                      const done = completedDates[h.id]?.has(d);
                      const isToday = d === new Date().toISOString().split("T")[0];
                      return (
                        <td key={d} className="py-1 px-0.5 text-center">
                          <div
                            className={`w-4 h-4 rounded mx-auto ${
                              done
                                ? "bg-emerald-500"
                                : isToday
                                ? "bg-muted border border-border"
                                : "bg-muted/40"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> Next 7 days
        </h2>
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {calEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">
              No events — sign in with Google to see your calendar.
            </p>
          ) : (
            calEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground leading-tight">{e.summary}</p>
                  <p className="text-xs text-muted-foreground">{formatEventTime(e.start)}</p>
                  {e.location && (
                    <p className="text-xs text-muted-foreground truncate">{e.location}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
