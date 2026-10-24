import test from "node:test";
import assert from "node:assert/strict";
import { goalProgress } from "../src/lib/goals.ts";

test("按比例计算目标进度并封顶 100%", () => {
  assert.deepEqual(goalProgress(60, 120), {
    minutes: 60,
    goal: 120,
    percent: 50,
    done: false,
  });
  assert.equal(goalProgress(180, 120).percent, 100);
  assert.equal(goalProgress(180, 120).done, true);
});

test("目标为 0 时视为未设置", () => {
  assert.deepEqual(goalProgress(90, 0), {
    minutes: 90,
    goal: 0,
    percent: 0,
    done: false,
  });
});
