import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Pin, Plus, Trash2, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import { countdownInfo, formatDate, todayISO, type CountdownInfo } from "../lib/date";
import { MAX_INTERVAL_DAYS, MIN_INTERVAL_DAYS } from "../store/defaults";
import { Card, EmptyState, Segmented, Toggle } from "./ui";
import { cn } from "../lib/cn";
import type { Countdown, CountdownRepeat, CountdownStyle } from "../types";

const COLORS = ["#f74a2c", "#f59e0b", "#22a699", "#3b82f6", "#8b5cf6", "#ec4899"];

const REPEATS: { value: CountdownRepeat; label: string }[] = [
  { value: "none", label: "不重复" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "custom", label: "每 N 天" },
];

const REPEAT_LABEL: Record<CountdownRepeat, string> = {
  none: "",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
  custom: "",
};

const STYLES: { value: CountdownStyle; label: string }[] = [
  { value: "classic", label: "经典" },
  { value: "wandering", label: "流浪地球" },
];

/** `每 14 天` — the custom interval badge; other repeats use `REPEAT_LABEL`. */
const repeatText = (item: Countdown): string =>
  item.repeat === "custom" ? `每 ${item.intervalDays ?? MIN_INTERVAL_DAYS} 天` : REPEAT_LABEL[item.repeat];

const clampInterval = (value: number): number =>
  Math.round(Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, value || MIN_INTERVAL_DAYS)));

interface PosterContent {
  lead: string;
  value: number;
  unitCn: string;
  /** Upper-case English lines printed under the number. */
  lines: string[];
}

/**
 * Coarse copy for the sci-fi poster card: once the gap is a month or more it
 * counts in months (like the reference poster), otherwise in days.
 */
function posterContent(item: Countdown, info: CountdownInfo): PosterContent {
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

/** Colour swatches, shared by the add form and the edit dialog. */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2 py-1.5">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`标记色 ${color}`}
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={cn(
            "h-6 w-6 rounded-full transition-transform",
            value === color ? "scale-110 ring-2 ring-offset-2 ring-offset-transparent" : "opacity-70",
          )}
        />
      ))}
    </div>
  );
}

interface RepeatFieldProps {
  repeat: CountdownRepeat;
  intervalDays: number;
  onRepeat: (repeat: CountdownRepeat) => void;
  onIntervalDays: (days: number) => void;
}

/** Recurrence picker plus the custom interval input. */
function RepeatField({ repeat, intervalDays, onRepeat, onIntervalDays }: RepeatFieldProps) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">重复周期</p>
      <Segmented options={REPEATS} value={repeat} onChange={onRepeat} />
      {repeat === "custom" ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            aria-label="间隔天数"
            min={MIN_INTERVAL_DAYS}
            max={MAX_INTERVAL_DAYS}
            value={intervalDays}
            onChange={(e) => onIntervalDays(Number(e.target.value))}
            onBlur={() => onIntervalDays(clampInterval(intervalDays))}
            className="w-24 rounded-xl border border-line bg-solid px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-brand"
          />
          <span className="text-sm text-muted">天一次（1–3650）</span>
        </div>
      ) : null}
    </div>
  );
}

interface StyleFieldProps {
  style: CountdownStyle;
  subtitleEn: string;
  onStyle: (style: CountdownStyle) => void;
  onSubtitleEn: (text: string) => void;
  /** Optional Enter shortcut, used by the add form. */
  onEnter?: () => void;
}

/** Card look picker; the poster style also takes an optional English subtitle. */
function StyleField({ style, subtitleEn, onStyle, onSubtitleEn, onEnter }: StyleFieldProps) {
  return (
    <div className="min-w-[260px]">
      <p className="mb-1.5 text-sm font-medium text-ink">卡片风格</p>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={STYLES} value={style} onChange={onStyle} />
        {style === "wandering" ? (
          <input
            value={subtitleEn}
            aria-label="英文副标题"
            onChange={(e) => onSubtitleEn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
            placeholder="英文副标题（可选）· THE WANDERING EARTH 3"
            className="min-w-[200px] flex-1 rounded-xl border border-line bg-solid px-3 py-2.5 text-sm tracking-wide text-ink uppercase outline-none placeholder:normal-case placeholder:text-muted focus:border-brand"
          />
        ) : null}
      </div>
    </div>
  );
}

interface CardActionsProps {
  item: Countdown;
  onEdit: () => void;
}

/** Per-card controls: pin to the desktop widget, edit, delete. */
function CardActions({ item, onEdit }: CardActionsProps) {
  const togglePinned = useAppStore((s) => s.togglePinned);
  const removeCountdown = useAppStore((s) => s.removeCountdown);
  const poster = item.style === "wandering";

  const base = "grid h-7 w-7 place-items-center rounded-lg transition-colors";
  const subtle = poster
    ? "text-white/60 hover:bg-white/10 hover:text-white"
    : "text-muted hover:bg-solid hover:text-ink";
  const danger = poster
    ? "text-white/60 hover:bg-white/10 hover:text-rose-400"
    : "text-muted hover:bg-rose-500/10 hover:text-rose-500";
  const pinnedOn = poster ? "bg-white/15 text-white" : "bg-brand-soft text-brand";

  return (
    <div className="absolute top-3 right-3 flex gap-1 opacity-60 transition-opacity duration-200 group-hover:opacity-100">
      <button
        type="button"
        onClick={() => togglePinned(item.id)}
        title={item.pinned ? "取消钉在桌面" : "钉在桌面"}
        aria-pressed={item.pinned}
        className={cn(base, item.pinned ? pinnedOn : subtle)}
      >
        <Pin size={14} />
      </button>
      <button type="button" onClick={onEdit} title="编辑" className={cn(base, subtle)}>
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => removeCountdown(item.id)}
        title="删除"
        className={cn(base, danger)}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** The reference look: black panel, red rule, oversized number, English line. */
function WanderingCard({
  item,
  info,
  onEdit,
}: {
  item: Countdown;
  info: CountdownInfo;
  onEdit: () => void;
}) {
  const { lead, value, unitCn, lines } = posterContent(item, info);

  return (
    <Card
      style={{ backgroundColor: "#0b0b0c" }}
      className={cn(
        "fd-pop group relative overflow-hidden border-white/10 p-6",
        !info.upcoming && "opacity-80",
      )}
    >
      <CardActions item={item} onEdit={onEdit} />

      <p className="pr-24 text-lg leading-snug font-bold text-white">距{item.title}</p>

      <div className="mt-7 flex items-stretch gap-3">
        <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end gap-x-3">
            <span className="text-sm font-semibold text-white/85">{lead}</span>
            <span
              className="text-5xl leading-none font-black tracking-tight tabular-nums"
              style={{ color: item.color }}
            >
              {value}
            </span>
            <span className="mb-0.5 text-base font-bold text-white">{unitCn}</span>
          </div>
          <div className="mt-3 flex flex-col gap-0.5 text-[10px] leading-tight font-semibold tracking-[0.12em] text-white/85 uppercase">
            {lines.map((line) => (
              <p key={line} className="truncate">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/45">
        <span>
          {formatDate(info.nextDate)} · {info.weekday}
          {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
        </span>
        {item.note ? <span className="w-full truncate">{item.note}</span> : null}
      </div>
    </Card>
  );
}

interface EditDraft {
  title: string;
  date: string;
  color: string;
  repeat: CountdownRepeat;
  intervalDays: number;
  style: CountdownStyle;
  subtitleEn: string;
  pinned: boolean;
}

/** Modal that edits every field of an existing countdown. */
function EditDialog({ item, onClose }: { item: Countdown; onClose: () => void }) {
  const updateCountdown = useAppStore((s) => s.updateCountdown);
  const [draft, setDraft] = useState<EditDraft>(() => ({
    title: item.title,
    date: item.date,
    color: item.color,
    repeat: item.repeat,
    intervalDays: item.intervalDays ?? 14,
    style: item.style,
    subtitleEn: item.subtitleEn ?? "",
    pinned: item.pinned,
  }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (next: Partial<EditDraft>) => setDraft((current) => ({ ...current, ...next }));
  const valid = draft.title.trim() !== "" && draft.date !== "";

  const save = () => {
    if (!valid) return;
    updateCountdown(item.id, {
      title: draft.title.trim(),
      date: draft.date,
      color: draft.color,
      repeat: draft.repeat,
      intervalDays: clampInterval(draft.intervalDays),
      style: draft.style,
      subtitleEn: draft.style === "wandering" ? draft.subtitleEn.trim() || undefined : undefined,
      pinned: draft.pinned,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
    >
      <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
        <Card className="fd-pop max-h-[86vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">编辑倒数日</h2>
            <button
              type="button"
              onClick={onClose}
              title="关闭"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-solid hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="fd-edit-title" className="mb-1.5 block text-xs font-medium text-muted">
                事件名称
              </label>
              <input
                id="fd-edit-title"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                className="w-full rounded-xl border border-line bg-solid px-4 py-2.5 text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="fd-edit-date" className="mb-1.5 block text-xs font-medium text-muted">
                目标日期
              </label>
              <input
                id="fd-edit-date"
                type="date"
                lang="zh-CN"
                value={draft.date}
                onChange={(e) => patch({ date: e.target.value })}
                className="rounded-xl border border-line bg-solid px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">标记色</p>
              <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
            </div>

            <RepeatField
              repeat={draft.repeat}
              intervalDays={draft.intervalDays}
              onRepeat={(repeat) => patch({ repeat })}
              onIntervalDays={(intervalDays) => patch({ intervalDays })}
            />

            <StyleField
              style={draft.style}
              subtitleEn={draft.subtitleEn}
              onStyle={(style) => patch({ style })}
              onSubtitleEn={(subtitleEn) => patch({ subtitleEn })}
            />

            <Toggle
              checked={draft.pinned}
              onChange={(pinned) => patch({ pinned })}
              label="钉在桌面"
              hint="钉住的倒数日会显示在桌面小组件上"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line bg-card px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid"
            >
              取消
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!valid}
              className="fd-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-lg shadow-brand/25 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
            >
              保存
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CountdownView() {
  const countdowns = useAppStore((s) => s.countdowns);
  const addCountdown = useAppStore((s) => s.addCountdown);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [color, setColor] = useState(COLORS[0]);
  const [repeat, setRepeat] = useState<CountdownRepeat>("none");
  const [intervalDays, setIntervalDays] = useState(14);
  const [style, setStyle] = useState<CountdownStyle>("classic");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState<Countdown | null>(null);

  const now = new Date(useNow(60_000));

  const items = useMemo(() => {
    const enriched = countdowns.map((c) => ({ item: c, info: countdownInfo(c, now) }));
    return enriched.sort((a, b) => {
      if (a.item.pinned !== b.item.pinned) return a.item.pinned ? -1 : 1;
      const aFuture = a.info.upcoming;
      const bFuture = b.info.upcoming;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.info.days - b.info.days : b.info.days - a.info.days;
    });
  }, [countdowns, now]);

  const submit = () => {
    if (!title.trim() || !date) return;
    addCountdown({
      title,
      date,
      color,
      repeat,
      intervalDays: repeat === "custom" ? clampInterval(intervalDays) : undefined,
      style,
      subtitleEn: style === "wandering" ? subtitleEn : undefined,
      pinned,
    });
    setTitle("");
    setDate(todayISO());
    setRepeat("none");
    setPinned(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Card className="fd-pop p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">事件名称</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="例如：项目上线、生日、旅行出发"
              className="w-full rounded-xl border border-line bg-solid px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">目标日期</label>
            <input
              type="date"
              lang="zh-CN"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-line bg-solid px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">标记色</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || !date}
            className="fd-primary flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-lg shadow-brand/25 transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
          >
            <Plus size={16} /> 添加
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line pt-3">
          <RepeatField
            repeat={repeat}
            intervalDays={intervalDays}
            onRepeat={setRepeat}
            onIntervalDays={setIntervalDays}
          />
          <StyleField
            style={style}
            subtitleEn={subtitleEn}
            onStyle={setStyle}
            onSubtitleEn={setSubtitleEn}
            onEnter={submit}
          />
          <div className="w-56">
            <Toggle
              checked={pinned}
              onChange={setPinned}
              label="钉在桌面"
              hint="钉住的倒数日会显示在桌面小组件上"
            />
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="fd-pop">
          <EmptyState
            icon={<CalendarDays size={24} />}
            title="还没有倒数事件"
            hint="添加你期待的日子，它会每天自动计算还剩多少天，还能钉到桌面小组件上；选择「流浪地球」风格即可切换成黑底红字的海报样式。"
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ item, info }) =>
            item.style === "wandering" ? (
              <WanderingCard
                key={item.id}
                item={item}
                info={info}
                onEdit={() => setEditing(item)}
              />
            ) : (
              <Card
                key={item.id}
                className={cn("fd-pop group relative overflow-hidden p-5", !info.upcoming && "opacity-75")}
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: item.color }}
                />
                <CardActions item={item} onEdit={() => setEditing(item)} />

                <div className="min-w-0 pr-24">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDate(info.nextDate)} · {info.weekday}
                    {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
                  </p>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className="text-4xl font-bold tabular-nums tracking-tight"
                    style={{ color: info.upcoming ? item.color : undefined }}
                  >
                    {Math.abs(info.days)}
                  </span>
                  <span className="text-sm font-medium text-muted">天</span>
                  <span className="ml-auto text-xs font-medium text-muted">
                    {info.days > 0 ? "后" : info.days < 0 ? "前" : "今天"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-muted">{info.label}</p>

                {item.note ? (
                  <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                    {item.note}
                  </p>
                ) : null}
              </Card>
            ),
          )}
        </div>
      )}

      {editing ? <EditDialog item={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
