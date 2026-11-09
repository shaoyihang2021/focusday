import test from "node:test";
import assert from "node:assert/strict";
import { posterContent } from "../src/lib/countdown.ts";
import type { Countdown } from "../src/types.ts";

const item = {
  id: "c1",
  title: "旅行",
  date: "2027-03-17",
  color: "#f74a2c",
  pinned: false,
  repeat: "none",
  style: "wandering",
  createdAt: 0,
} satisfies Countdown;

const info = (days: number) => ({
  days,
  upcoming: days >= 0,
  label: "",
  weekday: "",
  nextDate: "2027-03-17",
});

test("海报卡片在 30 天以上仍按月取整", () => {
  const content = posterContent(item, info(128));
  assert.equal(content.value, 4);
  assert.equal(content.unitCn, "个月");
});

test("倒数日小组件按完整天数显示，不换算成月", () => {
  const content = posterContent(item, info(128), { coarse: false });
  assert.equal(content.value, 128);
  assert.equal(content.unitCn, "天");
  assert.deepEqual(content.lines, ["128 DAYS TO GO"]);
});

test("已经过去的日子同样按完整天数显示", () => {
  const content = posterContent(item, info(-45), { coarse: false });
  assert.equal(content.lead, "已过去");
  assert.equal(content.value, 45);
  assert.equal(content.unitCn, "天");
  assert.deepEqual(content.lines, ["45 DAYS AGO"]);
});
