import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeState } from "../src/store/defaults.ts";

test("旧数据缺少回合时长时按当前模式补齐", () => {
  const state = sanitizeState({
    settings: { workMin: 25, shortMin: 5, longMin: 15 },
    timer: { mode: "short", timing: "countdown", remaining: 300 },
  });
  assert.equal(state.timer.duration, 300);
});

test("已保存的回合时长在重启后保留，不被当前设置覆盖", () => {
  const state = sanitizeState({
    settings: { workMin: 50, shortMin: 5, longMin: 15 },
    timer: { mode: "work", timing: "countdown", duration: 1500, remaining: 300 },
  });
  assert.equal(state.timer.duration, 1500);
});

test("缺少剩余时间时按当前模式的时长补齐", () => {
  const state = sanitizeState({
    settings: { workMin: 25, shortMin: 5, longMin: 15 },
    timer: { mode: "short", timing: "countdown" },
  });
  assert.equal(state.timer.remaining, 300);
  assert.equal(state.timer.duration, 300);
});
