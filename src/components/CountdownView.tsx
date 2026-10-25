import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Pin, Plus, Trash2, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import { countdownInfo, dateKey, formatDate, parseDay, todayISO, weekdayName, type CountdownInfo } from "../lib/date";
import {
  LUNAR_DAYS,
  LUNAR_MONTHS,
  lunarLeapMonth,
  lunarMonthDays,
  lunarToSolar,
  solarToLunar,
} from "../lib/lunar";
import {
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS,
  calendarText,
  clampInterval,
  posterContent,
  repeatText,
} from "../lib/countdown";
import { Card, EmptyState, Segmented } from "./ui";
import { cn } from "../lib/cn";
import type {
  Countdown,
  CountdownCalendar,
  CountdownRepeat,
  CountdownStyle,
} from "../types";

const COLORS = ["#f74a2c", "#f59e0b", "#22a699", "#3b82f6", "#8b5cf6", "#ec4899"];

const REPEATS: { value: CountdownRepeat; label: string }[] = [
  { value: "none", label: "不重复" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "custom", label: "每 N 天" },
];

const STYLES: { value: CountdownStyle; label: string }[] = [
  { value: "classic", label: "经典" },
  { value: "wandering", label: "流浪地球" },
];

/** Colour swatches, shared by the add form and the edit dialog. */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-2">
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
function RepeatField({
  repeat,
  intervalDays,
  onRepeat,
  onIntervalDays,
  options = REPEATS,
}: RepeatFieldProps & { options?: typeof REPEATS }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">重复周期</p>
      <Segmented options={options} value={repeat} onChange={onRepeat} />
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

const CALENDARS: { value: CountdownCalendar; label: string }[] = [
  { value: "lunar", label: "阴历" },
  { value: "solar", label: "阳历" },
];

interface LunarDraft {
  year: number;
  month: number;
  day: number;
  leap: boolean;
}

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
    "h-10 rounded-xl border border-line bg-solid px-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <div className="min-w-[356px]">
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
            id={`${idPrefix}-solar`}
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
              className={cn(selectClass, "w-20")}
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
              className={cn(selectClass, "w-16")}
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
              className={cn(selectClass, "w-16")}
            >
              {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>
                  {LUNAR_DAYS[day - 1]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {calendar === "lunar" ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {leapAvailable ? (
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={lunar.leap}
                onChange={(e) => patch({ leap: e.target.checked })}
              />
              闰{lunar.month}月
            </label>
          ) : null}
          <span>
            {solar
              ? `对应阳历 ${formatDate(dateKey(solar))} · ${weekdayName(dateKey(solar))}`
              : "该阴历日期不存在，请重新选择"}
          </span>
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
          {calendarText(item, info.lunarLeap)
            ? `${calendarText(item, info.lunarLeap)} · `
            : ""}
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
  calendar: CountdownCalendar;
  lunar: LunarDraft;
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
    calendar: item.calendar === "lunar" ? "lunar" : "solar",
    lunar:
      item.calendar === "lunar"
        ? {
            year: Number(item.date.slice(0, 4)),
            month: Number(item.date.slice(5, 7)),
            day: Number(item.date.slice(8, 10)),
            leap: item.leapMonth === true,
          }
        : solarToLunar(parseDay(item.date)),
  }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = (next: Partial<EditDraft>) => setDraft((current) => ({ ...current, ...next }));
  const lunarDate = `${draft.lunar.year}-${`${draft.lunar.month}`.padStart(2, "0")}-${`${draft.lunar.day}`.padStart(2, "0")}`;
  const targetDate = draft.calendar === "lunar" ? lunarDate : draft.date;
  const lunarValid =
    draft.calendar === "solar" ||
    lunarToSolar(draft.lunar.year, draft.lunar.month, draft.lunar.day, draft.lunar.leap) !== null;
  const valid = draft.title.trim() !== "" && targetDate !== "" && lunarValid;

  const save = () => {
    if (!valid) return;
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

            <CalendarField
              calendar={draft.calendar}
              solarDate={draft.date}
              lunar={draft.lunar}
              onCalendar={(next) => {
                const converted = lunarToSolar(
                  draft.lunar.year,
                  draft.lunar.month,
                  draft.lunar.day,
                  draft.lunar.leap,
                );
                patch({
                  calendar: next,
                  date: next === "solar" && converted ? dateKey(converted) : draft.date,
                  lunar: next === "lunar" ? solarToLunar(parseDay(draft.date)) : draft.lunar,
                  repeat:
                    next === "lunar" && draft.repeat !== "none" && draft.repeat !== "yearly"
                      ? "yearly"
                      : draft.repeat,
                });
              }}
              onSolarDate={(date) => patch({ date })}
              onLunar={(lunar) => patch({ lunar })}
              idPrefix="fd-edit"
            />

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">标记色</p>
              <ColorPicker value={draft.color} onChange={(color) => patch({ color })} />
            </div>

            <RepeatField
              repeat={draft.repeat}
              intervalDays={draft.intervalDays}
              options={
                draft.calendar === "lunar"
                  ? REPEATS.filter((r) => r.value === "none" || r.value === "yearly")
                  : REPEATS
              }
              onRepeat={(repeat) => patch({ repeat })}
              onIntervalDays={(intervalDays) => patch({ intervalDays })}
            />

            <StyleField
              style={draft.style}
              subtitleEn={draft.subtitleEn}
              onStyle={(style) => patch({ style })}
              onSubtitleEn={(subtitleEn) => patch({ subtitleEn })}
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
  const [calendar, setCalendar] = useState<CountdownCalendar>("solar");
  const [lunar, setLunar] = useState<LunarDraft>(() => solarToLunar(new Date()));
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
    const lunarDate = `${lunar.year}-${`${lunar.month}`.padStart(2, "0")}-${`${lunar.day}`.padStart(2, "0")}`;
    const targetDate = calendar === "lunar" ? lunarDate : date;
    const lunarValid =
      calendar === "solar" ||
      lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.leap) !== null;
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
    setTitle("");
    setDate(todayISO());
    setRepeat("none");
    setCalendar("solar");
  };

  const lunarValid =
    calendar === "solar" ||
    lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.leap) !== null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Card className="fd-pop p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted">事件名称</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="例如：项目上线、生日、旅行出发"
              className="h-10 w-full rounded-xl border border-line bg-solid px-4 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
            />
          </div>
          <CalendarField
            calendar={calendar}
            solarDate={date}
            lunar={lunar}
            onCalendar={(next) => {
              if (next === "lunar") {
                setLunar(solarToLunar(parseDay(date)));
                setRepeat((current) =>
                  current === "none" || current === "yearly" ? current : "yearly",
                );
              } else {
                const converted = lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.leap);
                if (converted) setDate(dateKey(converted));
              }
              setCalendar(next);
            }}
            onSolarDate={setDate}
            onLunar={setLunar}
            idPrefix="fd-add"
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">标记色</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || !lunarValid}
            className="fd-primary flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-lg shadow-brand/25 transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 lg:mt-[22px]"
          >
            <Plus size={16} /> 添加
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line pt-3">
          <RepeatField
            repeat={repeat}
            intervalDays={intervalDays}
            options={
              calendar === "lunar"
                ? REPEATS.filter((r) => r.value === "none" || r.value === "yearly")
                : REPEATS
            }
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
        </div>
      </Card>

      <p className="text-[11px] text-muted">
        点卡片右上角的图钉，会在桌面为这条倒数日单独生成一个小部件；再点一次即可收回。
      </p>

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
                    {calendarText(item, info.lunarLeap)
                      ? `${calendarText(item, info.lunarLeap)} · `
                      : ""}
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
