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

/** `2026年10月13日 周二` — used where the weekday adds useful context. */
export const formatDateWithWeekday = (dateStr: string): string =>
  `${formatDate(dateStr)} ${weekdayName(dateStr)}`;

/** `10月13日` — compact label for chart axes. */
export const shortDate = (dateStr: string): string => {
  const d = parseDay(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

/** `2026年10月` — month heading for the heatmap. */
export const formatMonth = (year: number, month: number): string => `${year}年${month}月`;

/**
 * Number of days until the target date. Non-repeating events in the past keep
 * a negative value so we can render "已过去 N 天". Yearly events roll over to
 * the next occurrence.
 */
export function countdownInfo(
  dateStr: string,
  yearly: boolean,
  now: Date = new Date(),
): CountdownInfo {
  const today = startOfDay(now);
  const base = startOfDay(parseDay(dateStr));
  let target = base;

  if (yearly) {
    target = new Date(today.getFullYear(), base.getMonth(), base.getDate());
    if (target.getTime() < today.getTime()) {
      target = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate());
    }
  }

  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const label =
    days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `已过去 ${Math.abs(days)} 天`;

  return {
    days,
    upcoming: days >= 0,
    label,
    weekday: WEEKDAYS[target.getDay()],
  };
}
