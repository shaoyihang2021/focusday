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
 * Copy shared by the poster card and the desktop widget. Both always count the
 * exact number of days so the number matches what the date actually means.
 */
export function posterContent(item: Countdown, info: CountdownInfo): PosterContent {
  const past = info.days < 0;
  const value = Math.abs(info.days);
  const unitCn = "天";
  const unitEn = value > 1 ? "DAYS" : "DAY";

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
