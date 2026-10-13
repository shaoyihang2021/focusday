import { useEffect } from "react";
import { Coffee, Minus, Pause, Play, SquareArrowOutUpRight, Timer } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { widgetScale } from "../store/defaults";
import { useNow } from "../hooks/useNow";
import { computeRemaining, durationFor, formatClock } from "../lib/timer";
import { countdownInfo } from "../lib/date";
import { applyWidgetWindowSettings, focusMainWindow, hideSelf } from "../lib/widget";
import { Ring } from "./Ring";
import { cn } from "../lib/cn";

export default function WidgetApp() {
  const timer = useAppStore((s) => s.timer);
  const settings = useAppStore((s) => s.settings);
  const todos = useAppStore((s) => s.todos);
  const countdowns = useAppStore((s) => s.countdowns);
  const toggleRun = useAppStore((s) => s.toggleRun);

  const now = useNow(500);
  const remaining = computeRemaining(timer, now);
  const total = durationFor(timer.mode, settings);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const isBreak = timer.mode !== "work";

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.classList.add("fd-widget");
    return () => document.body.classList.remove("fd-widget");
  }, []);

  useEffect(() => {
    void applyWidgetWindowSettings({
      alwaysOnTop: settings.widgetAlwaysOnTop,
      scale: widgetScale[settings.widgetSize],
    });
  }, [settings.widgetAlwaysOnTop, settings.widgetSize]);

  const nextTodo = todos.find((t) => !t.done) ?? null;

  const pinned = countdowns.filter((c) => c.pinned);
  const pool = pinned.length > 0 ? pinned : countdowns.filter((c) => countdownInfo(c.date, c.yearly).upcoming);
  const nearest = [...pool].sort((a, b) => {
    const da = countdownInfo(a.date, a.yearly).days;
    const db = countdownInfo(b.date, b.yearly).days;
    return da - db;
  })[0];
  const nearestInfo = nearest ? countdownInfo(nearest.date, nearest.yearly) : null;

  return (
    <div className="h-full w-full p-2">
      <div
        className="glass flex h-full w-full flex-col overflow-hidden rounded-2xl shadow-xl shadow-black/20"
        style={{ opacity: settings.widgetOpacity }}
      >
        {/* drag handle */}
        <div
          data-tauri-drag-region
          className="flex h-8 shrink-0 items-center gap-2 px-3.5 select-none"
        >
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span
            data-tauri-drag-region
            className="text-[11px] font-semibold tracking-wide text-muted"
          >
            FocusDay
          </span>
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => void focusMainWindow()}
              title="打开主窗口"
              className="grid h-5 w-5 place-items-center rounded-md text-muted transition-colors hover:text-ink"
            >
              <SquareArrowOutUpRight size={12} />
            </button>
            <button
              type="button"
              onClick={() => void hideSelf()}
              title="隐藏小组件"
              className="grid h-5 w-5 place-items-center rounded-md text-muted transition-colors hover:text-rose-500"
            >
              <Minus size={13} />
            </button>
          </span>
        </div>

        <div className="flex flex-1 items-center gap-3 px-3.5 pb-1">
          <Ring progress={progress} size={86} stroke={7} color={isBreak ? "#1fa2a6" : "var(--fd-brand)"}>
            <span className="text-lg font-bold tabular-nums tracking-tight text-ink">
              {formatClock(remaining)}
            </span>
          </Ring>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isBreak ? (
                <Coffee size={13} className="text-[#1fa2a6]" />
              ) : (
                <Timer size={13} className="text-brand" />
              )}
              <span className="text-xs font-semibold text-ink">
                {timer.mode === "work" ? "专注" : timer.mode === "short" ? "短休息" : "长休息"}
              </span>
              <span className={cn("text-[10px]", timer.running ? "fd-pulse text-brand" : "text-muted")}>
                {timer.running ? "进行中" : "已暂停"}
              </span>
              <span className="ml-auto text-[10px] text-muted">今日 {timer.today}🍅</span>
            </div>

            {nearestInfo && nearest ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-2 py-1.5 dark:bg-white/[0.06]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: nearest.color }} />
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{nearest.title}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted">
                  {nearestInfo.days > 0
                    ? `${nearestInfo.days} 天`
                    : nearestInfo.days === 0
                      ? "今天"
                      : `-${Math.abs(nearestInfo.days)} 天`}
                </span>
              </div>
            ) : null}

            <p className="mt-1.5 truncate text-[11px] text-muted">
              {nextTodo ? `待办 · ${nextTodo.title}` : "暂无待办"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleRun}
          className={cn(
            "mx-3.5 mb-3 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white transition-all",
            "bg-gradient-to-br from-[#ff7a5c] to-[#e23213] shadow-md shadow-brand/25 hover:brightness-105 active:scale-[0.98]",
          )}
        >
          {timer.running ? <Pause size={14} /> : <Play size={14} />}
          {timer.running ? "暂停" : "开始"}
        </button>
      </div>
    </div>
  );
}
