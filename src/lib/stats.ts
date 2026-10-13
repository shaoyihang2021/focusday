import type { DayStat, FocusByDay } from "../types";
import { dateKey, parseDay, todayISO } from "./date";

const EMPTY: DayStat = { minutes: 0, count: 0 };

export const dayStat = (focusByDay: FocusByDay, date: string): DayStat =>
  focusByDay[date] ?? EMPTY;

/** Focus recorded today — the single source of truth for daily counters. */
export const todayStat = (focusByDay: FocusByDay): DayStat => dayStat(focusByDay, todayISO());

export interface DayEntry {
  date: string;
  stat: DayStat;
}

/** The last `days` calendar days, oldest first, including empty ones. */
export function lastDays(focusByDay: FocusByDay, days: number): DayEntry[] {
  const today = parseDay(todayISO());
  return Array.from({ length: days }, (_, i) => {
    const back = days - 1 - i;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const date = dateKey(d);
    return { date, stat: dayStat(focusByDay, date) };
  });
}

/** Totals across every recorded day. */
export function totals(focusByDay: FocusByDay): DayStat {
  let minutes = 0;
  let count = 0;
  for (const stat of Object.values(focusByDay)) {
    minutes += stat.minutes;
    count += stat.count;
  }
  return { minutes, count };
}

/**
 * Number of consecutive days (ending today or yesterday) with at least one
 * finished pomodoro. Today not being started yet does not break the streak.
 */
export function streakDays(focusByDay: FocusByDay): number {
  const today = parseDay(todayISO());
  let streak = 0;
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const hasFocus = dayStat(focusByDay, dateKey(d)).count > 0;
    if (hasFocus) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
    // i === 0 && !hasFocus: today is still empty, keep counting from yesterday.
  }
  return streak;
}
