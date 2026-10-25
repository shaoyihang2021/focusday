/**
 * Self-contained Chinese lunar calendar conversion for 1900–2100.
 * The table encodes, per year: the 12/13 month lengths, the leap month and
 * whether that leap month has 30 days. This is the widely used compact table.
 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export const LUNAR_MONTHS = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
];

export const LUNAR_DAYS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
];

const infoFor = (year: number): number | null =>
  year >= MIN_YEAR && year <= MAX_YEAR ? LUNAR_INFO[year - MIN_YEAR] : null;

/** Leap month number (0 = none). */
export function lunarLeapMonth(year: number): number {
  const info = infoFor(year);
  return info === null ? 0 : info & 0xf;
}

const leapDays = (year: number): number => {
  const info = infoFor(year);
  if (info === null || !(info & 0xf)) return 0;
  return info & 0x10000 ? 30 : 29;
};

const monthDays = (year: number, month: number): number => {
  const info = infoFor(year);
  if (info === null) return 0;
  return info & (0x10000 >> month) ? 30 : 29;
};

/** Days inside a lunar month; 0 when the requested leap month does not exist. */
export function lunarMonthDays(year: number, month: number, leap = false): number {
  if (month < 1 || month > 12) return 0;
  if (!leap) return monthDays(year, month);
  return lunarLeapMonth(year) === month ? leapDays(year) : 0;
}

const yearDays = (year: number): number => {
  let sum = 348;
  const info = infoFor(year);
  if (info === null) return 0;
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if (info & bit) sum += 1;
  }
  return sum + leapDays(year);
};

const BASE_UTC = Date.UTC(1900, 0, 31); // lunar 1900-01-01

/** Converts a lunar date to a local-midnight Date, or null outside the range. */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leap = false,
): Date | null {
  if (infoFor(year) === null || month < 1 || month > 12) return null;
  if (day < 1 || day > lunarMonthDays(year, month, leap)) return null;

  let offset = 0;
  for (let y = MIN_YEAR; y < year; y += 1) offset += yearDays(y);

  const leapMonth = lunarLeapMonth(year);
  for (let m = 1; m < month; m += 1) {
    offset += monthDays(year, m);
    if (leapMonth === m) offset += leapDays(year);
  }
  if (leap) offset += monthDays(year, month);
  offset += day - 1;

  const utc = new Date(BASE_UTC + offset * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Converts a local Date to its lunar date. */
export function solarToLunar(date: Date): {
  year: number;
  month: number;
  day: number;
  leap: boolean;
} {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let offset = Math.floor((utc - BASE_UTC) / 86_400_000);
  offset = Math.max(0, offset);

  let year = MIN_YEAR;
  while (year <= MAX_YEAR) {
    const days = yearDays(year);
    if (offset < days) break;
    offset -= days;
    year += 1;
  }
  if (year > MAX_YEAR) return { year: MAX_YEAR, month: 12, day: 30, leap: false };

  const leapMonth = lunarLeapMonth(year);
  let leap = false;
  let month = 1;
  while (month <= 12) {
    const days = leap ? leapDays(year) : monthDays(year, month);
    if (offset < days) break;
    offset -= days;
    if (leapMonth === month && !leap) {
      leap = true;
    } else {
      if (leap) leap = false;
      month += 1;
    }
  }
  if (month > 12) return { year, month: 12, day: 30, leap: false };
  return { year, month, day: offset + 1, leap };
}

export interface LunarOccurrence {
  date: Date;
  /** Whether this occurrence falls in the leap month. */
  leap: boolean;
}

/**
 * Next solar occurrence for a lunar month/day on or after `today`. A leap-month
 * event falls back to the regular month in years without that leap month.
 */
export function nextLunarOccurrenceInfo(
  today: Date,
  month: number,
  day: number,
  leap = false,
): LunarOccurrence | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let year = start.getFullYear() - 1; year <= start.getFullYear() + 2; year += 1) {
    const candidates = leap ? [true, false] : [false];
    for (const candidateLeap of candidates) {
      const solar = lunarToSolar(year, month, day, candidateLeap);
      if (solar && solar.getTime() >= start.getTime()) {
        return { date: solar, leap: candidateLeap };
      }
    }
  }
  return null;
}

/** Date-only convenience wrapper used by countdowns and tests. */
export function nextLunarOccurrence(
  today: Date,
  month: number,
  day: number,
  leap = false,
): Date | null {
  return nextLunarOccurrenceInfo(today, month, day, leap)?.date ?? null;
}

/** `阴历八月十五` / `阴历闰六月初一` from a `YYYY-MM-DD` lunar string. */
export function lunarDateLabel(date: string, leap = false): string {
  const [, month, day] = date.split("-").map(Number);
  return `阴历${leap ? "闰" : ""}${LUNAR_MONTHS[month - 1] ?? ""}${LUNAR_DAYS[day - 1] ?? ""}`;
}
