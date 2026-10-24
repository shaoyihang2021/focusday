import test from "node:test";
import assert from "node:assert/strict";
import { TIMER_PRESETS, activePreset, presetPatch } from "../src/lib/timerPresets.ts";

const settings = { workMin: 25, shortMin: 5, longMin: 15 };

test("内置三套预设覆盖经典、深度与冲刺", () => {
  assert.deepEqual(
    TIMER_PRESETS.map((p) => p.id),
    ["classic", "deep", "sprint"],
  );
  assert.deepEqual(
    TIMER_PRESETS.map((p) => [p.workMin, p.shortMin, p.longMin]),
    [
      [25, 5, 15],
      [50, 10, 20],
      [15, 3, 10],
    ],
  );
});

test("当前时长完全匹配时才算命中预设", () => {
  assert.equal(activePreset(settings as never)?.id, "classic");
  assert.equal(activePreset({ ...settings, workMin: 30 } as never), null);
  assert.equal(activePreset({ ...settings, longMin: 30 } as never), null);
});

test("套用预设置只改三个时长字段", () => {
  const preset = TIMER_PRESETS[1];
  assert.deepEqual(presetPatch(preset), { workMin: 50, shortMin: 10, longMin: 20 });
});
