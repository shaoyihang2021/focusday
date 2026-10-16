import { useEffect, useRef } from "react";
import { Coffee, Lock, LockOpen, Minus, Pause, Play, SquareArrowOutUpRight, Timer } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { widgetScale } from "../store/defaults";
import type { WidgetSkin } from "../types";
import { useNow } from "../hooks/useNow";
import { computeRemaining, durationFor, formatClock } from "../lib/timer";
import { countdownInfo } from "../lib/date";
import { todayStat } from "../lib/stats";
import {
  applyWidgetWindowSettings,
  focusMainWindow,
  hideSelf,
  onWidgetMoved,
  restoreWidgetPosition,
} from "../lib/widget";
import { Ring } from "./Ring";
import { cn } from "../lib/cn";

export default function WidgetApp() {
  const timer = useAppStore((s) => s.timer);
  const settings = useAppStore((s) => s.settings);
  const todos = useAppStore((s) => s.todos);
  const countdowns = useAppStore((s) => s.countdowns);
  const toggleRun = useAppStore((s) => s.toggleRun);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const todayCount = useAppStore((s) => todayStat(s.focusByDay).count);

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

  // Restore the last position once, after the store has hydrated.
  const restored = useRef(false);
  const savedPos = settings.widgetPos;
  useEffect(() => {
    if (restored.current || !savedPos) return;
    restored.current = true;
    void restoreWidgetPosition(savedPos);
  }, [savedPos]);

  // Remember the position while the widget can be moved.
  useEffect(() => {
    if (settings.widgetLocked) return;
    let debounce: number | undefined;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onWidgetMoved((pos) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => updateSettings({ widgetPos: pos }), 400);
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      unlisten?.();
    };
  }, [settings.widgetLocked, updateSettings]);

  const dragProps: Record<string, string> = settings.widgetLocked
    ? {}
    : { "data-tauri-drag-region": "true" };

  const skinClass: Record<WidgetSkin, string> = {
    glass: "fd-skin-glass shadow-xl shadow-black/20",
    solid: "fd-skin-solid shadow-xl shadow-black/25",
    outline: "fd-skin-outline shadow-lg shadow-black/10",
    ghost: "fd-skin-ghost",
  };

  const nextTodo = todos.find((t) => !t.done) ?? null;

  const pinned = countdowns.filter((c) => c.pinned);
  const pool = pinned.length > 0 ? pinned : countdowns.filter((c) => countdownInfo(c).upcoming);
  const nearest = [...pool].sort((a, b) => countdownInfo(a).days - countdownInfo(b).days)[0];
  const nearestInfo = nearest ? countdownInfo(nearest) : null;

  return (
    <div className="h-full w-full p-2">
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl",
          skinClass[settings.widgetSkin],
        )}
        style={{ opacity: settings.widgetOpacity }}
      >
        {/* drag handle — dragging is disabled while the widget is locked */}
        <div
          {...dragProps}
          className={cn(
            "flex h-8 shrink-0 items-center gap-2 px-3.5 select-none",
            settings.widgetLocked ? "cursor-default" : "cursor-move",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span
            {...dragProps}
            className="text-[11px] font-semibold tracking-wide text-muted"
          >
            FocusDay
          </span>
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-pressed={settings.widgetLocked}
              onClick={() => updateSettings({ widgetLocked: !settings.widgetLocked })}
              title={settings.widgetLocked ? "解锁位置（可拖动）" : "锁定位置（防误拖）"}
              className={cn(
                "grid h-5 w-5 place-items-center rounded-md transition-colors",
                settings.widgetLocked ? "text-brand" : "text-muted hover:text-ink",
              )}
            >
              {settings.widgetLocked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
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
          {settings.widgetShow.ring ? (
            <Ring progress={progress} size={86} stroke={7}>
              <span className="text-lg font-bold tabular-nums tracking-tight text-ink">
                {formatClock(remaining)}
              </span>
            </Ring>
          ) : (
            <div className="flex w-[86px] shrink-0 flex-col items-center">
              <span className="text-[10px] font-semibold tracking-wide text-muted">
                {timer.mode === "work" ? "专注" : timer.mode === "short" ? "短休息" : "长休息"}
              </span>
              <span className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-ink">
                {formatClock(remaining)}
              </span>
            </div>
          )}

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
              {settings.widgetShow.today ? (
                <span className="ml-auto text-[10px] text-muted">今日 {todayCount}🍅</span>
              ) : null}
            </div>

            {settings.widgetShow.countdown && nearestInfo && nearest ? (
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

            {settings.widgetShow.todo ? (
              <p className="mt-1.5 truncate text-[11px] text-muted">
                {nextTodo ? `待办 · ${nextTodo.title}` : "暂无待办"}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleRun}
          className={cn(
            "mx-3.5 mb-3 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white transition-all",
            "fd-primary shadow-md shadow-brand/25 hover:brightness-105 active:scale-[0.98]",
          )}
        >
          {timer.running ? <Pause size={14} /> : <Play size={14} />}
          {timer.running ? "暂停" : "开始"}
        </button>
      </div>
    </div>
  );
}
