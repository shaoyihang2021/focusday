import type { Countdown } from "../types";

export const parseDay = (value: string): Date => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface CountdownInfo {
  /** Positive = in the future, 0 = today, negative = already passed. */
  days: number;
  /** Whether the target is still ahead of us. */
  upcoming: boolean;
  label: string;
  weekday: string;
  /**
   * `YYYY-MM-DD` of the occurrence the countdown actually points at. For
   * repeating events this is the next occurrence rather than the stored date,
   * so the card never pairs an old date with the wrong weekday.
   */
  nextDate: string;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** `YYYY-MM-DD` key for a date (defaults to today). */
export const dateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;

export const todayISO = (): string => dateKey();

/** `周一` … `周日` for a `YYYY-MM-DD` string. */
export const weekdayName = (dateStr: string): string => WEEKDAYS[parseDay(dateStr).getDay()];

/** `2026年10月13日` — the display format used throughout the Chinese UI. */
export const formatDate = (dateStr: string): string => {
  const d = parseDay(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

/** `10月13日` — compact label for chart axes. */
export const shortDate = (dateStr: string): string => {
  const d = parseDay(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

/** `2026年10月` — month heading for the heatmap. */
export const formatMonth = (year: number, month: number): string => `${year}年${month}月`;

/** Clamps a day-of-month into the given month's real length (e.g. 31 -> 28). */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** Next occurrence of `day` on or after today, allowing for short months. */
function nextMonthly(today: Date, day: number): Date {
  let candidate = clampToMonth(today.getFullYear(), today.getMonth(), day);
  if (candidate.getTime() < today.getTime()) {
    candidate = clampToMonth(today.getFullYear(), today.getMonth() + 1, day);
  }
  return candidate;
}

/** Smallest stored-date + `interval * k` that is not before today. */
function nextInterval(today: Date, base: Date, interval: number): Date {
  const step = Math.max(1, Math.round(interval));
  const elapsed = Math.floor((today.getTime() - base.getTime()) / 86_400_000);
  if (elapsed <= 0) return base;
  const periods = Math.ceil(elapsed / step);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + periods * step);
}

/**
 * Days until the next occurrence of a countdown.
 *
 * - `none`: the exact date, so past events keep a negative value.
 * - `yearly`: next time that month/day comes around (birthdays).
 * - `monthly`: next time that day-of-month comes around.
 * - `weekly`: next time that weekday comes around (today counts as 0).
 * - `custom`: the stored date plus a whole number of `intervalDays` steps.
 */
export function countdownInfo(
  event: Pick<Countdown, "date" | "repeat" | "intervalDays">,
  now: Date = new Date(),
): CountdownInfo {
  const today = startOfDay(now);
  const base = startOfDay(parseDay(event.date));
  let target = base;

  if (event.repeat === "yearly") {
    target = new Date(today.getFullYear(), base.getMonth(), base.getDate());
    if (target.getTime() < today.getTime()) {
      target = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
    }
  } else if (event.repeat === "monthly") {
    target = nextMonthly(today, base.getDate());
  } else if (event.repeat === "weekly") {
    const offset = (base.getDay() - today.getDay() + 7) % 7;
    target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  } else if (event.repeat === "custom") {
    target = nextInterval(today, base, event.intervalDays ?? 1);
  }

  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const label =
    days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `已过去 ${Math.abs(days)} 天`;

  return {
    days,
    upcoming: days >= 0,
    label,
    weekday: WEEKDAYS[target.getDay()],
    nextDate: dateKey(target),
  };
}
