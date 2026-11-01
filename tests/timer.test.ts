import test from "node:test";
import assert from "node:assert/strict";
import { displaySeconds, elapsedSeconds, roundMinutes, timerProgress } from "../src/lib/timer.ts";

const settings = { workMin: 25, shortMin: 5, longMin: 15 } as never;
const base = {
  mode: "work" as const,
  running: false,
  endAt: null,
  remaining: 1500,
  duration: 1500,
  round: 0,
  activeTodoId: null,
  timing: "countdown" as const,
  startedAt: null,
};

test("倒计时仍按剩余秒数显示", () => {
  assert.equal(displaySeconds(base, Date.now()), 1500);
});

test("正计时按 startedAt 推导已用秒数", () => {
  const timer = { ...base, timing: "stopwatch" as const, running: true, startedAt: 10_000 };
  assert.equal(elapsedSeconds(timer, 42_400), 32);
  assert.equal(displaySeconds(timer, 42_400), 32);
});

test("正计时暂停后沿用累计秒数", () => {
  const timer = { ...base, timing: "stopwatch" as const, running: false, remaining: 95 };
  assert.equal(displaySeconds(timer, 999_999), 95);
});

test("暂停时保留亚秒精度且显示口径与运行中一致", () => {
  const pausedCountdown = { ...base, remaining: 3.028 };
  assert.equal(displaySeconds(pausedCountdown, 0), 4);
  const pausedStopwatch = { ...base, timing: "stopwatch" as const, remaining: 50.582 };
  assert.equal(displaySeconds(pausedStopwatch, 0), 50);
});

test("倒计时进度与正计时小时进度都被夹在 0–1", () => {
  assert.equal(timerProgress(base, settings, Date.now()), 0);
  const almostDone = { ...base, running: true, endAt: Date.now() + 60_000 };
  assert.ok(timerProgress(almostDone, settings, Date.now()) > 0.9);
  const stopwatch = {
    ...base,
    timing: "stopwatch" as const,
    running: true,
    startedAt: Date.now() - 30 * 60_000,
  };
  assert.ok(timerProgress(stopwatch, settings, Date.now()) > 0.49);
});

test("进度按回合自身时长计算，运行中改设置不会拉伸进度", () => {
  const now = 1_000_000;
  const drifted = {...base, running: true, endAt: now + 600_000, remaining: 600};
  const longerSettings = { workMin: 50, shortMin: 10, longMin: 20 } as never;
  assert.equal(timerProgress(drifted, longerSettings, now), 0.6);
});

test("完成的回合按自身时长折算分钟，而不是当前设置", () => {
  assert.equal(roundMinutes(base), 25);
  assert.equal(roundMinutes({ ...base, duration: 90 }), 2);
  assert.equal(roundMinutes({ ...base, duration: 0 }), 0);
});
