import test from "node:test";
import assert from "node:assert/strict";
import {
  lunarToSolar,
  solarToLunar,
  nextLunarOccurrence,
  nextLunarOccurrenceInfo,
  lunarMonthDays,
  lunarLeapMonth,
  lunarDateLabel,
} from "../src/lib/lunar.ts";

const iso = (date: Date | null): string | null =>
  date
    ? `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`
    : null;

test("已知农历日期转公历", () => {
  assert.equal(iso(lunarToSolar(2024, 8, 15)), "2024-09-17");
  assert.equal(iso(lunarToSolar(2026, 8, 15)), "2026-09-25");
  assert.equal(iso(lunarToSolar(2025, 6, 1, true)), "2025-07-25");
});

test("公历转农历可还原月日", () => {
  assert.deepEqual(solarToLunar(new Date(2026, 8, 25)), {
    year: 2026,
    month: 8,
    day: 15,
    leap: false,
  });
});

test("闰月只在存在的年份生效", () => {
  assert.equal(lunarLeapMonth(2025), 6);
  assert.equal(lunarMonthDays(2025, 6, true), 29);
  assert.equal(lunarToSolar(2026, 6, 1, true), null);
});

test("下一次农历周年跳过今天之前的发生", () => {
  const afterThisYear = new Date(2026, 8, 30);
  assert.equal(iso(nextLunarOccurrence(afterThisYear, 8, 15)), "2027-09-15");
  const before = new Date(2026, 8, 20);
  assert.equal(iso(nextLunarOccurrence(before, 8, 15)), "2026-09-25");
});

test("闰月事件在没有闰月的年份回落到普通月", () => {
  const occurrence = nextLunarOccurrenceInfo(new Date(2027, 0, 1), 6, 1, true);
  assert.equal(iso(occurrence?.date ?? null), "2027-07-04");
  assert.equal(occurrence?.leap, false);
});

test("阴历文案包含闰月与月日名", () => {
  assert.equal(lunarDateLabel("2026-08-15"), "阴历八月十五");
  assert.equal(lunarDateLabel("2025-06-01", true), "阴历闰六月初一");
});
