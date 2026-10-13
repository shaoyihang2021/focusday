import { CalendarDays, ChartColumn, ListTodo, Settings as SettingsIcon, Timer } from "lucide-react";
import type { View } from "../types";
import { useAppStore } from "../store/useAppStore";
import { countdownInfo } from "../lib/date";
import { todayStat } from "../lib/stats";
import { cn } from "../lib/cn";

const NAV: { value: View; label: string; Icon: typeof Timer }[] = [
  { value: "pomodoro", label: "番茄钟", Icon: Timer },
  { value: "todos", label: "待办清单", Icon: ListTodo },
  { value: "countdowns", label: "倒数日", Icon: CalendarDays },
  { value: "stats", label: "统计", Icon: ChartColumn },
  { value: "settings", label: "设置", Icon: SettingsIcon },
];

interface Props {
  view: View;
  onChange: (view: View) => void;
}

export function Sidebar({ view, onChange }: Props) {
  const today = useAppStore((s) => todayStat(s.focusByDay).count);
  const openTodos = useAppStore((s) => s.todos.filter((t) => !t.done).length);
  const upcoming = useAppStore(
    (s) => s.countdowns.filter((c) => countdownInfo(c.date, c.yearly).upcoming).length,
  );

  const badge: Partial<Record<View, number>> = {
    todos: openTodos,
    countdowns: upcoming,
  };

  return (
    <aside className="flex w-[212px] shrink-0 flex-col gap-1 border-r border-line px-3 py-4">
      <div className="mb-4 flex items-center gap-2.5 px-2">
        <div className="fd-primary grid h-9 w-9 place-items-center rounded-xl shadow-lg shadow-brand/25">
          <Timer size={18} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-ink">FocusDay</p>
          <p className="text-[11px] text-muted">专注 · 待办 · 倒数</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ value, label, Icon }) => {
          const active = view === value;
          const count = badge[value];
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-brand-soft font-semibold text-brand"
                  : "font-medium text-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/[0.06]",
              )}
            >
              <Icon size={17} className={cn(active ? "text-brand" : "text-muted group-hover:text-ink")} />
              <span className="flex-1 text-left">{label}</span>
              {count ? (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                    active ? "bg-brand text-white" : "bg-black/[0.06] text-muted dark:bg-white/10",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-line bg-card p-3.5 backdrop-blur">
        <p className="text-[11px] font-medium tracking-wide text-muted">今日已专注</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-ink">{today}</span>
          <span className="text-xs text-muted">个番茄</span>
        </p>
      </div>
    </aside>
  );
}
