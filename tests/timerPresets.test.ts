import test from "node:test";
import assert from "node:assert/strict";
import {
  TIMER_PRESETS,
  activePresetId,
  defaultPresetValues,
  presetHint,
  presetPatch,
  rememberPresetEdit,
} from "../src/lib/timerPresets.ts";

const settings = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  presetValues: defaultPresetValues,
};

test("内置三套预设覆盖经典、深度与冲刺", () => {
  assert.deepEqual(
    TIMER_PRESETS.map((p) => p.id),
    ["classic", "deep", "sprint"],
  );
  assert.deepEqual(
    TIMER_PRESETS.map((p) => [p.defaults.workMin, p.defaults.shortMin, p.defaults.longMin]),
    [
      [25, 5, 15],
      [50, 10, 20],
      [15, 3, 10],
    ],
  );
  assert.equal(presetHint(defaultPresetValues.classic), "25 / 5 / 15");
});

test("当前时长完全匹配时才算命中预设", () => {
  assert.equal(activePresetId(settings as never), "classic");
  assert.equal(activePresetId({ ...settings, workMin: 30 } as never), null);
  assert.equal(activePresetId({ ...settings, longMin: 30 } as never), null);
});

test("套用预设取用它记住的三个时长", () => {
  assert.deepEqual(presetPatch(settings as never, "deep"), {
    workMin: 50,
    shortMin: 10,
    longMin: 20,
  });
});

test("微调后的数字会记回当前预设，其它预设不变", () => {
  const edited = rememberPresetEdit(defaultPresetValues, "sprint", {
    workMin: 20,
    shortMin: 3,
    longMin: 10,
  });
  assert.deepEqual(edited.sprint, { workMin: 20, shortMin: 3, longMin: 10 });
  assert.deepEqual(edited.classic, defaultPresetValues.classic);
  assert.deepEqual(edited.deep, defaultPresetValues.deep);
  assert.equal(presetHint(edited.sprint), "20 / 3 / 10");
});

test("没有命中预设时不会改动任何预设", () => {
  const untouched = rememberPresetEdit(defaultPresetValues, null, {
    workMin: 20,
    shortMin: 4,
    longMin: 12,
  });
  assert.deepEqual(untouched, defaultPresetValues);
});
