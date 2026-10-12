import type { ReactNode } from "react";
import { Bell, Eye, EyeOff, LayoutGrid, Palette, RotateCcw, Volume2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Card, Stepper, Toggle } from "./ui";
import { setWidgetAlwaysOnTop, setWidgetVisible } from "../lib/widget";
import { isTauri } from "../lib/env";

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
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

export default function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const resetAll = useAppStore((s) => s.resetAll);
  const tauri = isTauri();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Section icon={<LayoutGrid size={16} />} title="时长设置">
        <Row label="专注时长" hint="每个番茄的时长">
          <Stepper
            value={settings.workMin}
            min={1}
            max={90}
            suffix="分钟"
            onChange={(v) => updateSettings({ workMin: v })}
          />
        </Row>
        <Row label="短休息">
          <Stepper
            value={settings.shortMin}
            min={1}
            max={30}
            suffix="分钟"
            onChange={(v) => updateSettings({ shortMin: v })}
          />
        </Row>
        <Row label="长休息">
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
      </Section>

      <Section icon={<Palette size={16} />} title="外观">
        <Row label="主题" hint="浅色 / 深色 / 跟随系统">
          <div className="flex gap-1 rounded-xl border border-line bg-card p-1">
            {(["light", "dark", "system"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                  (settings.theme === mode ? "bg-solid text-ink shadow-sm" : "text-muted hover:text-ink")
                }
              >
                {mode === "light" ? "浅色" : mode === "dark" ? "深色" : "系统"}
              </button>
            ))}
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
              className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
            void setWidgetAlwaysOnTop(v);
          }}
          label="小组件窗口置顶"
          hint="开启后小组件会始终显示在其他窗口之上"
        />
      </Section>

      <Section icon={<Volume2 size={16} />} title="数据">
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

      <p className="text-center text-[11px] text-muted">
        FocusDay v0.1.0 · 番茄工作法 + 待办清单 + 倒数日
      </p>
    </div>
  );
}
