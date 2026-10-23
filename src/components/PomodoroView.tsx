import { BellOff, Check, ListTodo, Pause, Play, RotateCcw, SkipForward, Target } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import {
  MINUTES_RANGE,
  computeRemaining,
  durationFor,
  formatClock,
  minutesFor,
  minutesKeyFor,
  modeLabel,
} from "../lib/timer";
import { todayStat } from "../lib/stats";
import type { TimerMode } from "../types";
import { Ring } from "./Ring";
import { Card, Segmented, Stepper } from "./ui";
import { cn } from "../lib/cn";

type Phase = "focus" | "rest";

const PHASES: { value: Phase; label: string }[] = [
  { value: "focus", label: "专注" },
  { value: "rest", label: "休息" },
];

/** Short and long breaks are presets inside the break phase. */
const REST_PRESETS: { value: TimerMode; label: string }[] = [
  { value: "short", label: "短休息" },
  { value: "long", label: "长休息" },
];

export default function PomodoroView() {
  const timer = useAppStore((s) => s.timer);
  const settings = useAppStore((s) => s.settings);
  const todos = useAppStore((s) => s.todos);
  const toggleRun = useAppStore((s) => s.toggleRun);
  const resetTimer = useAppStore((s) => s.resetTimer);
  const skip = useAppStore((s) => s.skip);
  const setMode = useAppStore((s) => s.setMode);
  const setActiveTodo = useAppStore((s) => s.setActiveTodo);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const today = useAppStore((s) => todayStat(s.focusByDay));

  const now = useNow(250);
  const remaining = computeRemaining(timer, now);
  const total = durationFor(timer.mode, settings);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const isBreak = timer.mode !== "work";
  const activeTodo = todos.find((t) => t.id === timer.activeTodoId) ?? null;
  const openTodos = todos.filter((t) => !t.done);
  const statusText = timer.running ? "进行中" : remaining < total ? "已暂停" : "准备就绪";
  // "专注时免打扰" only muffles FocusDay's own alerts during a running work round.
  const dndActive = settings.focusDnd && timer.running && timer.mode === "work";
  const phase: Phase = timer.mode === "work" ? "focus" : "rest";
  const range = MINUTES_RANGE[timer.mode];

  const changePhase = (next: Phase) => {
    if (next === "focus") {
      if (timer.mode !== "work") setMode("work");
    } else if (timer.mode === "work") {
      setMode("short");
    }
  };

  // Compute the key explicitly so TypeScript keeps the Partial<Settings> shape.
  const setMinutes = (value: number) => {
    const key = minutesKeyFor(timer.mode);
    updateSettings(
      key === "shortMin" ? { shortMin: value } : key === "longMin" ? { longMin: value } : { workMin: value },
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
      <Card className="fd-pop flex flex-col items-center gap-7 px-8 py-9">
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Segmented options={PHASES} value={phase} onChange={changePhase} />
            {dndActive ? (
              <span
                title="专注时免打扰已开启：本段专注期间 FocusDay 不会发出提示音或系统通知"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand"
              >
                <BellOff size={12} /> 免打扰中
              </span>
            ) : null}
          </div>

          {phase === "rest" ? (
            <Segmented options={REST_PRESETS} value={timer.mode} onChange={setMode} />
          ) : null}

          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1">
            <span className="text-xs text-muted">{modeLabel(timer.mode)}时长</span>
            {timer.running ? (
              // While a round is running its length is fixed, so only show it.
              <span className="text-sm font-semibold tabular-nums text-ink">
                {minutesFor(timer.mode, settings)} 分钟
              </span>
            ) : (
              <Stepper
                value={minutesFor(timer.mode, settings)}
                min={range.min}
                max={range.max}
                suffix="分钟"
                onChange={setMinutes}
              />
            )}
          </div>
        </div>

        <Ring progress={progress}>
          <span className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">
            {modeLabel(timer.mode)}
          </span>
          <span className="mt-1 text-[58px] leading-none font-bold tabular-nums tracking-tight text-ink">
            {formatClock(remaining)}
          </span>
          <span className={cn("mt-2.5 text-xs font-medium", timer.running ? "fd-pulse text-brand" : "text-muted")}>
            {statusText}
          </span>
        </Ring>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetTimer}
            title="重置"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-card text-muted transition-colors hover:text-ink"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={toggleRun}
            className={cn(
              "flex h-11 min-w-[136px] items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white transition-all",
              "fd-primary shadow-lg shadow-brand/30 hover:brightness-105 active:scale-[0.98]",
            )}
          >
            {timer.running ? <Pause size={18} /> : <Play size={18} />}
            {timer.running ? "暂停" : isBreak ? "开始休息" : "开始专注"}
          </button>
          <button
            type="button"
            onClick={skip}
            title="跳过"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-card text-muted transition-colors hover:text-ink"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.max(1, settings.longEvery) }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < timer.round ? "bg-brand" : "bg-black/10 dark:bg-white/15",
              )}
            />
          ))}
          <span className="ml-2 text-xs text-muted">
            {timer.round}/{settings.longEvery} 后进入长休息
          </span>
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="fd-pop p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Target size={16} className="text-brand" />
            当前专注任务
          </div>
          {openTodos.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              还没有待办。先去「待办清单」添加一个任务，就能把专注时间记在它头上。
            </p>
          ) : (
            <>
              <select
                value={timer.activeTodoId ?? ""}
                onChange={(e) => setActiveTodo(e.target.value || null)}
                className="w-full rounded-xl border border-line bg-solid px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              >
                <option value="">不关联任务</option>
                {openTodos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              {activeTodo ? (
                <div className="mt-3 rounded-xl bg-brand-soft px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{activeTodo.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    已完成 {activeTodo.completed} / {activeTodo.estimate} 个番茄
                    {activeTodo.completed >= activeTodo.estimate ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-brand">
                        <Check size={12} /> 达标
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card className="fd-pop grid grid-cols-2 gap-4 p-5">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted">今日番茄</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink">{today.count}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted">今日专注时长</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink">
              {today.minutes}
              <span className="ml-0.5 text-sm font-medium text-muted">min</span>
            </p>
          </div>
        </Card>

        {openTodos.length > 0 ? (
          <Card className="fd-pop flex-1 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <ListTodo size={16} className="text-brand" />
              待办速览
            </div>
            <ul className="flex flex-col gap-2">
              {openTodos.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTodo(t.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      t.id === timer.activeTodoId
                        ? "border-brand/40 bg-brand-soft"
                        : "border-line bg-card hover:bg-solid",
                    )}
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line text-[10px] font-semibold text-muted">
                      {t.completed}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                    <span className="text-[11px] tabular-nums text-muted">{t.estimate}🍅</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
