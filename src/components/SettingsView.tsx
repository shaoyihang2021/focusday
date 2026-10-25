import type { ReactNode } from "react";
import { useState } from "react";
import {
  Bell,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Keyboard,
  LayoutGrid,
  Palette,
  Rocket,
  RotateCcw,
  Target,
  Upload,
  Waves,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../store/useAppStore";
import { widgetScale } from "../store/defaults";
import { TIMER_PRESETS, activePreset, presetPatch } from "../lib/timerPresets";
import { Card, Segmented, Stepper, Toggle } from "./ui";
import ManualSection from "./ManualSection";
import {
  applyWidgetWindowSettings,
  setAutoLaunch,
  setGlobalShortcut,
  setWidgetVisible,
} from "../lib/widget";
import { exportBackup, importBackup } from "../lib/backup";
import { pickWidgetBackground } from "../lib/widgetBackground";
import { RELEASES_URL, openReleasePage } from "../lib/links";
import { isTauri } from "../lib/env";
import { formatDate, todayISO } from "../lib/date";
import type { Accent, NoiseType, ThemeMode, WidgetSize, WidgetSkin } from "../types";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="fd-pop p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-brand">{icon}</span>
        {title}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "系统" },
];

const SIZES: { value: WidgetSize; label: string }[] = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

const ACCENT_SWATCH: { value: Accent; label: string; color: string }[] = [
  { value: "tomato", label: "番茄红", color: "#f74a2c" },
  { value: "ocean", label: "海洋蓝", color: "#2563eb" },
  { value: "violet", label: "紫罗兰", color: "#7c3aed" },
  { value: "forest", label: "森林绿", color: "#158f4a" },
  { value: "amber", label: "琥珀黄", color: "#b7791f" },
];

const SKINS: { value: WidgetSkin; label: string }[] = [
  { value: "glass", label: "玻璃" },
  { value: "solid", label: "纯色" },
  { value: "outline", label: "描边" },
  { value: "ghost", label: "幽灵" },
];

const NOISES: { value: NoiseType; label: string }[] = [
  { value: "off", label: "关闭" },
  { value: "white", label: "白噪音" },
  { value: "pink", label: "粉红" },
  { value: "brown", label: "棕" },
  { value: "rain", label: "雨声" },
  { value: "cafe", label: "咖啡厅" },
];

const HOTKEYS: { value: string; label: string }[] = [
  { value: "", label: "关闭快捷键" },
  { value: "CommandOrControl+Shift+F", label: "Ctrl + Shift + F" },
  { value: "CommandOrControl+Shift+Space", label: "Ctrl + Shift + 空格" },
  { value: "Alt+Shift+F", label: "Alt + Shift + F" },
  { value: "CommandOrControl+Alt+F", label: "Ctrl + Alt + F" },
];

export default function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const hydrate = useAppStore((s) => s.hydrate);
  const resetAll = useAppStore((s) => s.resetAll);
  const tauri = isTauri();

  const [status, setStatus] = useState<string | null>(null);

  const applyWidgetPrefs = (next: { alwaysOnTop?: boolean; size?: WidgetSize }) => {
    void applyWidgetWindowSettings({
      alwaysOnTop: next.alwaysOnTop ?? settings.widgetAlwaysOnTop,
      scale: widgetScale[next.size ?? settings.widgetSize],
    });
  };

  const handleHotkey = (accelerator: string) => {
    updateSettings({ hotkey: accelerator });
    if (!tauri) return;
    void setGlobalShortcut(accelerator).then((active) => {
      if (accelerator && !active) {
        updateSettings({ hotkey: "" });
        setStatus("快捷键注册失败，可能已被其他程序占用");
      } else if (accelerator) {
        setStatus("全局快捷键已生效，可在任意界面唤起主窗口");
      } else {
        setStatus("已关闭全局快捷键");
      }
    });
  };

  const handleOpenFocusSettings = async () => {
    if (!tauri) {
      setStatus("系统专注助手设置入口仅在桌面版可用");
      return;
    }
    try {
      await invoke("open_system_focus_settings");
      setStatus("已打开系统「专注助手」设置，可按需手动开启免打扰");
    } catch (err) {
      setStatus(`打开失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExport = async () => {
    try {
      const { todos, tags, countdowns, settings: s, timer, focusByDay } = useAppStore.getState();
      const path = await exportBackup({ todos, tags, countdowns, settings: s, timer, focusByDay });
      setStatus(path ? `备份已导出到 ${path}` : "已取消导出");
    } catch (err) {
      setStatus(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async () => {
    if (!window.confirm("导入备份会覆盖当前全部数据，确定继续吗？")) return;
    try {
      const next = await importBackup();
      if (!next) {
        setStatus("已取消导入");
        return;
      }
      hydrate(next);
      setStatus("备份导入成功");
    } catch (err) {
      setStatus(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePickBackground = async () => {
    try {
      const background = await pickWidgetBackground();
      if (!background) return;
      updateSettings({ widgetBackground: background });
      setStatus("小组件背景图片已更新");
    } catch (err) {
      setStatus(`设置背景图片失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Section icon={<LayoutGrid size={16} />} title="时长预设">
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

      <Section icon={<Bell size={16} />} title="提醒与行为">
        <Toggle
          checked={settings.autoStart}
          onChange={(v) => updateSettings({ autoStart: v })}
          label="自动开始下一段"
          hint="结束后自动开始休息或下一轮专注"
        />
        <Toggle
          checked={settings.sound}
          onChange={(v) => updateSettings({ sound: v })}
          label="结束提示音"
          hint="每段结束时播放提示音"
        />
        <Toggle
          checked={settings.notify}
          onChange={(v) => updateSettings({ notify: v })}
          label="系统通知"
          hint="结束提醒会以系统通知推送"
        />
        <Toggle
          checked={settings.focusDnd}
          onChange={(v) => updateSettings({ focusDnd: v })}
          label="专注时免打扰"
          hint="专注进行中静默 FocusDay 自身的提示音与系统通知，主界面会显示「免打扰中」"
        />
        <Row
          label="系统专注助手（勿扰）"
          hint="Windows 未向第三方程序开放切换系统级免打扰的接口，因此这里只提供设置入口，需由你手动开启"
        >
          <button
            type="button"
            onClick={() => void handleOpenFocusSettings()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid"
          >
            <ExternalLink size={14} /> 打开系统设置
          </button>
        </Row>
        <Toggle
          checked={settings.trayCountdown}
          onChange={(v) => updateSettings({ trayCountdown: v })}
          label="托盘显示倒计时"
          hint="鼠标悬停托盘图标即可看到剩余时间与今日番茄数"
        />
      </Section>

      <Section icon={<Waves size={16} />} title="白噪音">
        <Row
          label="声音类型"
          hint={
            settings.noise === "rain" || settings.noise === "cafe"
              ? "计时开始时自动播放；雨声与咖啡厅为实时合成的近似音效，非实录"
              : "计时开始时自动播放，暂停或结束时自动停止"
          }
        >
          <Segmented options={NOISES} value={settings.noise} onChange={(v) => updateSettings({ noise: v })} />
        </Row>
        <Row label="音量" hint={`当前 ${Math.round(settings.noiseVolume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.noiseVolume * 100)}
            onChange={(e) => updateSettings({ noiseVolume: Number(e.target.value) / 100 })}
            className="w-40"
          />
        </Row>
        <Row label="音色亮度" hint={settings.noiseTone < 0.3 ? "低沉、闷" : settings.noiseTone > 0.8 ? "明亮、通透" : "均衡"}>
          <input
            type="range"
            min={0}
            max={100}
            step={2}
            value={Math.round(settings.noiseTone * 100)}
            onChange={(e) => updateSettings({ noiseTone: Number(e.target.value) / 100 })}
            className="w-40"
          />
        </Row>
        <Row label="低频厚度" hint={`低架增益 ${settings.noiseBass > 0 ? "+" : ""}${settings.noiseBass} dB`}>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={settings.noiseBass}
            onChange={(e) => updateSettings({ noiseBass: Number(e.target.value) })}
            className="w-40"
          />
        </Row>
      </Section>

      <Section icon={<Keyboard size={16} />} title="全局快捷键">
        <Row
          label="唤起主窗口"
          hint={tauri ? "在任意程序中显示 / 隐藏主窗口" : "仅在桌面客户端中可用"}
        >
          <select
            value={settings.hotkey}
            onChange={(e) => handleHotkey(e.target.value)}
            disabled={!tauri}
            className="rounded-xl border border-line bg-solid px-3 py-2 text-sm text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {HOTKEYS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section icon={<Rocket size={16} />} title="启动与后台">
        <Toggle
          checked={settings.autoLaunch}
          onChange={(v) => {
            updateSettings({ autoLaunch: v });
            // Outside the desktop shell there is nothing to apply.
            if (!tauri) return;
            void setAutoLaunch(v).then((actual) => {
              if (actual !== v) {
                updateSettings({ autoLaunch: actual });
                setStatus("系统未接受开机自启设置");
              }
            });
          }}
          label="开机自动启动"
          hint={tauri ? "随 Windows 登录自动在后台启动" : "仅在桌面客户端中可用"}
        />
        <Toggle
          checked={settings.closeToTray}
          onChange={(v) => updateSettings({ closeToTray: v })}
          label="关闭窗口时最小化到托盘"
          hint="关闭主窗口后应用继续在系统托盘运行，可从托盘菜单退出"
        />
      </Section>

      <Section icon={<Palette size={16} />} title="外观">
        <Row label="主题" hint="浅色 / 深色 / 跟随系统">
          <Segmented options={THEMES} value={settings.theme} onChange={setTheme} />
        </Row>
        <Row label="主题配色" hint="统一改变按钮、进度环与选中态的强调色">
          <div className="flex items-center gap-1.5">
            {ACCENT_SWATCH.map((accent) => {
              const active = settings.accent === accent.value;
              return (
                <button
                  key={accent.value}
                  type="button"
                  title={accent.label}
                  onClick={() => updateSettings({ accent: accent.value })}
                  className={
                    "grid h-7 w-7 place-items-center rounded-full border transition-transform " +
                    (active
                      ? "scale-110 border-transparent ring-2 ring-brand ring-offset-2 ring-offset-card"
                      : "border-line hover:scale-105")
                  }
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: accent.color }}
                  />
                </button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section icon={<Eye size={16} />} title="桌面小组件">
        <Row label="显示桌面小组件" hint={tauri ? "独立浮窗，实时显示计时与倒数" : "仅在桌面客户端中可用"}>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!tauri}
              onClick={() => void setWidgetVisible(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            >
              <Eye size={14} /> 显示
            </button>
            <button
              type="button"
              disabled={!tauri}
              onClick={() => void setWidgetVisible(false)}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
            >
              <EyeOff size={14} /> 隐藏
            </button>
          </div>
        </Row>
        <Toggle
          checked={settings.widgetAlwaysOnTop}
          onChange={(v) => {
            updateSettings({ widgetAlwaysOnTop: v });
            applyWidgetPrefs({ alwaysOnTop: v });
          }}
          label="小组件窗口置顶"
          hint="开启后小组件会始终显示在其他窗口之上"
        />
        <Row label="小组件尺寸" hint="改变小组件浮窗的大小">
          <Segmented
            options={SIZES}
            value={settings.widgetSize}
            onChange={(size) => {
              updateSettings({ widgetSize: size });
              applyWidgetPrefs({ size });
            }}
          />
        </Row>
        <Row label="小组件皮肤" hint="选择小组件的外观风格">
          <Segmented
            options={SKINS}
            value={settings.widgetSkin}
            onChange={(skin) => updateSettings({ widgetSkin: skin })}
          />
        </Row>
        <div className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">自定义背景图片</p>
              <p className="mt-0.5 text-xs text-muted">
                {settings.widgetBackground
                  ? "图片仅保存在本地，并会随备份一起导出"
                  : "选一张照片作为小组件背景，文字会自动转为浅色"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {settings.widgetBackground ? (
                <>
                  <img
                    src={settings.widgetBackground}
                    alt="小组件背景预览"
                    className="h-10 w-14 rounded-lg border border-line object-cover"
                  />
                  <button
                    type="button"
                    disabled={!tauri}
                    onClick={() => void handlePickBackground()}
                    className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    更换
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ widgetBackground: null })}
                    className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-solid hover:text-ink"
                  >
                    移除
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!tauri}
                  onClick={() => void handlePickBackground()}
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
                >
                  <ImagePlus size={14} /> 选择图片
                </button>
              )}
            </div>
          </div>
          {settings.widgetBackground ? (
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">背景遮罩</p>
                <p className="mt-0.5 text-xs text-muted">
                  压暗图片以保证文字清晰，当前 {Math.round(settings.widgetBackgroundDim * 100)}%
                </p>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={2}
                value={Math.round(settings.widgetBackgroundDim * 100)}
                onChange={(e) => updateSettings({ widgetBackgroundDim: Number(e.target.value) / 100 })}
                className="w-40"
              />
            </div>
          ) : null}
        </div>
        <div className="py-2">
          <p className="mb-1 text-sm font-medium text-ink">显示内容</p>
          <p className="mb-1 text-xs text-muted">选择小组件上要显示的信息</p>
          <div className="divide-y divide-line">
            <Toggle
              checked={settings.widgetShow.ring}
              onChange={(v) => updateSettings({ widgetShow: { ...settings.widgetShow, ring: v } })}
              label="环形进度"
              hint="关闭后以大字显示剩余时间"
            />
            <Toggle
              checked={settings.widgetShow.today}
              onChange={(v) => updateSettings({ widgetShow: { ...settings.widgetShow, today: v } })}
              label="今日番茄数"
            />
            <Toggle
              checked={settings.widgetShow.countdown}
              onChange={(v) =>
                updateSettings({ widgetShow: { ...settings.widgetShow, countdown: v } })
              }
              label="倒数日"
              hint="显示置顶或最近的一个倒数事件"
            />
            <Toggle
              checked={settings.widgetShow.todo}
              onChange={(v) => updateSettings({ widgetShow: { ...settings.widgetShow, todo: v } })}
              label="下一条待办"
            />
          </div>
        </div>
        <Toggle
          checked={settings.widgetLocked}
          onChange={(v) => updateSettings({ widgetLocked: v })}
          label="锁定小组件位置"
          hint="锁定后无法拖动小组件，避免误触；位置会被记住并在下次启动时还原"
        />
        <Row label="不透明度" hint={`当前 ${Math.round(settings.widgetOpacity * 100)}%`}>
          <input
            type="range"
            min={40}
            max={100}
            step={2}
            value={Math.round(settings.widgetOpacity * 100)}
            onChange={(e) => updateSettings({ widgetOpacity: Number(e.target.value) / 100 })}
            className="w-40"
          />
        </Row>
      </Section>

      <Section icon={<Database size={16} />} title="数据">
        <Row label="导出备份" hint="把所有数据保存为 JSON 文件">
          <button
            type="button"
            disabled={!tauri}
            onClick={() => void handleExport()}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} /> 导出
          </button>
        </Row>
        <Row label="导入备份" hint="从 JSON 文件恢复数据，会覆盖当前数据">
          <button
            type="button"
            disabled={!tauri}
            onClick={() => void handleImport()}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={14} /> 导入
          </button>
        </Row>
        <Row label="重置全部数据" hint="清空待办、倒数日与统计数据，操作不可撤销">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("确定要清空全部数据吗？此操作不可恢复。")) resetAll();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/20"
          >
            <RotateCcw size={14} /> 重置
          </button>
        </Row>
      </Section>

      <Section icon={<Download size={16} />} title="更新">
        <Row
          label="检查更新"
          hint={`打开 GitHub Releases 页面：${RELEASES_URL.replace(/^https:\/\//, "")}`}
        >
          <button
            type="button"
            onClick={() => void openReleasePage()}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid"
          >
            <ExternalLink size={14} /> 打开更新页面
          </button>
        </Row>
        <Row label="版本" hint="安装包会发布在 Releases 页面">
          <span className="text-xs font-semibold tabular-nums text-muted">v0.15.0</span>
        </Row>
      </Section>

      <ManualSection />

      {status ? (
        <p className="fd-pop rounded-xl border border-line bg-card px-4 py-2.5 text-xs break-all text-muted">
          {status}
        </p>
      ) : null}

      <p className="text-center text-[11px] text-muted">
        FocusDay v0.15.0 · 番茄工作法 + 待办清单 + 倒数日 · {formatDate(todayISO())}
      </p>
    </div>
  );
}
