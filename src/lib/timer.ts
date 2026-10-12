import type { Settings, TimerMode, TimerState } from "../types";

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

/** Seconds left, derived from the wall clock so every window agrees. */
export const computeRemaining = (timer: TimerState, now: number): number =>
  timer.running && timer.endAt
    ? Math.max(0, Math.ceil((timer.endAt - now) / 1000))
    : Math.max(0, Math.round(timer.remaining));

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
