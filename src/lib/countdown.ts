import type { Countdown, CountdownRepeat } from "../types";
import type { CountdownInfo } from "./date";
import { lunarDateLabel } from "./lunar";

/** Guard rails for the custom recurrence interval. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

const REPEAT_LABEL: Record<CountdownRepeat, string> = {
  none: "",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
  custom: "",
};

/** `每 14 天` — the custom interval badge; other repeats use `REPEAT_LABEL`. */
export const repeatText = (item: Countdown): string =>
  item.repeat === "custom"
    ? `每 ${item.intervalDays ?? MIN_INTERVAL_DAYS} 天`
    : REPEAT_LABEL[item.repeat];

export const clampInterval = (value: number): number =>
  Math.round(Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, value || MIN_INTERVAL_DAYS)));

/** Prefix shown on cards: `农历八月十五`, or an empty string for Gregorian. */
export const calendarText = (
  item: Pick<Countdown, "calendar" | "date" | "leapMonth">,
  lunarLeap = item.leapMonth === true,
): string => (item.calendar === "lunar" ? lunarDateLabel(item.date, lunarLeap) : "");

export interface PosterContent {
  lead: string;
  value: number;
  unitCn: string;
  /** Upper-case English lines printed under the number. */
  lines: string[];
}

/**
 * Coarse copy shared by the poster card and the desktop widget: once the gap is
 * a month or more it counts in months (like the reference poster), otherwise
 * in days.
 */
export function posterContent(item: Countdown, info: CountdownInfo): PosterContent {
  const past = info.days < 0;
  const abs = Math.abs(info.days);
  const inMonths = abs >= 30;
  const value = inMonths ? Math.max(1, Math.floor(abs / 30)) : abs;
  const unitCn = inMonths ? "个月" : "天";
  const unitEn = inMonths ? (value > 1 ? "MONTHS" : "MONTH") : value > 1 ? "DAYS" : "DAY";

  const base =
    info.days === 0
      ? "IT'S TODAY"
      : past
        ? `${value} ${unitEn} AGO`
        : item.subtitleEn
          ? `IS STILL ${value} ${unitEn} OUT`
          : `${value} ${unitEn} TO GO`;

  return {
    lead: past ? "已过去" : "还剩",
    value,
    unitCn,
    lines: item.subtitleEn ? [item.subtitleEn.toUpperCase(), base] : [base],
  };
}
