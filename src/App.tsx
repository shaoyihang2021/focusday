import { useEffect, useRef, useState } from "react";
import { PanelTop, PanelTopClose } from "lucide-react";
import { Sidebar, MobileNav } from "./components/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import PomodoroView from "./components/PomodoroView";
import TodoView from "./components/TodoView";
import CountdownView from "./components/CountdownView";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import { flushPersist, useAppStore } from "./store/useAppStore";
import { syncCountdownWidgets } from "./lib/widget";
import { isDesktopRuntime, isMobileOS } from "./lib/env";
import { cn } from "./lib/cn";
import type { View } from "./types";

const META: Record<View, { title: string; subtitle: string }> = {
  pomodoro: { title: "番茄钟", subtitle: "专注于当下这一件事" },
  todos: { title: "待办清单", subtitle: "把大目标拆成一个个小番茄" },
  countdowns: { title: "倒数日", subtitle: "记下每一个值得期待的日子" },
  stats: { title: "统计", subtitle: "看看你的专注积累" },
  settings: { title: "设置", subtitle: "调成你喜欢的样子" },
};

let pendingPinnedIds: string[] = [];
let pinnedSyncChain: Promise<void> = Promise.resolve();

/**
 * Serialises widget syncing and always reads the newest pinned set after the
 * state has been flushed, so a newly opened window never loads stale data.
 */
function queueCountdownWidgetSync(ids: string[]): void {
  pendingPinnedIds = ids;
  pinnedSyncChain = pinnedSyncChain
    .then(async () => {
      await flushPersist();
      await syncCountdownWidgets(pendingPinnedIds);
    })
    .catch((err) => {
      console.warn("[focusday] countdown widget sync failed", err);
    });
}

export default function App() {
  const [view, setView] = useState<View>("pomodoro");
  const widgetOn = useAppStore((s) => s.widgetVisible);
  const setWidgetVisible = useAppStore((s) => s.setWidgetVisible);
  const syncWidgetVisible = useAppStore((s) => s.syncWidgetVisible);
  const theme = useAppStore((s) => s.settings.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const contentRef = useRef<HTMLDivElement>(null);
  const desktop = isDesktopRuntime();
  const mobile = isMobileOS();

  // One desktop window per pinned countdown; Rust opens/closes the difference.
  const pinnedIds = useAppStore((s) =>
    s.countdowns
      .filter((c) => c.pinned)
      .map((c) => c.id)
      .join("|"),
  );

  useEffect(() => {
    if (!desktop) return;
    queueCountdownWidgetSync(pinnedIds ? pinnedIds.split("|") : []);
  }, [pinnedIds, desktop]);

  useEffect(() => {
    if (!desktop) return;
    syncWidgetVisible();
  }, [desktop, syncWidgetVisible]);

  // Switching views should start at the top rather than keep the previous
  // scroll offset, which could hide headings and toolbars.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const toggleWidget = () => setWidgetVisible(!widgetOn);

  return (
    <div
      className={cn(
        "flex h-full flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        // Android runs edge-to-edge, so reserve the status bar instead of
        // letting the header sit under the notification shade. The 24px floor
        // covers older WebViews that report an inset of 0.
        mobile ? "pt-[max(env(safe-area-inset-top),24px)]" : "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="flex min-h-0 flex-1">
        <Sidebar view={view} onChange={setView} />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card/80 px-4 backdrop-blur-xl md:h-16 md:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-ink">
                {META[view].title}
              </h1>
              <p className="truncate text-xs text-muted">{META[view].subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {desktop ? (
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
                  <span className="hidden sm:inline">桌面小组件</span>
                </button>
              ) : null}
              <ThemeToggle value={theme} onChange={setTheme} />
            </div>
          </header>

          <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
            {view === "pomodoro" && <PomodoroView />}
            {view === "todos" && <TodoView />}
            {view === "countdowns" && <CountdownView />}
            {view === "stats" && <StatsView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>
      </div>

      <MobileNav view={view} onChange={setView} />
    </div>
  );
}
