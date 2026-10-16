import type { DayStat, FocusByDay } from "../types";
import { dateKey, parseDay, shortDate, todayISO, weekdayName } from "./date";

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

export interface HeatCell {
  date: string;
  stat: DayStat;
  /** False for the leading/trailing padding cells that belong to other months. */
  inMonth: boolean;
}

/**
 * Calendar grid for one month, laid out Monday-first (Chinese convention).
 * Returns whole weeks so every row has exactly seven cells.
 */
export function monthGrid(
  focusByDay: FocusByDay,
  year: number,
  month: number,
): HeatCell[][] {
  const first = new Date(year, month - 1, 1);
  // getDay(): 0 = Sunday. Shift so Monday becomes index 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;

  const weeks: HeatCell[][] = [];
  for (let index = 0; index < totalCells; index += 1) {
    if (index % 7 === 0) weeks.push([]);
    const dayOffset = index - lead + 1;
    const d = new Date(year, month - 1, dayOffset);
    const date = dateKey(d);
    weeks[weeks.length - 1].push({
      date,
      stat: dayStat(focusByDay, date),
      inMonth: d.getMonth() === month - 1,
    });
  }
  return weeks;
}

/** Highest single-day minutes inside a month (used for heat levels). */
export const monthPeak = (weeks: HeatCell[][]): number =>
  Math.max(0, ...weeks.flat().filter((c) => c.inMonth).map((c) => c.stat.minutes));

export interface MonthBucket {
  year: number;
  month: number;
  stat: DayStat;
}

/** Totals for the last `count` months, oldest first. */
export function lastMonths(focusByDay: FocusByDay, count: number): MonthBucket[] {
  const base = new Date();
  return Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const cursor = new Date(base.getFullYear(), base.getMonth() - back, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    let minutes = 0;
    let sessions = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const stat = dayStat(focusByDay, dateKey(new Date(year, month - 1, day)));
      minutes += stat.minutes;
      sessions += stat.count;
    }
    return { year, month, stat: { minutes, count: sessions } };
  });
}

/** Totals across an explicit list of date keys. */
export function sumDates(focusByDay: FocusByDay, dates: string[]): DayStat {
  return dates.reduce<DayStat>(
    (acc, date) => {
      const stat = dayStat(focusByDay, date);
      return { minutes: acc.minutes + stat.minutes, count: acc.count + stat.count };
    },
    { minutes: 0, count: 0 },
  );
}

/**
 * Whole-year calendar grid, Monday-first and padded to full weeks, laid out
 * column-per-week (GitHub contribution graph style).
 */
export function yearGrid(focusByDay: FocusByDay, year: number): HeatCell[][] {
  const first = new Date(year, 0, 1);
  const lead = (first.getDay() + 6) % 7;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalCells = Math.ceil((lead + (isLeap ? 366 : 365)) / 7) * 7;

  const weeks: HeatCell[][] = [];
  for (let index = 0; index < totalCells; index += 1) {
    if (index % 7 === 0) weeks.push([]);
    const d = new Date(year, 0, index - lead + 1);
    const date = dateKey(d);
    weeks[weeks.length - 1].push({
      date,
      stat: dayStat(focusByDay, date),
      inMonth: d.getFullYear() === year,
    });
  }
  return weeks;
}

/** Time span shared by the in-page charts and the exported share card. */
export type StatsRange = "week" | "month" | "year";

/** One column of the bar chart. Days for 7/30 day ranges, months for a year. */
export interface RangeBar {
  key: string;
  label: string;
  sub: string;
  minutes: number;
  count: number;
  /** The bar that gets the accent treatment (today / current month). */
  emphasis: boolean;
}

/**
 * Builds the bar chart buckets for a range. Day ranges label each bar with the
 * weekday, the year range with the month name, so both the on-screen chart and
 * the exported image stay identical.
 */
export function rangeBars(focusByDay: FocusByDay, range: StatsRange): RangeBar[] {
  if (range === "year") {
    const now = new Date();
    return lastMonths(focusByDay, 12).map((bucket) => ({
      key: `${bucket.year}-${bucket.month}`,
      label: `${bucket.month}月`,
      sub: `${bucket.year}`,
      minutes: bucket.stat.minutes,
      count: bucket.stat.count,
      emphasis: bucket.year === now.getFullYear() && bucket.month === now.getMonth() + 1,
    }));
  }
  return lastDays(focusByDay, range === "week" ? 7 : 30).map((day) => ({
    key: day.date,
    label: weekdayName(day.date),
    sub: shortDate(day.date),
    minutes: day.stat.minutes,
    count: day.stat.count,
    emphasis: day.date === todayISO(),
  }));
}
