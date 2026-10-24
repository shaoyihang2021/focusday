# FocusDay v0.13.0 实施计划：预设与正计时、专注目标、任务统计、农历倒数日

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 FocusDay 增加四组能力：多套番茄预设与正计时、每日/每周专注目标、任务与标签维度统计、农历倒数日。

**Architecture:** 纯逻辑放进 `src/lib/*.ts` 并用 Node 原生测试覆盖；`Settings` / `TimerState` / `Todo` / `Countdown` 只做向后兼容的字段扩展；主界面、小组件与托盘都从同一组 helper 派生显示，避免多处口径漂移。UI 沿用现有 `Card` / `Segmented` / `Stepper` 组件，不引入新依赖。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind v4 + Tauri 2；测试用 Node 24 原生 `node --test` + 类型剥离。

---

## 文件结构

**新增**

- `src/lib/timerPresets.ts` — 内置番茄预设与「当前预设」匹配
- `src/lib/goals.ts` — 目标进度计算（纯函数）
- `src/lib/focusBreakdown.ts` — 任务 / 标签专注时长汇总（纯函数）
- `src/lib/lunar.ts` — 1900–2100 农历转换、农历日期文案
- `tests/timerPresets.test.ts`
- `tests/timer.test.ts`
- `tests/goals.test.ts`
- `tests/focusBreakdown.test.ts`
- `tests/lunar.test.ts`

**修改**

- `src/types.ts` — `TimerTiming`、`TimerState.timing/startedAt`、`Todo.focusMinutes`、`Settings.dailyGoalMin/weeklyGoalMin`、`Countdown.calendar/leapMonth`
- `src/store/defaults.ts` — 默认值、反序列化清洗、`NewCountdown` 相关字段
- `src/store/useAppStore.ts` — 正计时动作、结束记录、任务分钟累计
- `src/lib/timer.ts` — `initialSeconds` / `displaySeconds` / `timerProgress`
- `src/lib/stats.ts` — 本周日期与本周汇总、连续天数改为按分钟判断
- `src/lib/date.ts` — 农历事件的 `countdownInfo`
- `src/lib/countdown.ts` — 农历标签
- `src/lib/trayTooltip.ts` — 正计时显示 + 目标进度
- `src/components/PomodoroView.tsx` — 预设 chips、正计时切换、结束记录按钮
- `src/components/SettingsView.tsx` — 预设 chips、专注目标、版本号
- `src/components/StatsView.tsx` — 目标进度卡、任务/标签分布卡
- `src/components/TodoView.tsx` — 任务累计专注分钟
- `src/components/CountdownView.tsx` — 公历/农历输入、卡片农历文案
- `src/components/WidgetApp.tsx` — 正计时显示 + 今日目标进度
- `src/components/ManualSection.tsx`、`README.md` — 文档
- `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` — 0.13.0
- `.github/workflows/ci.yml` — 增加逻辑测试步骤

---

### Task 1: 番茄预设库与纯函数测试

**Files:**
- Create: `src/lib/timerPresets.ts`
- Create: `tests/timerPresets.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/timerPresets.test.ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test tests/timerPresets.test.ts`
Expected: FAIL，`Cannot find module .../timerPresets.ts`

- [ ] **Step 3: 写实现**

```ts
// src/lib/timerPresets.ts
import type { Settings } from "../types";

export interface TimerPreset {
  id: string;
  label: string;
  /** `25 / 5 / 15` shown under the label. */
  hint: string;
  workMin: number;
  shortMin: number;
  longMin: number;
}

/** Three ready-made rhythms. Applying one only rewrites the three lengths. */
export const TIMER_PRESETS: TimerPreset[] = [
  { id: "classic", label: "经典", hint: "25 / 5 / 15", workMin: 25, shortMin: 5, longMin: 15 },
  { id: "deep", label: "深度", hint: "50 / 10 / 20", workMin: 50, shortMin: 10, longMin: 20 },
  { id: "sprint", label: "冲刺", hint: "15 / 3 / 10", workMin: 15, shortMin: 3, longMin: 10 },
];

/** The preset matching all three current lengths, or null for a custom mix. */
export function activePreset(settings: Settings): TimerPreset | null {
  return (
    TIMER_PRESETS.find(
      (preset) =>
        preset.workMin === settings.workMin &&
        preset.shortMin === settings.shortMin &&
        preset.longMin === settings.longMin,
    ) ?? null
  );
}

/** Patch applied through `updateSettings`. */
export function presetPatch(preset: TimerPreset): Pick<Settings, "workMin" | "shortMin" | "longMin"> {
  return { workMin: preset.workMin, shortMin: preset.shortMin, longMin: preset.longMin };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-strip-types --test tests/timerPresets.test.ts`
Expected: `# pass 3`

- [ ] **Step 5: 加入测试脚本并提交**

`package.json` 的 `scripts` 增加：

```json
"test:logic": "node --experimental-strip-types --test tests/timerPresets.test.ts tests/timer.test.ts tests/goals.test.ts tests/focusBreakdown.test.ts tests/lunar.test.ts"
```

```bash
git add src/lib/timerPresets.ts tests/timerPresets.test.ts package.json
git commit -m "feat: 增加经典/深度/冲刺三套番茄预设"
```

---

### Task 2: 预设快捷入口（番茄页 + 设置页）

**Files:**
- Modify: `src/components/PomodoroView.tsx`
- Modify: `src/components/SettingsView.tsx`

- [ ] **Step 1: 番茄页加入预设 chips**

在 `PomodoroView` 顶部导入：

```tsx
import { TIMER_PRESETS, activePreset, presetPatch } from "../lib/timerPresets";
```

在「专注 / 休息」与「短休息 / 长休息」两行之下、时长框之上插入：

```tsx
<div className="flex flex-wrap items-center justify-center gap-1.5">
  <span className="text-[11px] text-muted">预设</span>
  {TIMER_PRESETS.map((preset) => {
    const active = activePreset(settings)?.id === preset.id;
    return (
      <button
        key={preset.id}
        type="button"
        disabled={timer.running}
        onClick={() => updateSettings(presetPatch(preset))}
        title={`${preset.label}：专注 ${preset.workMin} · 短休息 ${preset.shortMin} · 长休息 ${preset.longMin}`}
        className={cn(
          "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
          active
            ? "border-brand/40 bg-brand-soft text-brand"
            : "border-line bg-card text-muted hover:text-ink",
          timer.running && "cursor-not-allowed opacity-45",
        )}
      >
        {preset.label} {preset.hint}
      </button>
    );
  })}
</div>
```

- [ ] **Step 2: 设置页加入同一组快捷入口**

`SettingsView` 导入：

```tsx
import { TIMER_PRESETS, activePreset, presetPatch } from "../lib/timerPresets";
```

在「时长预设」Section 的第一个 `Row` 之前插入：

```tsx
<Row label="快速预设" hint="一键套用专注 / 短休息 / 长休息时长">
  <div className="flex flex-wrap justify-end gap-1.5">
    {TIMER_PRESETS.map((preset) => {
      const active = activePreset(settings)?.id === preset.id;
      return (
        <button
          key={preset.id}
          type="button"
          onClick={() => updateSettings(presetPatch(preset))}
          className={
            "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors " +
            (active
              ? "border-brand/40 bg-brand-soft text-brand"
              : "border-line bg-card text-muted hover:text-ink")
          }
        >
          {preset.label} {preset.hint}
        </button>
      );
    })}
  </div>
</Row>
```

- [ ] **Step 3: 类型检查与构建**

Run: `npx tsc --noEmit && npx vite build`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/PomodoroView.tsx src/components/SettingsView.tsx
git commit -m "feat: 番茄页与设置页提供预设快捷切换"
```

---

### Task 3: 正计时的数据模型与计时动作

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/timer.ts`
- Modify: `src/store/defaults.ts`
- Modify: `src/store/useAppStore.ts`
- Create: `tests/timer.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/timer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { displaySeconds, elapsedSeconds, timerProgress } from "../src/lib/timer.ts";

const settings = { workMin: 25, shortMin: 5, longMin: 15 } as never;
const base = {
  mode: "work" as const,
  running: false,
  endAt: null,
  remaining: 1500,
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

test("倒计时进度与正计时小时进度都被夹在 0–1", () => {
  assert.equal(timerProgress(base, settings, Date.now()), 0);
  const almostDone = { ...base, running: true, endAt: Date.now() + 60_000 };
  assert.ok(timerProgress(almostDone, settings, Date.now()) > 0.9);
  const stopwatch = { ...base, timing: "stopwatch" as const, running: true, startedAt: Date.now() - 30 * 60_000 };
  assert.ok(timerProgress(stopwatch, settings, Date.now()) > 0.49);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test tests/timer.test.ts`
Expected: FAIL，`displaySeconds is not a function`（或导出不存在）

- [ ] **Step 3: 扩展类型**

`src/types.ts`：

```ts
/** How a focus round is measured. Breaks always use the countdown. */
export type TimerTiming = "countdown" | "stopwatch";
```

`TimerState` 增加：

```ts
  /** Countdown or open-ended stopwatch (only used by work rounds). */
  timing: TimerTiming;
  /** Epoch ms when a stopwatch round was started/resumed. */
  startedAt: number | null;
```

`Todo` 增加：

```ts
  /** Minutes of focus actually spent on this task. */
  focusMinutes: number;
```

`Settings` 增加：

```ts
  /** Daily / weekly focus goals in minutes; 0 disables the goal. */
  dailyGoalMin: number;
  weeklyGoalMin: number;
```

- [ ] **Step 4: 实现计时 helper**

`src/lib/timer.ts` 追加：

```ts
/** Seconds a mode starts from; a stopwatch work round starts at zero. */
export const initialSeconds = (mode: TimerMode, settings: Settings, timing: TimerTiming): number =>
  timing === "stopwatch" && mode === "work" ? 0 : durationFor(mode, settings);

/** Seconds a running stopwatch has accumulated. */
export const elapsedSeconds = (timer: TimerState, now: number): number =>
  timer.running && timer.startedAt
    ? Math.max(0, Math.floor((now - timer.startedAt) / 1000))
    : Math.max(0, Math.round(timer.remaining));

/** The number shown on the clock: elapsed for a stopwatch, remaining otherwise. */
export const displaySeconds = (timer: TimerState, now: number): number =>
  timer.timing === "stopwatch" && timer.mode === "work"
    ? elapsedSeconds(timer, now)
    : computeRemaining(timer, now);

/** Ring fill, clamped to 0–1. A stopwatch fills one full ring per hour. */
export const timerProgress = (timer: TimerState, settings: Settings, now: number): number => {
  if (timer.timing === "stopwatch" && timer.mode === "work") {
    return Math.min(1, Math.max(0, displaySeconds(timer, now) / 3600));
  }
  const total = durationFor(timer.mode, settings);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - computeRemaining(timer, now) / total));
};
```

同时把 `Settings` / `TimerTiming` 加入第 1 行的 `import type`。

- [ ] **Step 5: 更新默认值与清洗**

`src/store/defaults.ts`：

```ts
const defaultSettings: Settings = {
  // ……现有字段保持不变
  dailyGoalMin: 120,
  weeklyGoalMin: 600,
};

const defaultTimer: TimerState = {
  // ……现有字段保持不变
  timing: "countdown",
  startedAt: null,
};
```

`addTodo` 创建的每个任务加 `focusMinutes: 0`。

`sanitizeState` 中任务映射加：

```ts
focusMinutes: Math.max(0, Math.round(asNumber(todo.focusMinutes, 0))),
```

设置清洗加：

```ts
dailyGoalMin: Math.min(720, Math.max(0, asNumber(settings.dailyGoalMin, defaultSettings.dailyGoalMin))),
weeklyGoalMin: Math.min(5040, Math.max(0, asNumber(settings.weeklyGoalMin, defaultSettings.weeklyGoalMin))),
```

计时器清洗加：

```ts
timing: timer.timing === "stopwatch" ? ("stopwatch" as const) : ("countdown" as const),
startedAt:
  timer.timing === "stopwatch" && typeof timer.startedAt === "number" ? timer.startedAt : null,
```

并在 `if (!merged.timer.running) merged.timer.endAt = null;` 之后补：

```ts
if (!merged.timer.running) merged.timer.startedAt = null;
```

- [ ] **Step 6: 更新 store 的计时动作**

`src/store/useAppStore.ts` 的 Actions 接口增加：

```ts
  /** Switch between countdown and stopwatch (ignored while running). */
  setTiming: (timing: TimerTiming) => void;
  /** Records a stopwatch round and moves to a short break. */
  finishStopwatch: () => void;
```

导入 `initialSeconds` 与 `TimerTiming`。

`start` 替换为：

```ts
  start: () => {
    const { timer, settings } = get();
    if (timer.timing === "stopwatch" && timer.mode === "work") {
      const elapsed = Math.max(0, Math.round(timer.remaining));
      set({
        timer: {
          ...timer,
          running: true,
          endAt: null,
          startedAt: Date.now() - elapsed * 1000,
          remaining: elapsed,
        },
      });
      return;
    }
    const remaining = timer.remaining > 0 ? timer.remaining : durationFor(timer.mode, settings);
    set({
      timer: {
        ...timer,
        running: true,
        remaining,
        startedAt: null,
        endAt: Date.now() + remaining * 1000,
      },
    });
  },
```

`pause` 替换为：

```ts
  pause: () => {
    const { timer } = get();
    if (!timer.running) return;
    if (timer.timing === "stopwatch" && timer.mode === "work") {
      const elapsed = timer.startedAt
        ? Math.max(0, Math.round((Date.now() - timer.startedAt) / 1000))
        : Math.max(0, Math.round(timer.remaining));
      set({
        timer: { ...timer, running: false, endAt: null, startedAt: null, remaining: elapsed },
      });
      return;
    }
    const remaining = timer.endAt
      ? Math.max(0, Math.round((timer.endAt - Date.now()) / 1000))
      : timer.remaining;
    set({ timer: { ...timer, running: false, endAt: null, remaining } });
  },
```

`resetTimer` / `skip` / `setMode` 统一用 `initialSeconds`：

```ts
  resetTimer: () => {
    const { timer, settings } = get();
    set({
      timer: {
        ...timer,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: initialSeconds(timer.mode, settings, timer.timing),
      },
    });
  },

  skip: () => {
    const { timer, settings } = get();
    const nextMode: TimerMode = timer.mode === "work" ? "short" : "work";
    set({
      timer: {
        ...timer,
        mode: nextMode,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: initialSeconds(nextMode, settings, timer.timing),
      },
    });
  },

  setMode: (mode) => {
    const { timer, settings } = get();
    set({
      timer: {
        ...timer,
        mode,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: initialSeconds(mode, settings, timer.timing),
      },
    });
  },
```

新增动作：

```ts
  setTiming: (timing) => {
    const { timer, settings } = get();
    if (timer.running) return;
    set({
      timer: {
        ...timer,
        timing,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: initialSeconds(timer.mode, settings, timing),
      },
    });
  },
```

`completeSession` 中三处调整：

```ts
const duration = initialSeconds(nextMode, settings, timer.timing);
const canStart = autoStart && !(timer.timing === "stopwatch" && nextMode === "work");
// ...
timer: {
  ...timer,
  mode: nextMode,
  round: finished === "work" ? nextRound % every : timer.round,
  running: canStart,
  endAt: canStart ? Date.now() + duration * 1000 : null,
  startedAt: null,
  remaining: duration,
},
```

并让工作番茄同时累计任务分钟：

```ts
const nextTodos =
  finished === "work" && activeId
    ? todos.map((t) =>
        t.id === activeId
          ? { ...t, completed: t.completed + 1, focusMinutes: t.focusMinutes + settings.workMin }
          : t,
      )
    : todos;
```

新增 `finishStopwatch` 到 actions 对象中：

```ts
  finishStopwatch: () => {
    const { timer, settings, todos, focusByDay } = get();
    if (timer.timing !== "stopwatch" || timer.mode !== "work") return;
    const seconds =
      timer.running && timer.startedAt
        ? Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000))
        : Math.max(0, Math.round(timer.remaining));
    const minutes = Math.round(seconds / 60);
    const activeId = timer.activeTodoId;

    const nextTodos =
      minutes > 0 && activeId
        ? todos.map((t) =>
            t.id === activeId ? { ...t, focusMinutes: t.focusMinutes + minutes } : t,
          )
        : todos;

    let nextFocusByDay = focusByDay;
    if (minutes > 0) {
      const key = todayISO();
      const previous = focusByDay[key] ?? { minutes: 0, count: 0 };
      nextFocusByDay = {
        ...focusByDay,
        [key]: { minutes: previous.minutes + minutes, count: previous.count },
      };
    }

    const nextMode: TimerMode = "short";
    set({
      todos: nextTodos,
      focusByDay: nextFocusByDay,
      timer: {
        ...timer,
        mode: nextMode,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: durationFor(nextMode, settings),
      },
    });

    if (minutes > 0) {
      if (settings.sound) playChime();
      if (settings.notify) {
        void notify(`正计时结束 · 已记录 ${minutes} 分钟专注`, "起身活动一下，休息也是生产力。");
      }
    }
  },
```

- [ ] **Step 7: 运行测试与类型检查**

Run: `node --experimental-strip-types --test tests/timer.test.ts && npx tsc --noEmit`
Expected: 4 tests pass，tsc 无错误

- [ ] **Step 8: 提交**

```bash
git add src/types.ts src/lib/timer.ts src/store/defaults.ts src/store/useAppStore.ts tests/timer.test.ts
git commit -m "feat: 计时器支持正计时状态与结束记录"
```

---

### Task 4: 正计时 UI、小组件与托盘

**Files:**
- Modify: `src/components/PomodoroView.tsx`
- Modify: `src/components/WidgetApp.tsx`
- Modify: `src/lib/trayTooltip.ts`

- [ ] **Step 1: 番茄页加正计时切换**

`PomodoroView` 导入追加：

```tsx
import { Check } from "lucide-react";
import { displaySeconds, timerProgress, type TimerTiming } from "../lib/timer";
```

常量：

```tsx
const TIMINGS: { value: TimerTiming; label: string }[] = [
  { value: "countdown", label: "倒计时" },
  { value: "stopwatch", label: "正计时" },
];
```

从 store 取 `setTiming`、`finishStopwatch`；把 `remaining` / `progress` 换成：

```tsx
const clock = displaySeconds(timer, now);
const progress = timerProgress(timer, settings, now);
const stopwatchFocus = timer.timing === "stopwatch" && timer.mode === "work";
```

状态文案：

```tsx
const statusText = timer.running
  ? stopwatchFocus
    ? "正计时进行中"
    : "进行中"
  : stopwatchFocus
    ? clock > 0
      ? "已暂停"
      : "准备就绪"
    : clock < total
      ? "已暂停"
      : "准备就绪";
```

在阶段行右侧（免打扰徽标旁）加入切换器，运行中只读：

```tsx
{phase === "focus" ? (
  <div className={cn(timer.running && "pointer-events-none opacity-45")}>
    <Segmented options={TIMINGS} value={timer.timing} onChange={setTiming} />
  </div>
) : null}
```

时长框在正计时时改为说明：

```tsx
{stopwatchFocus ? (
  <p className="text-xs text-muted">正计时不设时长，结束后按实际专注分钟记录。</p>
) : (
  <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1">
    {/* 原有「XX时长 + Stepper」保持不变 */}
  </div>
)}
```

环形区域：

```tsx
{stopwatchFocus ? (
  <div className="grid h-[268px] w-[268px] place-items-center rounded-full border border-line bg-card">
    <div className="flex flex-col items-center">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">正计时</span>
      <span className="mt-1 text-[58px] leading-none font-bold tabular-nums tracking-tight text-ink">
        {formatClock(clock)}
      </span>
      <span className={cn("mt-2.5 text-xs font-medium", timer.running ? "fd-pulse text-brand" : "text-muted")}>
        {statusText}
      </span>
    </div>
  </div>
) : (
  <Ring progress={progress}>
    {/* 原有 Ring 内容，把 formatClock(remaining) 换成 formatClock(clock) */}
  </Ring>
)}
```

控制区把「跳过」在正计时时替换为「结束并记录」：

```tsx
{stopwatchFocus ? (
  <button
    type="button"
    onClick={finishStopwatch}
    disabled={clock === 0}
    className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-line bg-card px-4 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
  >
    <Check size={16} /> 结束并记录
  </button>
) : (
  <button
    type="button"
    onClick={skip}
    title="跳过"
    className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-card text-muted transition-colors hover:text-ink"
  >
    <SkipForward size={18} />
  </button>
)}
```

- [ ] **Step 2: 小组件改用统一 helper**

`WidgetApp` 导入 `displaySeconds, timerProgress`；删除 `computeRemaining` 与 `durationFor` 的未使用导入，改：

```tsx
const clock = displaySeconds(timer, now);
const progress = timerProgress(timer, settings, now);
```

所有 `formatClock(remaining)` 改为 `formatClock(clock)`；`progress` 来源替换。

模式文案两处改为：

```tsx
const modeText =
  timer.mode === "work"
    ? timer.timing === "stopwatch"
      ? "正计时"
      : "专注"
    : timer.mode === "short"
      ? "短休息"
      : "长休息";
```

用 `modeText` 替换原来的三元表达式。

- [ ] **Step 3: 托盘显示正计时**

`src/lib/trayTooltip.ts` 导入 `displaySeconds`，改：

```ts
const seconds = displaySeconds(timer, Date.now());
const label =
  timer.mode === "work" && timer.timing === "stopwatch" ? "正计时" : modeLabel(timer.mode);
const tooltip = running
  ? `FocusDay · ${label} ${formatClock(seconds)} · 今日 ${todayStat(focusByDay).count} 🍅`
  : IDLE_TOOLTIP;
```

图标分钟仍由 `displaySeconds` 推导：

```ts
const minutes = timer.running ? Math.max(0, Math.ceil(seconds / 60)) : null;
```

- [ ] **Step 4: 构建与浏览器验证**

Run: `npx tsc --noEmit && npx vite build`
Expected: 通过

启动 dev server，在番茄页切换到「正计时」，确认：时长框变成说明、时钟从 `00:00` 开始走、按钮变为「结束并记录」、点击后回到短休息且今日专注分钟增加。

- [ ] **Step 5: 提交**

```bash
git add src/components/PomodoroView.tsx src/components/WidgetApp.tsx src/lib/trayTooltip.ts
git commit -m "feat: 番茄钟支持正计时并在小组件与托盘显示"
```

---

### Task 5: 任务累计专注分钟

**Files:**
- Modify: `src/components/TodoView.tsx`
- Modify: `src/components/PomodoroView.tsx`

（数据写入已在 Task 3 完成。）

- [ ] **Step 1: 待办卡片显示专注时长**

`TodoView` 导入 `humanizeMinutes` from `../lib/timer`，在 `{todo.completed}/{todo.estimate} 🍅` 之后插入：

```tsx
{todo.focusMinutes > 0 ? (
  <span className="text-[11px] tabular-nums text-muted">
    · 专注 {humanizeMinutes(todo.focusMinutes)}
  </span>
) : null}
```

- [ ] **Step 2: 当前专注任务卡片显示累计**

`PomodoroView` 的 `activeTodo` 卡片中，在「已完成 X / Y 个番茄」后追加：

```tsx
{activeTodo.focusMinutes > 0 ? (
  <span className="ml-1.5 text-muted">· 已专注 {humanizeMinutes(activeTodo.focusMinutes)}</span>
) : null}
```

导入 `humanizeMinutes`。

- [ ] **Step 3: 构建并提交**

Run: `npx tsc --noEmit && npx vite build`

```bash
git add src/components/TodoView.tsx src/components/PomodoroView.tsx
git commit -m "feat: 任务与当前专注卡片展示累计专注时长"
```

---

### Task 6: 任务 / 标签维度统计

**Files:**
- Create: `src/lib/focusBreakdown.ts`
- Create: `tests/focusBreakdown.test.ts`
- Modify: `src/components/StatsView.tsx`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/focusBreakdown.test.ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test tests/focusBreakdown.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现**

```ts
// src/lib/focusBreakdown.ts
import type { Tag, Todo } from "../types";

export interface TaskFocus {
  id: string;
  title: string;
  minutes: number;
}

export interface TagFocus {
  id: string;
  name: string;
  color: string;
  minutes: number;
}

/** Tasks with recorded focus, biggest first. */
export function taskFocusRanking(todos: Todo[], limit = 5): TaskFocus[] {
  return todos
    .filter((todo) => todo.focusMinutes > 0)
    .sort((a, b) => b.focusMinutes - a.focusMinutes)
    .slice(0, limit)
    .map((todo) => ({ id: todo.id, title: todo.title, minutes: todo.focusMinutes }));
}

/** Per-tag totals; a task with two tags contributes to both. */
export function tagFocusTotals(todos: Todo[], tags: Tag[]): TagFocus[] {
  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      minutes: todos.reduce(
        (sum, todo) => sum + (todo.tags.includes(tag.id) ? todo.focusMinutes : 0),
        0,
      ),
    }))
    .filter((tag) => tag.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** Focus minutes on tasks that carry no tag at all. */
export const untaggedMinutes = (todos: Todo[]): number =>
  todos.reduce((sum, todo) => sum + (todo.tags.length === 0 ? todo.focusMinutes : 0), 0);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-strip-types --test tests/focusBreakdown.test.ts`
Expected: 2 tests pass

- [ ] **Step 5: 统计页加入分布卡**

`StatsView` 读取 `todos`、`tags`：

```tsx
const todos = useAppStore((s) => s.todos);
const tags = useAppStore((s) => s.tags);
const taskFocus = useMemo(() => taskFocusRanking(todos, 5), [todos]);
const tagFocus = useMemo(() => tagFocusTotals(todos, tags), [todos, tags]);
```

在热力图卡之前插入：

```tsx
<Card className="fd-pop p-6">
  <div className="mb-5">
    <h2 className="text-sm font-semibold text-ink">时间花在哪</h2>
    <p className="mt-0.5 text-xs text-muted">
      番茄钟关联待办后，完成时会把分钟记到任务与标签上
    </p>
  </div>
  <div className="grid gap-6 sm:grid-cols-2">
    <div>
      <p className="mb-2 text-[11px] font-medium tracking-wide text-muted">按任务</p>
      {taskFocus.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">还没有任务专注记录。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {taskFocus.map((task) => (
            <FocusBar
              key={task.id}
              label={task.title}
              minutes={task.minutes}
              max={taskFocus[0].minutes}
            />
          ))}
        </div>
      )}
    </div>
    <div>
      <p className="mb-2 text-[11px] font-medium tracking-wide text-muted">按标签（可重复计入）</p>
      {tagFocus.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">还没有带标签的任务专注记录。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tagFocus.map((tag) => (
            <FocusBar
              key={tag.id}
              label={tag.name}
              minutes={tag.minutes}
              max={tagFocus[0].minutes}
              color={tag.color}
            />
          ))}
        </div>
      )}
    </div>
  </div>
</Card>
```

同文件内新增组件：

```tsx
function FocusBar({
  label,
  minutes,
  max,
  color,
}: {
  label: string;
  minutes: number;
  max: number;
  color?: string;
}) {
  const width = max > 0 ? Math.max(4, (minutes / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-ink">{label}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {humanizeMinutes(minutes)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color ?? "var(--fd-brand)" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 构建、浏览器验证、提交**

Run: `npx tsc --noEmit && npx vite build`

浏览器中给一个任务关联番茄并完成一轮（或直接构造 `focusMinutes`），确认分布卡出现且无 console 错误。

```bash
git add src/lib/focusBreakdown.ts tests/focusBreakdown.test.ts src/components/StatsView.tsx
git commit -m "feat: 统计页新增任务与标签专注分布"
```

---

### Task 7: 专注目标的设置与进度算法

**Files:**
- Create: `src/lib/goals.ts`
- Create: `tests/goals.test.ts`
- Modify: `src/components/SettingsView.tsx`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/goals.test.ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test tests/goals.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现**

```ts
// src/lib/goals.ts
export interface GoalProgress {
  minutes: number;
  goal: number;
  /** 0–100; 0 when no goal has been set. */
  percent: number;
  done: boolean;
}

/** Clamps both sides so negative or fractional input cannot break the UI. */
export function goalProgress(minutes: number, goal: number): GoalProgress {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const safeGoal = Math.max(0, Math.round(goal));
  return {
    minutes: safeMinutes,
    goal: safeGoal,
    percent: safeGoal > 0 ? Math.min(100, Math.round((safeMinutes / safeGoal) * 100)) : 0,
    done: safeGoal > 0 && safeMinutes >= safeGoal,
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --experimental-strip-types --test tests/goals.test.ts`
Expected: 2 tests pass

- [ ] **Step 5: 设置页新增目标区**

`SettingsView` 导入 `Target` 图标（`lucide-react`），在「时长预设」Section 之后插入：

```tsx
<Section icon={<Target size={16} />} title="专注目标">
  <Row label="每日目标" hint="达到后今日进度会变为完成；设为 0 关闭">
    <Stepper
      value={settings.dailyGoalMin}
      min={0}
      max={720}
      step={15}
      suffix="分钟"
      onChange={(v) => updateSettings({ dailyGoalMin: v })}
    />
  </Row>
  <Row label="每周目标" hint="从周一累计到今天，设为 0 关闭">
    <Stepper
      value={settings.weeklyGoalMin}
      min={0}
      max={5040}
      step={30}
      suffix="分钟"
      onChange={(v) => updateSettings({ weeklyGoalMin: v })}
    />
  </Row>
</Section>
```

- [ ] **Step 6: 构建并提交**

Run: `npx tsc --noEmit && npx vite build`

```bash
git add src/lib/goals.ts tests/goals.test.ts src/components/SettingsView.tsx
git commit -m "feat: 设置中可配置每日与每周专注目标"
```

---

### Task 8: 目标进度同步到统计页、小组件与托盘

**Files:**
- Modify: `src/lib/stats.ts`
- Modify: `src/components/StatsView.tsx`
- Modify: `src/components/WidgetApp.tsx`
- Modify: `src/lib/trayTooltip.ts`

- [ ] **Step 1: 本周汇总**

`src/lib/stats.ts` 追加：

```ts
/** Monday-first dates up to and including today. */
export function weekDates(today: string = todayISO()): string[] {
  const d = parseDay(today);
  const offset = (d.getDay() + 6) % 7;
  return Array.from({ length: offset + 1 }, (_, index) => {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + index);
    return dateKey(day);
  });
}

/** Focus recorded this week (Monday through today). */
export const weekStat = (focusByDay: FocusByDay): DayStat =>
  sumDates(focusByDay, weekDates());
```

把 `streakDays` 的判定从 `count > 0` 改为 `minutes > 0`：

```ts
const hasFocus = dayStat(focusByDay, dateKey(d)).minutes > 0;
```

`StatsView` 的空状态判断从 `total.count === 0` 改为 `total.minutes === 0`。

- [ ] **Step 2: 统计页目标卡**

`StatsView` 导入 `goalProgress` 与 `weekStat`，读取 `settings`：

```tsx
const settings = useAppStore((s) => s.settings);
const todayGoal = goalProgress(today.minutes, settings.dailyGoalMin);
const week = weekStat(focusByDay);
const weekGoal = goalProgress(week.minutes, settings.weeklyGoalMin);
```

在四项指标卡之后插入：

```tsx
<Card className="fd-pop p-5">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
      <Target size={16} className="text-brand" />
      专注目标
    </div>
    <p className="text-[11px] text-muted">可在「设置 → 专注目标」调整</p>
  </div>
  <div className="flex flex-col gap-4">
    {[
      { label: "今日", progress: todayGoal },
      { label: "本周", progress: weekGoal },
    ].map(({ label, progress }) => (
      <div key={label}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-ink">{label}</span>
          <span className={cn("text-[11px] tabular-nums", progress.done ? "font-semibold text-brand" : "text-muted")}>
            {progress.goal > 0
              ? `${progress.minutes} / ${progress.goal} 分钟 · ${progress.percent}%`
              : "未设定目标"}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", progress.done ? "bg-brand" : "bg-brand/55")}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    ))}
  </div>
</Card>
```

- [ ] **Step 3: 小组件显示今日目标**

`WidgetApp` 把 `todayCount` 选择器换成完整统计：

```tsx
const today = useAppStore((s) => todayStat(s.focusByDay));
```

原来渲染 `今日 {todayCount}🍅` 的位置改为：

```tsx
<span className="ml-auto text-[10px] text-muted">
  {settings.dailyGoalMin > 0
    ? `今日 ${today.minutes}/${settings.dailyGoalMin} 分`
    : `今日 ${today.count}🍅`}
</span>
```

- [ ] **Step 4: 托盘 tooltip 显示目标**

`src/lib/trayTooltip.ts`：

```ts
const today = todayStat(focusByDay);
const goalText =
  settings.dailyGoalMin > 0
    ? `今日 ${today.minutes}/${settings.dailyGoalMin} 分钟`
    : `今日 ${today.count} 🍅`;
const tooltip = running ? `FocusDay · ${label} ${formatClock(seconds)} · ${goalText}` : `FocusDay · ${goalText}`;
```

当目标为 0 且空闲时仍显示今日番茄数；`IDLE_TOOLTIP` 常量删除或不再使用（删除以避免未使用变量）。

- [ ] **Step 5: 构建、浏览器验证、提交**

Run: `npx tsc --noEmit && npx vite build`

浏览器中设置每日目标为 60，确认统计页出现「今日 0/60 · 0%」、完成一轮专注后百分比上升；小组件文字变为 `今日 X/60 分`。

```bash
git add src/lib/stats.ts src/components/StatsView.tsx src/components/WidgetApp.tsx src/lib/trayTooltip.ts
git commit -m "feat: 专注目标进度同步到统计页、小组件与托盘"
```

---

### Task 9: 农历转换库与测试

**Files:**
- Create: `src/lib/lunar.ts`
- Create: `tests/lunar.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// tests/lunar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  lunarToSolar,
  solarToLunar,
  nextLunarOccurrence,
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
  assert.equal(lunarMonthDays(2025, 6, true), 30);
  assert.equal(lunarToSolar(2026, 6, 1, true), null);
});

test("下一次农历周年跳过今天之前的发生", () => {
  const afterThisYear = new Date(2026, 8, 30);
  assert.equal(iso(nextLunarOccurrence(afterThisYear, 8, 15)), "2027-09-15");
  const before = new Date(2026, 8, 20);
  assert.equal(iso(nextLunarOccurrence(before, 8, 15)), "2026-09-25");
});

test("农历文案包含闰月与月日名", () => {
  assert.equal(lunarDateLabel("2026-08-15"), "农历八月十五");
  assert.equal(lunarDateLabel("2025-06-01", true), "农历闰六月初一");
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test tests/lunar.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 `lunar.ts`**

```ts
// src/lib/lunar.ts
/**
 * Self-contained Chinese lunar calendar conversion for 1900–2100.
 * The table encodes, per year: the 12/13 month lengths, the leap month and
 * whether that leap month has 30 days. This is the widely used compact table.
 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export const LUNAR_MONTHS = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月",
];

export const LUNAR_DAYS = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

const infoFor = (year: number): number | null =>
  year >= MIN_YEAR && year <= MAX_YEAR ? LUNAR_INFO[year - MIN_YEAR] : null;

/** Leap month number (0 = none). */
export function lunarLeapMonth(year: number): number {
  const info = infoFor(year);
  return info === null ? 0 : info & 0xf;
}

const leapDays = (year: number): number => {
  const info = infoFor(year);
  if (info === null || !(info & 0xf)) return 0;
  return info & 0x10000 ? 30 : 29;
};

const monthDays = (year: number, month: number): number => {
  const info = infoFor(year);
  if (info === null) return 0;
  return info & (0x10000 >> month) ? 30 : 29;
};

/** Days inside a lunar month; 0 when the requested leap month does not exist. */
export function lunarMonthDays(year: number, month: number, leap = false): number {
  if (month < 1 || month > 12) return 0;
  if (!leap) return monthDays(year, month);
  return lunarLeapMonth(year) === month ? leapDays(year) : 0;
}

const yearDays = (year: number): number => {
  let sum = 348;
  const info = infoFor(year);
  if (info === null) return 0;
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) {
    if (info & bit) sum += 1;
  }
  return sum + leapDays(year);
};

const BASE_UTC = Date.UTC(1900, 0, 31); // lunar 1900-01-01

/** Converts a lunar date to a local-midnight Date, or null outside the range. */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  leap = false,
): Date | null {
  if (infoFor(year) === null || month < 1 || month > 12) return null;
  if (day < 1 || day > lunarMonthDays(year, month, leap)) return null;

  let offset = 0;
  for (let y = MIN_YEAR; y < year; y += 1) offset += yearDays(y);

  const leapMonth = lunarLeapMonth(year);
  for (let m = 1; m < month; m += 1) {
    offset += monthDays(year, m);
    if (leapMonth === m) offset += leapDays(year);
  }
  if (leap) offset += monthDays(year, month);
  offset += day - 1;

  const utc = new Date(BASE_UTC + offset * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Converts a local Date to its lunar date. */
export function solarToLunar(date: Date): {
  year: number;
  month: number;
  day: number;
  leap: boolean;
} {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let offset = Math.floor((utc - BASE_UTC) / 86_400_000);
  offset = Math.max(0, offset);

  let year = MIN_YEAR;
  while (year <= MAX_YEAR) {
    const days = yearDays(year);
    if (offset < days) break;
    offset -= days;
    year += 1;
  }
  if (year > MAX_YEAR) return { year: MAX_YEAR, month: 12, day: 30, leap: false };

  const leapMonth = lunarLeapMonth(year);
  let leap = false;
  let month = 1;
  while (month <= 12) {
    const days = leap ? leapDays(year) : monthDays(year, month);
    if (offset < days) break;
    offset -= days;
    if (leapMonth === month && !leap) {
      leap = true;
    } else {
      if (leap) leap = false;
      month += 1;
    }
  }
  if (month > 12) return { year, month: 12, day: 30, leap: false };
  return { year, month, day: offset + 1, leap };
}

/**
 * Next solar date for a lunar month/day on or after `today`. A leap-month
 * event falls back to the regular month in years without that leap month.
 */
export function nextLunarOccurrence(
  today: Date,
  month: number,
  day: number,
  leap = false,
): Date | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let year = start.getFullYear() - 1; year <= start.getFullYear() + 2; year += 1) {
    const solar = lunarToSolar(year, month, day, leap) ?? lunarToSolar(year, month, day, false);
    if (solar && solar.getTime() >= start.getTime()) return solar;
  }
  return null;
}

/** `农历八月十五` / `农历闰六月初一` from a `YYYY-MM-DD` lunar string. */
export function lunarDateLabel(date: string, leap = false): string {
  const [, month, day] = date.split("-").map(Number);
  return `农历${leap ? "闰" : ""}${LUNAR_MONTHS[month - 1] ?? ""}${LUNAR_DAYS[day - 1] ?? ""}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-strip-types --test tests/lunar.test.ts`
Expected: 5 tests pass。若已知日期断言失败，先核对 `LUNAR_INFO` 表与测试日期，不要放宽断言。

- [ ] **Step 5: 提交**

```bash
git add src/lib/lunar.ts tests/lunar.test.ts
git commit -m "feat: 增加 1900-2100 农历转换与农历日期文案"
```

---

### Task 10: 倒数日支持农历的数据模型与计算

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/defaults.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `src/lib/date.ts`
- Modify: `src/lib/countdown.ts`

- [ ] **Step 1: 扩展类型**

```ts
export type CountdownCalendar = "solar" | "lunar";
```

`Countdown` 增加的字段是可选的，保证 Task 10 单独提交时旧 UI 仍能通过类型检查；清洗器总会把它们补成 `solar`：

```ts
  /** Whether `date` is interpreted as Gregorian or Chinese lunar. */
  calendar?: CountdownCalendar;
  /** Set when the event is on a leap lunar month. */
  leapMonth?: boolean;
```

`NewCountdown` 增加（同样可选）：

```ts
  calendar?: CountdownCalendar;
  leapMonth?: boolean;
```

- [ ] **Step 2: 清洗与创建**

`defaults.ts` 的 countdown 映射：

```ts
const calendar: CountdownCalendar = entry.calendar === "lunar" ? "lunar" : "solar";
const leapMonth = calendar === "lunar" && entry.leapMonth === true;
const repeat = sanitizeCountdownRepeat(entry);
// Lunar events only support one-off and yearly recurrence.
const safeRepeat = calendar === "lunar" && repeat !== "none" && repeat !== "yearly" ? "yearly" : repeat;
return {
  ...entry,
  repeat: safeRepeat,
  intervalDays,
  style,
  subtitleEn,
  calendar,
  leapMonth,
  widgetPos: asPoint(entry.widgetPos) ?? undefined,
};
```

`addCountdown` 创建的 `item` 加：

```ts
calendar: input.calendar ?? "solar",
leapMonth: input.calendar === "lunar" ? input.leapMonth === true : undefined,
```

- [ ] **Step 3: 计算逻辑**

`src/lib/date.ts` 导入：

```ts
import { lunarToSolar, nextLunarOccurrence } from "./lunar";
```

`countdownInfo` 的 `Pick` 改为：

```ts
event: Pick<Countdown, "date" | "repeat" | "intervalDays" | "calendar" | "leapMonth">,
```

在 `const base = startOfDay(parseDay(event.date));` 之后加：

```ts
const [lunarYear, lunarMonth, lunarDay] = event.date.split("-").map(Number);
```

把 `let target = base;` 与随后的 `if/else if` 链改为先处理农历：

```ts
let target = base;

if (event.calendar === "lunar") {
  target =
    event.repeat === "yearly"
      ? nextLunarOccurrence(today, lunarMonth, lunarDay, event.leapMonth) ?? base
      : lunarToSolar(lunarYear, lunarMonth, lunarDay, event.leapMonth) ?? base;
} else if (event.repeat === "yearly") {
  // ……原有公历每年逻辑保持不变
} else if (event.repeat === "monthly") {
  // ……原有逻辑
} else if (event.repeat === "weekly") {
  // ……原有逻辑
} else if (event.repeat === "custom") {
  // ……原有逻辑
}
```

- [ ] **Step 4: 农历文案**

`src/lib/countdown.ts` 导入 `lunarDateLabel`，导出：

```ts
/** Prefix shown on countdown cards: `农历八月十五` or an empty string. */
export const calendarText = (item: Pick<Countdown, "calendar" | "date" | "leapMonth">): string =>
  item.calendar === "lunar" ? lunarDateLabel(item.date, item.leapMonth) : "";
```

- [ ] **Step 5: 类型检查与提交**

Run: `npx tsc --noEmit`
Expected: 通过（字段可选，旧 UI 不受影响）

```bash
git add src/types.ts src/store/defaults.ts src/store/useAppStore.ts src/lib/date.ts src/lib/countdown.ts
git commit -m "feat: 倒数日数据模型支持农历与闰月"
```

---

### Task 11: 倒数日农历输入与卡片文案

**Files:**
- Modify: `src/components/CountdownView.tsx`

- [ ] **Step 1: 引入农历工具与类型**

```tsx
import {
  LUNAR_DAYS,
  LUNAR_MONTHS,
  lunarLeapMonth,
  lunarMonthDays,
  lunarToSolar,
  solarToLunar,
} from "../lib/lunar";
import { calendarText } from "../lib/countdown";
import { dateKey, formatDate, parseDay, weekdayName } from "../lib/date";
import type { Countdown, CountdownCalendar, CountdownRepeat, CountdownStyle } from "../types";
```

（`dateKey` / `parseDay` 可能已在文件中，合并导入即可。）

- [ ] **Step 2: 新增 CalendarField 组件**

```tsx
interface LunarDraft {
  year: number;
  month: number;
  day: number;
  leap: boolean;
}

const CALENDARS: { value: CountdownCalendar; label: string }[] = [
  { value: "solar", label: "公历" },
  { value: "lunar", label: "农历" },
];

/** Solar date input or the lunar year/month/day pickers, with a live preview. */
function CalendarField({
  calendar,
  solarDate,
  lunar,
  onCalendar,
  onSolarDate,
  onLunar,
  idPrefix,
}: {
  calendar: CountdownCalendar;
  solarDate: string;
  lunar: LunarDraft;
  onCalendar: (next: CountdownCalendar) => void;
  onSolarDate: (next: string) => void;
  onLunar: (next: LunarDraft) => void;
  idPrefix: string;
}) {
  const solar = lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.leap);
  const leapAvailable = lunarLeapMonth(lunar.year) === lunar.month;
  const maxDay = lunarMonthDays(lunar.year, lunar.month, lunar.leap) || 30;

  const patch = (next: Partial<LunarDraft>) => {
    const merged = { ...lunar, ...next };
    if (lunarLeapMonth(merged.year) !== merged.month) merged.leap = false;
    merged.day = Math.min(merged.day, lunarMonthDays(merged.year, merged.month, merged.leap) || 30);
    onLunar(merged);
  };

  const selectClass =
    "rounded-xl border border-line bg-solid px-2 py-2.5 text-sm text-ink outline-none focus:border-brand";

  return (
    <div className="min-w-[280px]">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={`${idPrefix}-solar`} className="text-xs font-medium text-muted">
          目标日期
        </label>
        <Segmented options={CALENDARS} value={calendar} onChange={onCalendar} />
      </div>

      {calendar === "solar" ? (
        <input
          id={`${idPrefix}-solar`}
          type="date"
          lang="zh-CN"
          value={solarDate}
          onChange={(e) => onSolarDate(e.target.value)}
          className="rounded-xl border border-line bg-solid px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="农历年"
              value={lunar.year}
              onChange={(e) => patch({ year: Number(e.target.value) })}
              className={selectClass}
            >
              {Array.from({ length: 201 }, (_, index) => 1900 + index).map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </select>
            <select
              aria-label="农历月"
              value={lunar.month}
              onChange={(e) => patch({ month: Number(e.target.value) })}
              className={selectClass}
            >
              {LUNAR_MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="农历日"
              value={Math.min(lunar.day, maxDay)}
              onChange={(e) => patch({ day: Number(e.target.value) })}
              className={selectClass}
            >
              {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>
                  {LUNAR_DAYS[day - 1]}
                </option>
              ))}
            </select>
            {leapAvailable ? (
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={lunar.leap}
                  onChange={(e) => patch({ leap: e.target.checked })}
                />
                闰{lunar.month}月
              </label>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {solar
              ? `对应公历 ${formatDate(dateKey(solar))} · ${weekdayName(dateKey(solar))}`
              : "该农历日期不存在，请重新选择"}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 新增表单接入**

在 `CountdownView` 增加状态：

```tsx
const [calendar, setCalendar] = useState<CountdownCalendar>("solar");
const [lunar, setLunar] = useState<LunarDraft>(() => solarToLunar(new Date()));
```

把现有的「目标日期」块替换为：

```tsx
<CalendarField
  calendar={calendar}
  solarDate={date}
  lunar={lunar}
  onCalendar={(next) => {
    setCalendar(next);
    if (next === "lunar") {
      setLunar(solarToLunar(parseDay(date)));
      setRepeat((current) => (current === "none" || current === "yearly" ? current : "yearly"));
    }
  }}
  onSolarDate={setDate}
  onLunar={setLunar}
  idPrefix="fd-add"
/>
```

`submit` 改为：

```tsx
const lunarDate = `${lunar.year}-${`${lunar.month}`.padStart(2, "0")}-${`${lunar.day}`.padStart(2, "0")}`;
const targetDate = calendar === "lunar" ? lunarDate : date;
const lunarValid = calendar === "solar" || lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.leap) !== null;
if (!title.trim() || !targetDate || !lunarValid) return;
addCountdown({
  title,
  date: targetDate,
  color,
  repeat,
  intervalDays: repeat === "custom" ? clampInterval(intervalDays) : undefined,
  style,
  subtitleEn: style === "wandering" ? subtitleEn : undefined,
  calendar,
  leapMonth: calendar === "lunar" && lunar.leap ? true : undefined,
});
```

添加按钮的 `disabled` 条件同步加上 `!lunarValid`。重置表单时把 `calendar` 设回 `"solar"`。

- [ ] **Step 4: RepeatField 支持农历限制**

给 `RepeatFieldProps` 增加 `options?: typeof REPEATS`，组件内用：

```tsx
function RepeatField({ repeat, intervalDays, onRepeat, onIntervalDays, options = REPEATS }: RepeatFieldProps) {
```

并把 `<Segmented options={REPEATS} ... />` 改为 `<Segmented options={options} ... />`。

表单与编辑弹窗传：

```tsx
options={calendar === "lunar" ? REPEATS.filter((r) => r.value === "none" || r.value === "yearly") : REPEATS}
```

编辑弹窗里用 `draft.calendar === "lunar"` 判断。

- [ ] **Step 5: 编辑弹窗接入**

`EditDraft` 增加：

```ts
calendar: CountdownCalendar;
lunar: LunarDraft;
```

初始化：

```ts
const initialLunar: LunarDraft =
  item.calendar === "lunar"
    ? {
        year: Number(item.date.slice(0, 4)),
        month: Number(item.date.slice(5, 7)),
        day: Number(item.date.slice(8, 10)),
        leap: item.leapMonth === true,
      }
    : solarToLunar(parseDay(item.date));
```

编辑弹窗里的日期块替换为 `CalendarField`（`idPrefix="fd-edit"`）。切换日历时要同时同步农历草稿与重复周期：

```tsx
onCalendar={(next) => {
  patch({
    calendar: next,
    lunar: next === "lunar" ? solarToLunar(parseDay(draft.date)) : draft.lunar,
    repeat:
      next === "lunar" && draft.repeat !== "none" && draft.repeat !== "yearly"
        ? "yearly"
        : draft.repeat,
  });
}}
```

保存改为：

```ts
const lunarDate = `${draft.lunar.year}-${`${draft.lunar.month}`.padStart(2, "0")}-${`${draft.lunar.day}`.padStart(2, "0")}`;
const targetDate = draft.calendar === "lunar" ? lunarDate : draft.date;
const lunarValid = draft.calendar === "solar" || lunarToSolar(draft.lunar.year, draft.lunar.month, draft.lunar.day, draft.lunar.leap) !== null;
if (!draft.title.trim() || !targetDate || !lunarValid) return;
updateCountdown(item.id, {
  title: draft.title.trim(),
  date: targetDate,
  color: draft.color,
  repeat: draft.repeat,
  intervalDays: clampInterval(draft.intervalDays),
  style: draft.style,
  subtitleEn: draft.style === "wandering" ? draft.subtitleEn.trim() || undefined : undefined,
  calendar: draft.calendar,
  leapMonth: draft.calendar === "lunar" && draft.lunar.leap ? true : undefined,
});
```

`valid` 条件同步更新。

编辑弹窗的 `RepeatField` 传入按 `draft.calendar` 过滤的 options；切换日历时要保证 `repeat` 合法。

- [ ] **Step 6: 卡片显示农历**

两张卡片（`WanderingCard` 与经典卡）的日期行都加上前缀：

```tsx
<p className="mt-0.5 text-[11px] text-muted">
  {calendarText(item) ? `${calendarText(item)} · ` : ""}
  {formatDate(info.nextDate)} · {info.weekday}
  {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
</p>
```

流浪地球卡底部同样：

```tsx
<span>
  {calendarText(item) ? `${calendarText(item)} · ` : ""}
  {formatDate(info.nextDate)} · {info.weekday}
  {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
</span>
```

- [ ] **Step 7: 构建与浏览器验证**

Run: `npx tsc --noEmit && npx vite build`

浏览器添加一条农历八月十五、每年重复的倒数日，确认：
- 预览显示「对应公历 2026年9月25日」
- 卡片显示「农历八月十五 · 2026年9月25日 · 周五」
- 切到公历再切回农历，日期不丢失
- 无 console 错误

- [ ] **Step 8: 提交**

```bash
git add src/components/CountdownView.tsx
git commit -m "feat: 倒数日支持农历日期与闰月输入"
```

---

### Task 12: 文档、版本与发布

**Files:**
- Modify: `src/components/ManualSection.tsx`
- Modify: `README.md`
- Modify: `src/components/SettingsView.tsx`
- Modify: `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 使用手册补充**

`ManualSection`：

- 「番茄钟」新增：
  - `"经典 25/5、深度 50/10、冲刺 15/3 三套预设，一键套用；也可自行微调时长。"`
  - `"专注阶段可切换「正计时」：不设时长，点「结束并记录」后按实际分钟计入统计。"`
- 「倒数日」新增：
  - `"目标日期可切换公历 / 农历，支持闰月；农历事件只支持不重复与每年重复。"`
- 「统计」新增：
  - `"「专注目标」显示今日与本周进度；「时间花在哪」按任务与标签拆分钟。"`

- [ ] **Step 2: README 功能列表补充**

- 番茄钟：加「三套预设」「正计时」
- 倒数日：加「农历 / 闰月」
- 数据统计：加「每日/每周目标」「任务与标签维度分布」

- [ ] **Step 3: 版本号统一为 0.13.0**

```bash
# package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json
0.12.0 -> 0.13.0
```

`SettingsView` 页脚 `FocusDay v0.12.0` → `v0.13.0`。

- [ ] **Step 4: CI 增加逻辑测试**

`.github/workflows/ci.yml` 的前端 job 在 `Type-check and build` 后加：

```yaml
      - name: Logic tests
        run: npm run test:logic
```

- [ ] **Step 5: 全量验证**

```bash
npm run test:logic
npx tsc --noEmit
npx vite build
cd src-tauri && cargo test --quiet
```

Expected：5 个测试文件全部通过、构建通过、Rust 7 项测试通过。

浏览器验证清单：
1. 预设切换后时长与当前选中态同步。
2. 正计时开始、暂停、结束记录、今日分钟与任务分钟都增加。
3. 统计页目标卡与任务/标签分布卡正常，无 console 错误。
4. 农历倒数日新增、编辑、卡片文案、桌面小部件都正常。
5. 浅色/深色模式均无布局溢出。

- [ ] **Step 6: 提交、打 tag、发布**

```bash
git add README.md package.json src-tauri/Cargo.lock src-tauri/Cargo.toml src-tauri/tauri.conf.json .github/workflows/ci.yml src/lib src/store src/components src/types.ts docs/superpowers/plans tests
git commit -m "feat: 预设与正计时、专注目标、任务统计与农历倒数日"
git tag -a v0.13.0 -m "FocusDay v0.13.0"
git -c credential.helper='!gh auth git-credential' push origin main
git -c credential.helper='!gh auth git-credential' push origin v0.13.0
```

等待 Release workflow 成功，然后下载安装包到 `/workspace`：

```bash
cd /workspace/focusday
gh release download v0.13.0 --pattern '*setup.exe' --pattern '*.msi' --dir /workspace --clobber
```

---

## 自检

- 覆盖：预设（Task 1–2）、正计时（Task 3–4）、任务分钟与任务/标签统计（Task 3/5/6）、目标（Task 3/7/8）、农历（Task 9–11）、文档与发布（Task 12）。
- 命名一致性：`TimerTiming`、`displaySeconds`、`timerProgress`、`goalProgress`、`lunarDateLabel`、`calendarText`、`focusMinutes` 在所有任务中使用同一拼写。
- 数据兼容：所有新字段都有默认值与反序列化清洗，旧备份可直接导入；农历事件的非法重复周期会被修正为「每年」。
- 已知取舍：任务删除后其专注分钟不再出现在维度统计中；正计时不足 1 分钟不记录；农历事件暂不支持每月/每周重复。
