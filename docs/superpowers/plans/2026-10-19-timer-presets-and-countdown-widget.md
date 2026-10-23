# 番茄钟预设分组 + 倒数日独立桌面小组件 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把番茄钟改成「专注 / 休息」两档并可当场改时长，同时让倒数日卡片右上角的图钉真正在桌面上生成一个独立小组件窗口。

**Architecture:** 计时器继续沿用 `TimerMode = "work" | "short" | "long"` 数据模型，只在 `PomodoroView` 里做「专注 / 休息」两段式分组，短休息与长休息成为休息下的两个预设，当前预设的时长用 `Stepper` 就地编辑。倒数日图钉改为声明式同步：主窗口监听所有 `pinned` 的倒数日 id，调用新的 Rust 命令 `sync_countdown_widgets`，由 Rust 为每个 id 维护一个 `cd-<id>` 独立无边框窗口；窗口按 hash 路由 `#/cd/<id>` 渲染 `CountdownWidgetApp`，并通过既有的 `fd://state` 事件与主窗口保持同一份 store。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind 4 + Tauri 2（Rust 端 WebviewWindowBuilder / WebviewWindow）。

**说明：** 本仓库没有 JS 测试框架（`package.json` 只有 `dev / build / preview / tauri`），因此前端任务的验证是 `tsc --noUnusedLocals --noUnusedParameters` + `vite build` + 浏览器实测；Rust 端已有 `#[cfg(test)]` 单测，窗口标签与级联位置这类纯函数按 TDD 走。

---

## 文件结构

**修改**
- `src/lib/timer.ts` — 新增预设分钟数与取值范围查询。
- `src/store/useAppStore.ts` — 暂停中改时长不再重置当前时钟；`NewCountdown` 去掉 `pinned`。
- `src/components/PomodoroView.tsx` — 专注 / 休息两段式 + 预设 + 就地改时长。
- `src/components/SettingsView.tsx` — 时长设置区改称「时长预设」，标注休息预设。
- `src/components/CountdownView.tsx` — 移除表单/弹窗里的「钉在桌面」开关，改用共享卡片文案函数。
- `src/types.ts` — `Countdown` 增加 `widgetPos`。
- `src/store/defaults.ts` — 校验 `widgetPos`，并把区间常量挪到 lib。
- `src-tauri/src/lib.rs` — 新增 `sync_countdown_widgets` 命令 + 两个纯函数单测。
- `src-tauri/capabilities/default.json` — 能力覆盖 `cd-*` 窗口。
- `src/App.tsx` — 主窗口同步图钉状态到 Rust。
- `src/main.tsx` — 按 hash 渲染倒数日小组件窗口。
- `src/components/ManualSection.tsx`、`README.md`、版本号 4 处 + 页脚 — 文档与发版。

**新增**
- `src/lib/countdown.ts` — 倒数日文案（`posterContent` / `repeatText`）与区间常量，供主界面与小组件共用。
- `src/components/CountdownWidgetApp.tsx` — 单个倒数日的桌面小组件窗口。

**职责边界**
- 数据层只存事实（`pinned`、`widgetPos`），窗口的开/关完全由「`pinned` 集合」推导，避免状态双写。
- Rust 只负责窗口生命周期与几何，不读业务 store。

---

### Task 1: 计时器预设查询函数

**Files:**
- Modify: `src/lib/timer.ts:1-15`

- [ ] **Step 1: 在 `durationFor` 旁新增三个查询**

```ts
/** Settings key holding each preset's length. */
export const minutesKeyFor = (mode: TimerMode): "workMin" | "shortMin" | "longMin" =>
  mode === "short" ? "shortMin" : mode === "long" ? "longMin" : "workMin";

/** Length of a preset in minutes. */
export const minutesFor = (mode: TimerMode, settings: Settings): number =>
  settings[minutesKeyFor(mode)];

/** Allowed length range per preset, mirrored by the settings steppers. */
export const MINUTES_RANGE: Record<TimerMode, { min: number; max: number }> = {
  work: { min: 1, max: 90 },
  short: { min: 1, max: 30 },
  long: { min: 5, max: 60 },
};
```

- [ ] **Step 2: 类型检查**

Run: `cd /workspace/focusday && npx tsc --noEmit`
Expected: 无输出、退出码 0。

- [ ] **Step 3: 提交**

```bash
git add src/lib/timer.ts
git commit -m "feat: 新增计时器预设查询函数"
```

---

### Task 2: 暂停中改时长不重置当前时钟

现状：`updateSettings` 在 `!timer.running` 时无条件把 `remaining` 重置为整段时长，导致暂停到一半改预设会把已走的时间抹掉。

**Files:**
- Modify: `src/store/useAppStore.ts:284-297`

- [ ] **Step 1: 改为只在「本段尚未开始」时同步时钟**

把 `updateSettings` 的 `nextTimer` 计算替换为：

```ts
  updateSettings: (patch) => {
    const { settings, timer } = get();
    const next: Settings = { ...settings, ...patch };
    const durationChanged =
      patch.workMin !== undefined || patch.shortMin !== undefined || patch.longMin !== undefined;
    // Only mirror a new preset into the clock when the current round has not
    // started yet. A paused mid-round session keeps its own length.
    const untouched = timer.remaining === durationFor(timer.mode, settings);
    const nextTimer =
      durationChanged && !timer.running && untouched
        ? { ...timer, remaining: durationFor(timer.mode, next) }
        : timer;
    set({ settings: next, timer: nextTimer });
    applyTheme(next.theme);
    applyAccent(next.accent);
    if (patch.notify === true) void ensureNotificationPermission();
  },
```

- [ ] **Step 2: 类型检查**

Run: `cd /workspace/focusday && npx tsc --noEmit`
Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add src/store/useAppStore.ts
git commit -m "fix: 暂停中的番茄钟不再因改时长被重置"
```

---

### Task 3: 番茄钟「专注 / 休息」两段式 + 就地改时长

**Files:**
- Modify: `src/components/PomodoroView.tsx:1-55`（顶部区块）

- [ ] **Step 1: 调整导入**

```tsx
import { BellOff, Check, ListTodo, Pause, Play, RotateCcw, SkipForward, Target } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import {
  MINUTES_RANGE,
  computeRemaining,
  durationFor,
  formatClock,
  minutesFor,
  minutesKeyFor,
  modeLabel,
} from "../lib/timer";
import { todayStat } from "../lib/stats";
import type { TimerMode } from "../types";
import { Ring } from "./Ring";
import { Card, Segmented, Stepper } from "./ui";
import { cn } from "../lib/cn";
```

- [ ] **Step 2: 用两段式选项替换原 `MODES`**

```tsx
type Phase = "focus" | "rest";

const PHASES: { value: Phase; label: string }[] = [
  { value: "focus", label: "专注" },
  { value: "rest", label: "休息" },
];

/** Short and long breaks are presets inside the break phase. */
const REST_PRESETS: { value: TimerMode; label: string }[] = [
  { value: "short", label: "短休息" },
  { value: "long", label: "长休息" },
];
```

- [ ] **Step 3: 组件内新增派生状态与处理函数**

在 `const dndActive = ...` 之前加入：

```tsx
  const phase: Phase = timer.mode === "work" ? "focus" : "rest";
  const range = MINUTES_RANGE[timer.mode];

  const changePhase = (next: Phase) => {
    if (next === "focus") {
      if (timer.mode !== "work") setMode("work");
    } else if (timer.mode === "work") {
      setMode("short");
    }
  };

  // Compute the key explicitly so TypeScript keeps the Partial<Settings> shape.
  const setMinutes = (value: number) => {
    const key = minutesKeyFor(timer.mode);
    updateSettings(
      key === "shortMin" ? { shortMin: value } : key === "longMin" ? { longMin: value } : { workMin: value },
    );
  };
```

- [ ] **Step 4: 替换顶部 `Segmented` 区块**

把原来的

```tsx
        <div className="flex items-center gap-2">
          <Segmented options={MODES} value={timer.mode} onChange={setMode} />
          {dndActive ? (
            <span
              title="专注时免打扰已开启：本段专注期间 FocusDay 不会发出提示音或系统通知"
              className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand"
            >
              <BellOff size={12} /> 免打扰中
            </span>
          ) : null}
        </div>
```

替换为：

```tsx
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Segmented options={PHASES} value={phase} onChange={changePhase} />
            {dndActive ? (
              <span
                title="专注时免打扰已开启：本段专注期间 FocusDay 不会发出提示音或系统通知"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand"
              >
                <BellOff size={12} /> 免打扰中
              </span>
            ) : null}
          </div>

          {phase === "rest" ? (
            <Segmented options={REST_PRESETS} value={timer.mode} onChange={setMode} />
          ) : null}

          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1">
            <span className="text-xs text-muted">{modeLabel(timer.mode)}时长</span>
            {timer.running ? (
              // While a round is running its length is fixed, so only show it.
              <span className="text-sm font-semibold tabular-nums text-ink">
                {minutesFor(timer.mode, settings)} 分钟
              </span>
            ) : (
              <Stepper
                value={minutesFor(timer.mode, settings)}
                min={range.min}
                max={range.max}
                suffix="分钟"
                onChange={setMinutes}
              />
            )}
          </div>
        </div>
```

- [ ] **Step 5: 删除已不再使用的 `MODES` 常量与 `durationFor` 之外的无用导入**

确认文件内不再引用 `MODES`；`durationFor` 仍用于 `total`，保留。

- [ ] **Step 6: 类型检查 + 构建**

Run: `cd /workspace/focusday && npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build`
Expected: 无 TS 报错，`✓ built in ...`。

- [ ] **Step 7: 浏览器验证**

启动 `npm run dev`，打开 `http://localhost:1420/`：
1. 顶部只看到 `专注 / 休息` 两段，当前为「专注」，下面显示「专注时长 − 25 分钟 +」。
2. 点「休息」→ 出现「短休息 / 长休息」子分段，默认选中短休息，时长显示 5 分钟。
3. 点「长休息」→ 时长显示 15 分钟；点 `+` 变 16 分钟且环形剩余时间同步为 16:00。

- [ ] **Step 8: 提交**

```bash
git add src/components/PomodoroView.tsx
git commit -m "feat: 番茄钟改为专注/休息两段式并支持就地改时长"
```

---

### Task 4: 设置页时长区改为「预设」表述

**Files:**
- Modify: `src/components/SettingsView.tsx:174-201`

- [ ] **Step 1: 改标题与行文案**

```tsx
      <Section icon={<LayoutGrid size={16} />} title="时长预设">
        <Row label="专注" hint="专注阶段的默认时长">
          <Stepper
            value={settings.workMin}
            min={1}
            max={90}
            suffix="分钟"
            onChange={(v) => updateSettings({ workMin: v })}
          />
        </Row>
        <Row label="休息 · 短休息" hint="休息阶段的两个预设之一">
          <Stepper
            value={settings.shortMin}
            min={1}
            max={30}
            suffix="分钟"
            onChange={(v) => updateSettings({ shortMin: v })}
          />
        </Row>
        <Row label="休息 · 长休息">
          <Stepper
            value={settings.longMin}
            min={5}
            max={60}
            suffix="分钟"
            onChange={(v) => updateSettings({ longMin: v })}
          />
        </Row>
        <Row label="长休息间隔" hint="每完成 N 个番茄进入长休息">
          <Stepper
            value={settings.longEvery}
            min={2}
            max={8}
            suffix="个"
            onChange={(v) => updateSettings({ longEvery: v })}
          />
        </Row>
      </Section>
```

- [ ] **Step 2: 类型检查**

Run: `cd /workspace/focusday && npx tsc --noEmit`
Expected: 退出码 0。

- [ ] **Step 3: 提交**

```bash
git add src/components/SettingsView.tsx
git commit -m "refactor: 设置页时长区按专注/休息预设归组"
```

---

### Task 5: 倒数日数据层——`widgetPos` 与去掉 `pinned` 入参

**Files:**
- Modify: `src/types.ts:84-105`
- Modify: `src/store/defaults.ts:257-268`
- Modify: `src/store/useAppStore.ts:30-40, 254-274`

- [ ] **Step 1: `Countdown` 增加窗口位置**

```ts
  /** Card look; `wandering` renders the sci-fi poster treatment. */
  style: CountdownStyle;
  /** Optional upper-case English line shown on the `wandering` card. */
  subtitleEn?: string;
  /** Last known position of this countdown's desktop widget (logical px). */
  widgetPos?: Point;
  createdAt: number;
```

- [ ] **Step 2: 校验并保留 `widgetPos`**

在 `defaults.ts` 的 countdown 映射里补一行：

```ts
      return { ...entry, repeat, intervalDays, style, subtitleEn, widgetPos: asPoint(entry.widgetPos) };
```

- [ ] **Step 3: `NewCountdown` 去掉 `pinned`，新增时一律未钉**

```ts
export interface NewCountdown {
  title: string;
  date: string;
  color: string;
  note?: string;
  repeat: CountdownRepeat;
  intervalDays?: number;
  style: CountdownStyle;
  subtitleEn?: string;
}
```

`addCountdown` 内改为 `pinned: false,`（删除 `pinned: input.pinned,`）。

- [ ] **Step 4: 类型检查（此步预期报错，供下一步修复）**

Run: `cd /workspace/focusday && npx tsc --noEmit`
Expected: 在 `CountdownView.tsx` 报 `pinned` 多余属性——Task 6/7 会修掉。

- [ ] **Step 5: 提交（与 Task 7 合并提交，先不要单独提交）**

---

### Task 6: 抽出倒数日文案模块

**Files:**
- Create: `src/lib/countdown.ts`
- Modify: `src/store/defaults.ts:188-190`（改为引用）
- Modify: `src/components/CountdownView.tsx`

- [ ] **Step 1: 新建 `src/lib/countdown.ts`**

```ts
import type { Countdown, CountdownRepeat } from "../types";
import type { CountdownInfo } from "./date";

/** Guard rails for the custom recurrence interval. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

const REPEAT_LABEL: Record<CountdownRepeat, string> = {
  none: "",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
  custom: "",
};

/** `每 14 天` — the custom interval badge; other repeats use `REPEAT_LABEL`. */
export const repeatText = (item: Countdown): string =>
  item.repeat === "custom"
    ? `每 ${item.intervalDays ?? MIN_INTERVAL_DAYS} 天`
    : REPEAT_LABEL[item.repeat];

export const clampInterval = (value: number): number =>
  Math.round(Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, value || MIN_INTERVAL_DAYS)));

export interface PosterContent {
  lead: string;
  value: number;
  unitCn: string;
  /** Upper-case English lines printed under the number. */
  lines: string[];
}

/**
 * Coarse copy shared by the poster card and the desktop widget: once the gap is
 * a month or more it counts in months (like the reference poster), otherwise
 * in days.
 */
export function posterContent(item: Countdown, info: CountdownInfo): PosterContent {
  const past = info.days < 0;
  const abs = Math.abs(info.days);
  const inMonths = abs >= 30;
  const value = inMonths ? Math.max(1, Math.floor(abs / 30)) : abs;
  const unitCn = inMonths ? "个月" : "天";
  const unitEn = inMonths ? (value > 1 ? "MONTHS" : "MONTH") : value > 1 ? "DAYS" : "DAY";

  const base =
    info.days === 0
      ? "IT'S TODAY"
      : past
        ? `${value} ${unitEn} AGO`
        : item.subtitleEn
          ? `IS STILL ${value} ${unitEn} OUT`
          : `${value} ${unitEn} TO GO`;

  return {
    lead: past ? "已过去" : "还剩",
    value,
    unitCn,
    lines: item.subtitleEn ? [item.subtitleEn.toUpperCase(), base] : [base],
  };
}
```

- [ ] **Step 2: `defaults.ts` 改为引用共享常量**

删除本地的 `MIN_INTERVAL_DAYS` / `MAX_INTERVAL_DAYS` 定义，改为在文件顶部：

```ts
import { MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS } from "../lib/countdown";
```

- [ ] **Step 3: `CountdownView.tsx` 删除本地副本**

删除本文件里的 `REPEAT_LABEL`、`repeatText`、`clampInterval`、`PosterContent`、`posterContent`，改为：

```tsx
import { MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS, clampInterval, posterContent, repeatText } from "../lib/countdown";
```

并移除对 `MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS` 的 `../store/defaults` 导入。

- [ ] **Step 4: 类型检查**

Run: `cd /workspace/focusday && npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
Expected: 仅剩 Task 5 引入的 `pinned` 报错（下一步修）。

- [ ] **Step 5: 提交（与 Task 5、7 合并）**

---

### Task 7: 倒数日界面——移除表单/弹窗里的钉在桌面

**Files:**
- Modify: `src/components/CountdownView.tsx`

- [ ] **Step 1: 删除新增表单的 `pinned` 状态与开关**

- 删除 `const [pinned, setPinned] = useState(false);`
- `submit()` 去掉 `pinned,` 参数与 `setPinned(false);`
- 删除第二行末尾的 `<div className="w-56"><Toggle ... label="钉在桌面" .../></div>` 整块
- 若 `Toggle` 不再被本文件使用，从 `./ui` 导入里移除。

- [ ] **Step 2: 编辑弹窗去掉 `pinned`**

`EditDraft` 删掉 `pinned: boolean;`，初始值、`save()` 的 patch、弹窗底部的 `<Toggle .../>` 一并删除。

- [ ] **Step 3: 卡片操作区保留图钉，并加一句说明**

`CardActions` 的图钉按钮加 `title` 提示已在位；在卡片列表上方补一行说明：

```tsx
      <p className="text-[11px] text-muted">
        点卡片右上角的图钉，会在桌面为这条倒数日单独生成一个小部件；再点一次即可收回。
      </p>
```

位置放在 `{items.length === 0 ? ... : ( ... )}` 之前的 `<div className="mx-auto ...">` 内、表单卡片之后。

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd /workspace/focusday && npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build`
Expected: 全部通过。

- [ ] **Step 5: 浏览器验证**

- 新增表单不再出现「钉在桌面」。
- 编辑弹窗内不再出现「钉在桌面」。
- 卡片右上角仍有三枚按钮，图钉点击后高亮（此时桌面窗口在浏览器中不会出现，属正常）。

- [ ] **Step 6: 提交**

```bash
git add src/types.ts src/store/defaults.ts src/store/useAppStore.ts src/lib/countdown.ts src/components/CountdownView.tsx
git commit -m "feat: 倒数日改用图钉生成独立桌面小部件，移除表单里的钉在桌面开关"
```

---

### Task 8: Rust —— 每个图钉一个独立窗口

**Files:**
- Modify: `src-tauri/src/lib.rs`（新增常量/函数/命令/注册/测试）
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 先写失败的单元测试**

在 `mod tests` 内追加：

```rust
    #[test]
    fn countdown_labels_are_prefixed_and_sanitized() {
        assert_eq!(countdown_label("abc-123"), "cd-abc-123");
        assert_eq!(countdown_label("a/b c"), "cd-a-b-c");
        assert!(countdown_label("x y").starts_with("cd-"));
    }

    #[test]
    fn countdown_widgets_cascade_by_28px() {
        assert_eq!(cascade_position(0), (80.0, 120.0));
        assert_eq!(cascade_position(2), (136.0, 176.0));
    }
```

- [ ] **Step 2: 运行，确认编译失败**

Run: `cd /workspace/focusday/src-tauri && cargo test --offline`
Expected: `cannot find function countdown_label` / `cascade_position`。

- [ ] **Step 3: 实现窗口常量与两个纯函数**

放在 `const WIDGET_BASE_H: f64 = 216.0;` 之后：

```rust
/// Label prefix of the per-countdown desktop widget windows.
const COUNTDOWN_PREFIX: &str = "cd-";
const COUNTDOWN_BASE_W: f64 = 360.0;
const COUNTDOWN_BASE_H: f64 = 214.0;

/// Builds a valid Tauri window label from a countdown id.
/// Tauri labels may only contain alphanumerics, `-`, `/`, `:`, `_` and `.`.
fn countdown_label(id: &str) -> String {
    let safe: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    format!("{COUNTDOWN_PREFIX}{safe}")
}

/// Cascades freshly opened countdown widgets so they do not cover each other.
fn cascade_position(index: usize) -> (f64, f64) {
    (80.0 + index as f64 * 28.0, 120.0 + index as f64 * 28.0)
}
```

- [ ] **Step 4: 新增 `sync_countdown_widgets` 命令**

放在 `focus_main_window` 命令之后：

```rust
/// Opens one borderless desktop window per pinned countdown and closes the
/// rest. Idempotent: the main window calls it whenever the pinned set changes.
#[tauri::command]
async fn sync_countdown_widgets(app: AppHandle, ids: Vec<String>) -> Result<(), String> {
    use std::collections::HashSet;

    let wanted: HashSet<String> = ids.iter().map(|id| countdown_label(id)).collect();

    let existing: Vec<(String, WebviewWindow)> = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with(COUNTDOWN_PREFIX))
        .collect();

    // `destroy` bypasses close-request handlers, so a pinned toggle cannot be
    // fought over by the widget window itself.
    for (label, window) in &existing {
        if !wanted.contains(label) {
            let _ = window.destroy();
        }
    }

    let mut index = existing.iter().filter(|(label, _)| wanted.contains(label)).count();
    for id in ids {
        let label = countdown_label(&id);
        if app.get_webview_window(&label).is_some() {
            continue;
        }

        let (x, y) = cascade_position(index);
        index += 1;
        let route = format!("index.html#/cd/{id}");
        WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(route.into()))
            .title("FocusDay · 倒数日")
            .inner_size(COUNTDOWN_BASE_W, COUNTDOWN_BASE_H)
            .position(x, y)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true)
            .build()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

- [ ] **Step 5: 注册命令**

在 `generate_handler![...]` 里 `focus_main_window,` 之后加 `sync_countdown_widgets,`。

- [ ] **Step 6: 放开新窗口的能力**

`src-tauri/capabilities/default.json`：

```json
  "windows": ["main", "widget", "cd-*"],
```

- [ ] **Step 7: 运行测试**

Run:
```bash
cd /workspace/focusday/src-tauri && unset NO_PROXY no_proxy && \
export HTTPS_PROXY=http://127.0.0.1:18080 HTTP_PROXY=http://127.0.0.1:18080 \
       https_proxy=http://127.0.0.1:18080 http_proxy=http://127.0.0.1:18080 && cargo test
```
Expected: `6 passed`（原 4 个 + 新增 2 个）。

- [ ] **Step 8: 提交**

```bash
git add src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: Rust 端为每个图钉的倒数日维护独立桌面窗口"
```

---

### Task 9: 前端窗口桥接

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/widget.ts`

- [ ] **Step 1: `env.ts` 增加路由解析**

```ts
/** Countdown id when this webview is a per-countdown desktop widget. */
export const countdownWidgetId = (): string | null => {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/#\/cd\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};
```

- [ ] **Step 2: `widget.ts` 增加同步函数**

```ts
/** Opens / closes the desktop window of every pinned countdown (Tauri only). */
export async function syncCountdownWidgets(ids: string[]): Promise<void> {
  await invoke("sync_countdown_widgets", { ids });
}
```

- [ ] **Step 3: 类型检查**

Run: `cd /workspace/focusday && npx tsc --noEmit`
Expected: 退出码 0。

- [ ] **Step 4: 提交（与 Task 10 合并）**

---

### Task 10: 倒数日小组件窗口与主窗口同步

**Files:**
- Create: `src/components/CountdownWidgetApp.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 新建 `CountdownWidgetApp.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import { countdownInfo, formatDate } from "../lib/date";
import { posterContent, repeatText } from "../lib/countdown";
import {
  hideSelf,
  onWidgetMoved,
  restoreWidgetPosition,
} from "../lib/widget";
import { cn } from "../lib/cn";

/**
 * Desktop window for one pinned countdown. It reads the same store as the main
 * window (kept in sync through the `fd://state` event), so edits and unpinning
 * are reflected here immediately.
 */
export default function CountdownWidgetApp({ id }: { id: string }) {
  const item = useAppStore((s) => s.countdowns.find((c) => c.id === id));
  const updateCountdown = useAppStore((s) => s.updateCountdown);
  const now = new Date(useNow(60_000));

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.classList.add("fd-widget");
    return () => document.body.classList.remove("fd-widget");
  }, []);

  // Restore the last position once, after the store has hydrated.
  const restored = useRef(false);
  const savedPos = item?.widgetPos;
  useEffect(() => {
    if (restored.current || !savedPos) return;
    restored.current = true;
    void restoreWidgetPosition(savedPos);
  }, [savedPos]);

  useEffect(() => {
    let debounce: number | undefined;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onWidgetMoved((pos) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => updateCountdown(id, { widgetPos: pos }), 400);
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      unlisten?.();
    };
  }, [id, updateCountdown]);

  if (!item) return null;

  const info = countdownInfo(item, now);
  const { lead, value, unitCn, lines } = posterContent(item, info);
  const dark = item.style === "wandering";
  const dragProps = { "data-tauri-drag-region": "true" } as const;

  const unpin = () => {
    // Unpinning is the single source of truth: the main window sees the flag
    // change and asks Rust to destroy this window.
    updateCountdown(id, { pinned: false });
    void hideSelf();
  };

  return (
    <div className="h-full w-full p-2">
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl border px-3.5 py-2.5",
          dark ? "border-white/10" : "fd-skin-glass",
        )}
        style={dark ? { backgroundColor: "#0b0b0c" } : undefined}
      >
        <div {...dragProps} className="flex h-6 shrink-0 items-center gap-1.5 select-none">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className={cn("text-[10px] font-semibold tracking-wide", dark ? "text-white/55" : "text-muted")}>
            倒数日
          </span>
          <button
            type="button"
            onClick={unpin}
            title="取消钉在桌面"
            className={cn(
              "ml-auto grid h-5 w-5 place-items-center rounded-md transition-colors",
              dark ? "text-white/45 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-solid hover:text-ink",
            )}
          >
            <X size={12} />
          </button>
        </div>

        <p
          {...dragProps}
          className={cn("mt-1 truncate text-sm font-bold", dark ? "text-white" : "text-ink")}
        >
          距{item.title}
        </p>

        <div className="mt-2 flex items-stretch gap-2">
          <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-end gap-x-2">
              <span className={cn("text-[11px] font-semibold", dark ? "text-white/80" : "text-muted")}>
                {lead}
              </span>
              <span
                className="text-4xl leading-none font-black tracking-tight tabular-nums"
                style={{ color: item.color }}
              >
                {value}
              </span>
              <span className={cn("mb-0.5 text-sm font-bold", dark ? "text-white" : "text-ink")}>
                {unitCn}
              </span>
            </div>
            <div
              className={cn(
                "mt-1.5 flex flex-col gap-0.5 text-[9px] leading-tight font-semibold tracking-[0.12em] uppercase",
                dark ? "text-white/80" : "text-muted",
              )}
            >
              {lines.map((line) => (
                <p key={line} className="truncate">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className={cn("mt-auto truncate text-[10px]", dark ? "text-white/40" : "text-muted")}>
          {formatDate(info.nextDate)}
          {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `main.tsx` 按 hash 路由**

```tsx
import { isWidgetWindow, countdownWidgetId } from "./lib/env";
import CountdownWidgetApp from "./components/CountdownWidgetApp";
```

在 `const widget = isWidgetWindow();` 之后加：

```tsx
const countdownId = countdownWidgetId();
```

把 `if (!widget) {` 改为 `if (!widget && !countdownId) {`。

把渲染改为：

```tsx
  createRoot(container).render(
    <StrictMode>
      {countdownId ? (
        <CountdownWidgetApp id={countdownId} />
      ) : widget ? (
        <WidgetApp />
      ) : (
        <App />
      )}
    </StrictMode>,
  );
```

- [ ] **Step 3: `App.tsx` 声明式同步图钉集合**

```tsx
import { setWidgetVisible, syncCountdownWidgets } from "./lib/widget";
```

组件内：

```tsx
  // One desktop window per pinned countdown; Rust opens/closes the difference.
  const pinnedIds = useAppStore((s) =>
    s.countdowns
      .filter((c) => c.pinned)
      .map((c) => c.id)
      .join("|"),
  );

  useEffect(() => {
    if (!tauri) return;
    void syncCountdownWidgets(pinnedIds ? pinnedIds.split("|") : []);
  }, [pinnedIds, tauri]);
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd /workspace/focusday && npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build`
Expected: 通过。

- [ ] **Step 5: 浏览器直接验证小组件窗口**

`npm run dev` 后打开 `http://localhost:1420/#/cd/test-1`，先用控制台注入一条 `style: "wandering"` 的倒数日（id 为 `test-1`）：
1. 页面只渲染小卡片，无侧边栏。
2. 深色风格为黑底、红色竖线、超大数字与英文行。
3. 把该条改成 `style: "classic"` 后刷新，卡片变为浅色玻璃样式。
4. 控制台无 error。

- [ ] **Step 6: 提交**

```bash
git add src/components/CountdownWidgetApp.tsx src/main.tsx src/App.tsx src/lib/env.ts src/lib/widget.ts
git commit -m "feat: 图钉倒数日生成独立桌面小组件窗口"
```

---

### Task 11: 文档、版本号与发布

**Files:**
- Modify: `src/components/ManualSection.tsx`
- Modify: `README.md:176-183`
- Modify: `package.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`
- Modify: `src/components/SettingsView.tsx:519-521`

- [ ] **Step 1: 手册更新**

番茄钟条目改为：

```tsx
    points: [
      "顶部先选阶段：专注或休息；休息下再选「短休息」「长休息」两个预设。",
      "阶段下方可当场调整该预设的时长，也可以到「设置 → 时长预设」里统一定义。",
      "点「开始专注」运行，也可暂停、重置或跳过；关联了当前专注任务时，完成的番茄会累计到该待办。",
      "每完成 N 个番茄进入长休息，N 可在「时长预设」里调整。",
    ],
```

倒数日条目把「钉在桌面」那句改为：

```tsx
      "卡片右上角的图钉会为这条倒数日单独开一个桌面小部件（可拖动、记住位置），再点一次收回；编辑按钮可改名称、日期、配色与风格。",
```

- [ ] **Step 2: 版本号升到 0.11.0**

- `package.json` → `"version": "0.11.0"`
- `src-tauri/Cargo.toml` → `version = "0.11.0"`
- `src-tauri/Cargo.lock` → `focusday` 包 `version = "0.11.0"`
- `src-tauri/tauri.conf.json` → `"version": "0.11.0"`
- `SettingsView.tsx` 页脚 `FocusDay v0.11.0`
- `README.md` 产物名与示例 tag 全部换成 `0.11.0`

- [ ] **Step 3: 全量验证**

```bash
cd /workspace/focusday && npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build
```
Expected: 通过。

```bash
cd /workspace/focusday/src-tauri && unset NO_PROXY no_proxy && \
export HTTPS_PROXY=http://127.0.0.1:18080 HTTP_PROXY=http://127.0.0.1:18080 \
       https_proxy=http://127.0.0.1:18080 http_proxy=http://127.0.0.1:18080 && cargo test
```
Expected: `6 passed`。

- [ ] **Step 4: 浏览器回归**

`npm run dev`，逐项确认：
1. 番茄钟：专注/休息切换、休息预设切换、就地改时长生效。
2. 倒数日：新增表单无「钉在桌面」；图钉高亮切换正常（浏览器无窗口，属预期）。
3. `/#/cd/<id>` 单独渲染卡片，无控制台错误。
4. 统计、设置、待办无回归。

- [ ] **Step 5: 提交并发版**

```bash
cd /workspace/focusday
git add -A README.md package.json src src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "feat: 番茄钟专注/休息预设分组与倒数日独立桌面小组件，发布 v0.11.0"
git tag -a v0.11.0 -m "FocusDay v0.11.0"
git -c credential.helper='!gh auth git-credential' push origin v0.11.0
```

- [ ] **Step 6: 等待 CI 并取回安装包**

```bash
gh run list --limit 1
gh release view v0.11.0 --json assets -q '.assets[] | .name'
gh release download v0.11.0 --dir /workspace --clobber
```
Expected: `FocusDay_0.11.0_x64-setup.exe` 与 `FocusDay_0.11.0_x64_en-US.msi` 出现在 `/workspace`。旧版安装包删除前先询问用户。

---

## 自检

**需求覆盖**
- 「专注」「休息」能改时长 → Task 1 + Task 3 的就地 `Stepper` + Task 4 的设置入口。
- 短休息/长休息并入休息、作为预设 → Task 3 的两段式与 `REST_PRESETS`，Task 4 的设置分组。
- 图钉不是表单选项 → Task 5（`NewCountdown` 去掉 `pinned`）、Task 7（表单与弹窗删除开关）。
- 点图钉在桌面新增小组件（同「桌面小组件」按钮的效果）→ Task 8（Rust 窗口）、Task 9/10（同步与路由渲染）、窗口无边框/置顶/不入任务栏，与主小组件一致。

**类型一致性**
- `posterContent(item, info)`、`repeatText(item)`、`clampInterval(value)` 在 Task 6 定义，Task 7/10 以同名同签名引用。
- `syncCountdownWidgets(ids: string[])` 在 Task 9 定义，Task 10 调用；Rust 参数名 `ids` 与 `invoke` 的 `{ ids }` 一致。
- `countdown_label` / `cascade_position` 在 Task 8 的测试与实现同名。
