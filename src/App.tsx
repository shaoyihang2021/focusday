import { useState } from "react";
import { PanelTop, PanelTopClose } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import PomodoroView from "./components/PomodoroView";
import TodoView from "./components/TodoView";
import CountdownView from "./components/CountdownView";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import { useAppStore } from "./store/useAppStore";
import { setWidgetVisible } from "./lib/widget";
import { isTauri } from "./lib/env";
import type { View } from "./types";

const META: Record<View, { title: string; subtitle: string }> = {
  pomodoro: { title: "番茄钟", subtitle: "专注于当下这一件事" },
  todos: { title: "待办清单", subtitle: "把大目标拆成一个个小番茄" },
  countdowns: { title: "倒数日", subtitle: "记下每一个值得期待的日子" },
  stats: { title: "统计", subtitle: "看看你的专注积累" },
  settings: { title: "设置", subtitle: "调成你喜欢的样子" },
};

export default function App() {
  const [view, setView] = useState<View>("pomodoro");
  const [widgetOn, setWidgetOn] = useState(false);
  const theme = useAppStore((s) => s.settings.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const tauri = isTauri();

  const toggleWidget = () => {
    const next = !widgetOn;
    setWidgetOn(next);
    void setWidgetVisible(next);
  };

  return (
    <div className="flex h-full">
      <Sidebar view={view} onChange={setView} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-ink">
              {META[view].title}
            </h1>
            <p className="truncate text-xs text-muted">{META[view].subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tauri ? (
              <button
                type="button"
                onClick={toggleWidget}
                className={
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors " +
                  (widgetOn
                    ? "border-transparent bg-brand text-white"
                    : "border-line bg-card text-muted hover:text-ink")
                }
              >
                {widgetOn ? <PanelTopClose size={14} /> : <PanelTop size={14} />}
                桌面小组件
              </button>
            ) : null}
            <ThemeToggle value={theme} onChange={setTheme} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {view === "pomodoro" && <PomodoroView />}
          {view === "todos" && <TodoView />}
          {view === "countdowns" && <CountdownView />}
          {view === "stats" && <StatsView />}
          {view === "settings" && <SettingsView />}
        </div>
      </main>
    </div>
  );
}
