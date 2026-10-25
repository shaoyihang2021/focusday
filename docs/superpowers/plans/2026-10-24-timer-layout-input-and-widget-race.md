# FocusDay v0.14.0 实施计划：计时布局、键盘输入、日历字段与小组件竞态

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复四个问题：专注/休息二级选项布局、时长键盘输入、倒数日历字段视觉与命名、倒数日小组件偶发消失。

**Architecture:** 布局改动集中在 `PomodoroView` 与 `CountdownView`；`Stepper` 升级为可直接键入的受控输入；小组件消失通过「打开前强制落盘 + JS 串行队列 + Rust 互斥锁 + 小组件不写过期状态」四层防护解决。

**Tech Stack:** React 19 + TypeScript + Tailwind v4 + Tauri 2（Rust）。

---

## 文件结构

**修改**

- `src/components/ui.tsx` — `Stepper` 支持键盘输入
- `src/components/PomodoroView.tsx` — 正计时切换移到专注下方独立一行
- `src/components/CountdownView.tsx` — 日历选择进入日期控件行、改名阴历/阳历、表单对齐
- `src/lib/lunar.ts` — 卡片文案前缀改为「阴历」
- `src/components/CountdownWidgetApp.tsx` — 未确认 pinned 时不写窗口位置
- `src/store/useAppStore.ts` — 新增 `flushPersist`
- `src/App.tsx` — 串行队列：先落盘再同步窗口
- `src-tauri/src/lib.rs` — 倒数日窗口同步加互斥锁
- `tests/lunar.test.ts` — 更新文案断言
- `src/components/ManualSection.tsx`、`README.md` — 术语与输入说明
- `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` — 0.14.0

---

### Task 1: Stepper 支持键盘输入分钟数

**Files:**
- Modify: `src/components/ui.tsx:1`, `src/components/ui.tsx:124-157`

- [ ] **Step 1: 引入 React hooks**

把首行改为：

```tsx
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
```

- [ ] **Step 2: 替换 Stepper 的数字展示为输入框**

```tsx
export function Stepper({ value, min, max, step = 1, suffix, onChange }: StepperProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const [draft, setDraft] = useState(String(value));

  // Keep the field in sync when +/- or an external settings change moves the value.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? value : Number(trimmed);
    const next = clamp(Number.isFinite(parsed) ? Math.round(parsed) : value);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
      >
        −
      </button>
      <span className="flex items-baseline">
        <input
          type="text"
          inputMode="numeric"
          aria-label={suffix ? `输入${suffix}` : "输入数值"}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(String(value));
              e.currentTarget.blur();
            }
          }}
          className="w-14 rounded-lg border border-transparent bg-transparent px-1 py-1 text-center text-sm font-semibold tabular-nums text-ink outline-none transition-colors hover:border-line focus:border-brand focus:bg-solid"
        />
        {suffix ? <span className="text-xs font-normal text-muted">{suffix}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过

- [ ] **Step 4: 浏览器验证**

在番茄页把「专注时长」输入框中的 `25` 改为 `40` 后回车，确认显示 `40 分钟` 且计时环为 `40:00`；输入 `999` 后失焦应被夹到 `90`；输入 `0` 应被夹到 `1`。

- [ ] **Step 5: 提交**

```bash
git add src/components/ui.tsx
git commit -m "feat: 时长步进器支持键盘直接输入数字"
```

---

### Task 2: 正计时切换与专注上下并行

**Files:**
- Modify: `src/components/PomodoroView.tsx:96-120`

- [ ] **Step 1: 调整阶段与二级选项结构**

把「专注 / 休息」外层与两个二级选择改成：

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
  ) : (
    <div className={cn(timer.running && "pointer-events-none opacity-45")}>
      <Segmented options={TIMINGS} value={timer.timing} onChange={setTiming} />
    </div>
  )}

  {/* 预设 chips、时长框保持不变 */}
</div>
```

要点：`倒计时 / 正计时` 不再与 `专注 / 休息` 同排，而是像 `短休息 / 长休息` 一样独占下一行。

- [ ] **Step 2: 构建**

Run: `npx tsc --noEmit && npx vite build`
Expected: 通过

- [ ] **Step 3: 浏览器验证**

分别切到「休息」与「专注」，确认二级选项都位于主选项正下方一行，左右居中；专注时第二行是倒计时/正计时，休息时第二行是短休息/长休息。

- [ ] **Step 4: 提交**

```bash
git add src/components/PomodoroView.tsx
git commit -m "fix: 专注下的倒计时/正计时改为独立一行"
```

---

### Task 3: 日历选择与日期控件同行，改名阴历/阳历

**Files:**
- Modify: `src/components/CountdownView.tsx:105-226`, `src/components/CountdownView.tsx:596-635`
- Modify: `src/lib/lunar.ts:223-227`
- Test: `tests/lunar.test.ts`

- [ ] **Step 1: 更新文案测试**

把 `tests/lunar.test.ts` 的两条断言改为：

```ts
test("阴历文案包含闰月与月日名", () => {
  assert.equal(lunarDateLabel("2026-08-15"), "阴历八月十五");
  assert.equal(lunarDateLabel("2025-06-01", true), "阴历闰六月初一");
});
```

Run: `node --experimental-strip-types --test tests/lunar.test.ts`
Expected: FAIL（实际仍是「农历」）

- [ ] **Step 2: 修改文案前缀**

`src/lib/lunar.ts`：

```ts
/** `阴历八月十五` / `阴历闰六月初一` from a `YYYY-MM-DD` lunar string. */
export function lunarDateLabel(date: string, leap = false): string {
  const [, month, day] = date.split("-").map(Number);
  return `阴历${leap ? "闰" : ""}${LUNAR_MONTHS[month - 1] ?? ""}${LUNAR_DAYS[day - 1] ?? ""}`;
}
```

Run: `node --experimental-strip-types --test tests/lunar.test.ts`
Expected: PASS

- [ ] **Step 3: 调整日历选项与控件布局**

`CountdownView.tsx` 中：

```tsx
const CALENDARS: { value: CountdownCalendar; label: string }[] = [
  { value: "lunar", label: "阴历" },
  { value: "solar", label: "阳历" },
];
```

把 `CalendarField` 的 return 改为：

```tsx
  const selectClass =
    "h-10 rounded-xl border border-line bg-solid px-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <div className="min-w-[340px]">
      <p className="mb-1.5 text-xs font-medium text-muted">目标日期</p>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={CALENDARS}
          value={calendar}
          onChange={onCalendar}
          className="h-10 shrink-0 items-center"
        />
        {calendar === "solar" ? (
          <input
            aria-label="目标日期"
            type="date"
            lang="zh-CN"
            value={solarDate}
            onChange={(e) => onSolarDate(e.target.value)}
            className="h-10 rounded-xl border border-line bg-solid px-3 text-sm text-ink outline-none focus:border-brand"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="阴历年"
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
              aria-label="阴历月"
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
              aria-label="阴历日"
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
        )}
      </div>
      {calendar === "lunar" ? (
        <p className="mt-1 text-[11px] text-muted">
          {solar
            ? `对应阳历 ${formatDate(dateKey(solar))} · ${weekdayName(dateKey(solar))}`
            : "该阴历日期不存在，请重新选择"}
        </p>
      ) : null}
    </div>
  );
```

删除原先位于标签行里的 `Segmented` 与 `label htmlFor`，让选择器与日期输入处于同一控件行。

- [ ] **Step 4: 对齐添加表单**

把表单首行容器：

```tsx
<div className="flex flex-col gap-3 lg:flex-row lg:items-end">
```

改为：

```tsx
<div className="flex flex-col gap-3 lg:flex-row lg:items-start">
```

「添加」按钮的 `className` 开头加 `lg:mt-[22px]`，与其它控件的标签高度对齐。

- [ ] **Step 5: 构建与浏览器验证**

Run: `npx tsc --noEmit && npx vite build`

在倒数日页验证：
- 阳历模式下，`[阴历|阳历]` 选择器与日期输入框在同一行、同高；
- 阴历模式下，选择器、年/月/日下拉、闰月复选框同处一行，预览在下方；
- 事件名称、目标日期、标记色、添加按钮的标签和控件均水平对齐；
- 卡片日期前缀显示「阴历八月十五」。

- [ ] **Step 6: 提交**

```bash
git add src/components/CountdownView.tsx src/lib/lunar.ts tests/lunar.test.ts
git commit -m "fix: 倒数日历选择与日期控件对齐，并改称阴历/阳历"
```

---

### Task 4: 修复倒数日小组件偶发消失

**根因：** 钉住后 Rust 立刻建窗，但主窗口的状态落盘有 300ms 防抖；新窗口可能读到旧状态（`pinned` 仍为 false）。随后窗口位置监听把这份旧状态写回并广播，主窗口据此销毁窗口。并发同步窗口时 Rust 也可能出现「先建后删」的竞态。

**Files:**
- Modify: `src/store/useAppStore.ts:105-115`, `src/App.tsx:1-42`
- Modify: `src/components/CountdownWidgetApp.tsx:35-53`
- Modify: `src-tauri/src/lib.rs:12-26`, `src-tauri/src/lib.rs:137-175`

- [ ] **Step 1: 提供立即落盘函数**

`src/store/useAppStore.ts`，在 `persist` 之后添加：

```ts
/** Writes the current state immediately, bypassing the 300ms debounce. */
export async function flushPersist(): Promise<void> {
  window.clearTimeout(saveHandle);
  await saveState(snapshot(useAppStore.getState()));
}
```

- [ ] **Step 2: App 中串行「先落盘，再同步窗口」**

`src/App.tsx` 顶部导入改为：

```tsx
import { flushPersist, useAppStore } from "./store/useAppStore";
```

在组件外增加队列：

```tsx
let pendingPinnedIds: string[] = [];
let pinnedSyncChain: Promise<void> = Promise.resolve();

/**
 * Serialises widget syncing and always reads the newest pinned set after the
 * state has been flushed, so a newly opened window never loads stale data.
 */
function queueCountdownWidgetSync(ids: string[]): void {
  pendingPinnedIds = ids;
  pinnedSyncChain = pinnedSyncChain
    .then(async () => {
      await flushPersist();
      await syncCountdownWidgets(pendingPinnedIds);
    })
    .catch((err) => {
      console.warn("[focusday] countdown widget sync failed", err);
    });
}
```

把原有效果替换为：

```tsx
  useEffect(() => {
    if (!tauri) return;
    queueCountdownWidgetSync(pinnedIds ? pinnedIds.split("|") : []);
  }, [pinnedIds, tauri]);
```

- [ ] **Step 3: 小组件不写入过期状态**

`src/components/CountdownWidgetApp.tsx` 的位置监听加守卫：

```tsx
  useEffect(() => {
    if (!item?.pinned) return;
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
  }, [id, updateCountdown, item?.pinned]);
```

这样窗口若仍读到旧的 `pinned: false`，不会把旧状态写回。

- [ ] **Step 4: Rust 同步命令加互斥锁**

`src-tauri/src/lib.rs` 常量区添加：

```rust
/// Serialises countdown window syncing so concurrent pin toggles cannot
/// interleave their "destroy then create" steps.
static COUNTDOWN_SYNC_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
```

`sync_countdown_widgets` 开头加：

```rust
    let _guard = COUNTDOWN_SYNC_LOCK
        .lock()
        .map_err(|_| "倒数日小组件同步锁不可用".to_string())?;
```

- [ ] **Step 5: 构建与 Rust 测试**

Run: `npx tsc --noEmit && cd src-tauri && cargo test --quiet`
Expected: 前端通过，Rust 7 项测试通过

- [ ] **Step 6: 回归验证**

在 Windows 客户端或 Tauri dev 中：
1. 新增一条倒数日，立即点图钉，确认小组件出现并保持 10 秒不消失。
2. 连续快速钉住 / 取消两条倒数日，确认最终窗口数量与 `pinned` 数一致。
3. 移动小组件后重启应用，位置仍能恢复。

- [ ] **Step 7: 提交**

```bash
git add src/store/useAppStore.ts src/App.tsx src/components/CountdownWidgetApp.tsx src-tauri/src/lib.rs
git commit -m "fix: 倒数日小组件打开前落盘并串行同步，避免偶发消失"
```

---

### Task 5: 文档、版本与发布

**Files:**
- Modify: `src/components/ManualSection.tsx`
- Modify: `README.md`
- Modify: `src/components/SettingsView.tsx`
- Modify: `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`

- [ ] **Step 1: 文档更新**

- Manual「番茄钟」：`"各时长数字可直接键盘输入，回车或失焦生效。"`
- Manual「倒数日」：把「农历」改为「阴历」，写 `"日期可选阴历 / 阳历，阴历支持闰月。"`
- README 倒数日：`"支持阴历（农历）与闰月"`；番茄钟补一句键盘输入。

- [ ] **Step 2: 版本 0.14.0**

```bash
# package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json
0.13.0 -> 0.14.0
```

`SettingsView` 页脚同步 `v0.14.0`。

- [ ] **Step 3: 全量验证**

```bash
npm run test:logic
npx tsc --noEmit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npx vite build
cd src-tauri && cargo test --quiet
```

Expected: 17 项逻辑测试、7 项 Rust 测试全部通过。

浏览器验证：番茄布局两行、时长输入、倒数日历字段对齐与阴历文案、深色模式无溢出、无 console 错误。

- [ ] **Step 4: 提交、打 tag、发布**

```bash
git add README.md package.json src-tauri/Cargo.lock src-tauri/Cargo.toml src-tauri/tauri.conf.json src/App.tsx src/components src/lib src/store tests docs/superpowers/plans
git commit -m "fix: 计时布局、时长键盘输入、日历字段与倒数日小组件竞态"
git tag -a v0.14.0 -m "FocusDay v0.14.0"
git -c credential.helper='!gh auth git-credential' push origin main
git -c credential.helper='!gh auth git-credential' push origin v0.14.0
```

等待 Release workflow 成功后下载安装包，并删除上一版 0.13.0 的两个文件。

---

## 自检

- 覆盖：布局（Task 2）、键盘输入（Task 1）、日历视觉与命名（Task 3）、小组件消失（Task 4）、发布（Task 5）。
- 命名一致性：`flushPersist`、`queueCountdownWidgetSync`、`pendingPinnedIds`、`pinnedSyncChain` 在任务与最终代码中保持一致。
- 已知取舍：阴历模式下预览行仍保留在日期控件下方；它不参与控件行高度，其他字段使用顶部对齐，因此不会再把选择器顶到标签行。
