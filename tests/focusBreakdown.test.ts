import test from "node:test";
import assert from "node:assert/strict";
import { taskFocusRanking, tagFocusTotals } from "../src/lib/focusBreakdown.ts";

const tags = [
  { id: "a", name: "工作", color: "#111" },
  { id: "b", name: "学习", color: "#222" },
];
const todos = [
  { id: "1", title: "写方案", focusMinutes: 90, tags: ["a"] },
  { id: "2", title: "背单词", focusMinutes: 45, tags: ["a", "b"] },
  { id: "3", title: "整理房间", focusMinutes: 0, tags: ["b"] },
];

test("任务按专注分钟降序，过滤 0 分钟", () => {
  const ranking = taskFocusRanking(todos as never, 5);
  assert.deepEqual(
    ranking.map((t) => [t.id, t.minutes]),
    [
      ["1", 90],
      ["2", 45],
    ],
  );
});

test("标签汇总会把同一任务的分钟计入它的每个标签", () => {
  const totals = tagFocusTotals(todos as never, tags as never);
  assert.deepEqual(
    totals.map((t) => [t.id, t.minutes]),
    [
      ["a", 135],
      ["b", 45],
    ],
  );
});
