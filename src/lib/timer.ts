import type { Settings, TimerMode, TimerState, TimerTiming } from "../types";

export const durationFor = (mode: TimerMode, settings: Settings): number => {
  switch (mode) {
    case "short":
      return settings.shortMin * 60;
    case "long":
      return settings.longMin * 60;
    default:
      return settings.workMin * 60;
  }
};

export const modeLabel = (mode: TimerMode): string =>
  mode === "work" ? "专注" : mode === "short" ? "短休息" : "长休息";

/** Settings key holding each preset's length. */
export const minutesKeyFor = (mode: TimerMode): "workMin" | "shortMin" | "longMin" =>
  mode === "short" ? "shortMin" : mode === "long" ? "longMin" : "workMin";

/** Length of a preset in minutes. */
export const minutesFor = (mode: TimerMode, settings: Settings): number =>
  settings[minutesKeyFor(mode)];

/** Allowed length range per preset, mirrored by the settings steppers. */
export const MINUTES_RANGE: Record<TimerMode, { min: number; max: number }> = {
  work: { min: 1, max: 90 },
  short: { min: 1, max: 30 },
  long: { min: 5, max: 60 },
};

/** Seconds left, derived from the wall clock so every window agrees. */
export const computeRemaining = (timer: TimerState, now: number): number =>
  timer.running && timer.endAt
    ? Math.max(0, Math.ceil((timer.endAt - now) / 1000))
    : Math.max(0, Math.ceil(timer.remaining));

/** Seconds a mode starts from; a stopwatch work round starts at zero. */
export const initialSeconds = (mode: TimerMode, settings: Settings, timing: TimerTiming): number =>
  timing === "stopwatch" && mode === "work" ? 0 : durationFor(mode, settings);

/** Seconds a running stopwatch has accumulated. */
export const elapsedSeconds = (timer: TimerState, now: number): number =>
  timer.running && timer.startedAt
    ? Math.max(0, Math.floor((now - timer.startedAt) / 1000))
    : Math.max(0, Math.floor(timer.remaining));

/** The number shown on the clock: elapsed for a stopwatch, remaining otherwise. */
export const displaySeconds = (timer: TimerState, now: number): number =>
  timer.timing === "stopwatch" && timer.mode === "work"
    ? elapsedSeconds(timer, now)
    : computeRemaining(timer, now);

/** Ring fill, clamped to 0–1. A stopwatch fills one full ring per hour. */
export const timerProgress = (timer: TimerState, settings: Settings, now: number): number => {
  if (timer.timing === "stopwatch" && timer.mode === "work") {
    return Math.min(1, Math.max(0, displaySeconds(timer, now) / 3600));
  }
  const total = durationFor(timer.mode, settings);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - computeRemaining(timer, now) / total));
};

/** `25:00` / `05:09` */
export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

/** `1小时20分` used in countdown labels. */
export const humanizeMinutes = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
};
