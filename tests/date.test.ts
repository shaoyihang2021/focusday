import test from "node:test";
import assert from "node:assert/strict";
import { countdownInfo, daysInMonth, shiftMonth } from "../src/lib/date.ts";

const leapEvent = {
  date: "2024-02-29",
  repeat: "yearly" as const,
  calendar: "solar" as const,
  leapMonth: false,
  intervalDays: 1,
};

test("每年重复的 2 月 29 日在平年落到 2 月 28 日", () => {
  const info = countdownInfo(leapEvent, new Date(2025, 1, 10));
  assert.equal(info.nextDate, "2025-02-28");
  assert.equal(info.days, 18);
});

test("闰年仍落在 2 月 29 日", () => {
  const info = countdownInfo(leapEvent, new Date(2024, 1, 10));
  assert.equal(info.nextDate, "2024-02-29");
  assert.equal(info.days, 19);
});

test("2 月 29 日刚过时下一次是平年的 2 月 28 日", () => {
  const info = countdownInfo(leapEvent, new Date(2024, 2, 1));
  assert.equal(info.nextDate, "2025-02-28");
  assert.equal(info.days, 364);
});

test("日期滚轮跨月时正确进位、退位", () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test("日期滚轮的每月天数包含闰年处理", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 1), 31);
});
