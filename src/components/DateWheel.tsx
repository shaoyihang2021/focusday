import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { dateKey, daysInMonth, parseDay, shiftMonth } from "../lib/date";
import {
  LUNAR_DAYS,
  LUNAR_MONTHS,
  lunarLeapMonth,
  lunarMonthDays,
  lunarMonthOptions,
  shiftLunarMonth,
  solarToLunar,
} from "../lib/lunar";

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const COLUMN_PAD = (COLUMN_HEIGHT - ITEM_HEIGHT) / 2;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

interface WheelItem {
  key: string;
  label: string;
  /** Days borrowed from the neighbouring months are shown dimmed. */
  dim?: boolean;
}

interface WheelColumnProps {
  label: string;
  items: WheelItem[];
  index: number;
  onIndex: (index: number) => void;
}

/** A single snap-scrolling column of the date wheel. */
function WheelColumn({ label, items, index, onIndex }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);

  // Keep the column on the selected row, including after the day list has been
  // rebuilt for a different month.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
  }, [index, items.length]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  // A mouse notch reports ~100px of delta, which would otherwise skip 2–3 rows.
  // Convert wheel input into exact one-row steps instead of native scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let accumulated = 0;
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      accumulated += event.deltaY;
      const now = performance.now();
      if (Math.abs(accumulated) < 30 || now - lastStep < 90) return;
      const direction = accumulated > 0 ? 1 : -1;
      accumulated = 0;
      lastStep = now;
      const next = Math.max(0, Math.min(items.length - 1, index + direction));
      if (next !== index) onIndex(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [index, items.length, onIndex]);

  const handleScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const next = Math.max(
        0,
        Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)),
      );
      if (next === index) {
        el.scrollTo({ top: next * ITEM_HEIGHT, behavior: "smooth" });
      } else {
        onIndex(next);
      }
    }, 120);
  };

  return (
    <div className="relative" style={{ height: COLUMN_HEIGHT }}>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={handleScroll}
        className="h-full snap-y snap-mandatory overflow-y-auto outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: COLUMN_PAD, paddingBottom: COLUMN_PAD }}
      >
        {items.map((item, i) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={i === index}
            onClick={() => onIndex(i)}
            style={{ height: ITEM_HEIGHT }}
            className={cn(
              "flex w-full snap-center items-center justify-center tabular-nums transition-colors",
              i === index
                ? "text-base font-semibold text-ink"
                : cn("text-sm", item.dim ? "text-muted/45" : "text-muted"),
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface WheelColumnConfig {
  key: string;
  label: string;
  items: WheelItem[];
  index: number;
  onIndex: (index: number) => void;
}

interface WheelDialogProps {
  open: boolean;
  hint: string;
  columns: WheelColumnConfig[];
  onToday: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Shared modal shell for the solar and lunar date wheels. */
function WheelDialog({
  open,
  hint,
  columns,
  onToday,
  onCancel,
  onConfirm,
}: WheelDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fd-fade fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fd-date-wheel-title"
        className="fd-pop w-full max-w-xs rounded-2xl border border-line bg-card p-4 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p id="fd-date-wheel-title" className="text-sm font-semibold text-ink">
            选择目标日期
          </p>
          <button
            type="button"
            onClick={onToday}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            回到今天
          </button>
        </div>

        <div className="relative flex rounded-xl border border-line bg-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 rounded-lg bg-brand-soft"
            style={{ top: COLUMN_PAD, height: ITEM_HEIGHT }}
          />
          {columns.map((column) => (
            <div key={column.key} className="relative flex-1">
              <WheelColumn
                label={column.label}
                items={column.items}
                index={column.index}
                onIndex={column.onIndex}
              />
            </div>
          ))}
        </div>

        <p className="mt-2 text-center text-[11px] text-muted">{hint}</p>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="fd-primary rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface DateWheelProps {
  open: boolean;
  /** `YYYY-MM-DD` the wheel starts on. */
  value: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * In-app solar date wheel. The platform picker keeps the day column inside one
 * month; here the day column keeps rolling, so swiping past the last day
 * continues into the next month (and back into the previous one).
 */
export default function DateWheel({ open, value, onConfirm, onCancel }: DateWheelProps) {
  const initial = parseDay(value);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth() + 1);
  const [day, setDay] = useState(initial.getDate());

  // Reset to the saved date every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const d = parseDay(value);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setDay(d.getDate());
  }, [open, value]);

  const yearItems: WheelItem[] = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => ({
    key: String(MIN_YEAR + i),
    label: `${MIN_YEAR + i}年`,
  }));
  const monthItems: WheelItem[] = Array.from({ length: 12 }, (_, i) => ({
    key: String(i + 1),
    label: `${i + 1}月`,
  }));

  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const buildDays = (y: number, m: number, dim: boolean): WheelItem[] =>
    Array.from({ length: daysInMonth(y, m) }, (_, i) => ({
      key: `${y}-${m}-${i + 1}`,
      label: String(i + 1),
      dim,
    }));
  const dayItems = [
    ...buildDays(previous.year, previous.month, true),
    ...buildDays(year, month, false),
    ...buildDays(next.year, next.month, true),
  ];

  const daysBefore = daysInMonth(previous.year, previous.month);
  const dayIndex = daysBefore + day - 1;

  const changeYear = (index: number) => {
    const nextYear = MIN_YEAR + index;
    setYear(nextYear);
    setDay((current) => Math.min(current, daysInMonth(nextYear, month)));
  };

  const changeMonth = (index: number) => {
    const nextMonth = index + 1;
    setMonth(nextMonth);
    setDay((current) => Math.min(current, daysInMonth(year, nextMonth)));
  };

  const changeDay = (index: number) => {
    if (index < daysBefore) {
      // Rolled back into the previous month.
      setYear(previous.year);
      setMonth(previous.month);
      setDay(index + 1);
      return;
    }
    const currentDays = daysInMonth(year, month);
    if (index < daysBefore + currentDays) {
      setDay(index - daysBefore + 1);
      return;
    }
    // Rolled forward into the next month.
    setYear(next.year);
    setMonth(next.month);
    setDay(index - daysBefore - currentDays + 1);
  };

  const jumpToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setDay(d.getDate());
  };

  return (
    <WheelDialog
      open={open}
      hint="上下滑动选择，滑过月末会进入下一个月"
      onToday={jumpToday}
      onCancel={onCancel}
      onConfirm={() => onConfirm(dateKey(new Date(year, month - 1, day)))}
      columns={[
        { key: "year", label: "年份", items: yearItems, index: year - MIN_YEAR, onIndex: changeYear },
        { key: "month", label: "月份", items: monthItems, index: month - 1, onIndex: changeMonth },
        { key: "day", label: "日期", items: dayItems, index: dayIndex, onIndex: changeDay },
      ]}
    />
  );
}

export interface LunarDateValue {
  year: number;
  month: number;
  day: number;
  leap: boolean;
}

export interface LunarDateWheelProps {
  open: boolean;
  value: LunarDateValue;
  onConfirm: (value: LunarDateValue) => void;
  onCancel: () => void;
}

/**
 * Lunar counterpart of the solar wheel. The month column includes the leap
 * month of the selected year, and the day column rolls across months with the
 * same leap-month ordering used by the calendar conversion.
 */
export function LunarDateWheel({ open, value, onConfirm, onCancel }: LunarDateWheelProps) {
  const [year, setYear] = useState(value.year);
  const [month, setMonth] = useState(value.month);
  const [day, setDay] = useState(value.day);
  const [leap, setLeap] = useState(value.leap);

  useEffect(() => {
    if (!open) return;
    setYear(value.year);
    setMonth(value.month);
    setDay(value.day);
    setLeap(value.leap);
  }, [open, value.year, value.month, value.day, value.leap]);

  const yearItems: WheelItem[] = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => ({
    key: String(MIN_YEAR + i),
    label: `${MIN_YEAR + i}年`,
  }));

  const monthOptions = lunarMonthOptions(year);
  const monthItems: WheelItem[] = monthOptions.map((entry) => ({
    key: `${entry.month}-${entry.leap ? "leap" : "normal"}`,
    label: `${entry.leap ? "闰" : ""}${LUNAR_MONTHS[entry.month - 1]}`,
  }));
  const foundMonth = monthOptions.findIndex((entry) => entry.month === month && entry.leap === leap);
  const monthIndex =
    foundMonth >= 0 ? foundMonth : Math.max(0, monthOptions.findIndex((entry) => entry.month === month));

  const previous = shiftLunarMonth(year, month, leap, -1);
  const next = shiftLunarMonth(year, month, leap, 1);
  const daysBefore = lunarMonthDays(previous.year, previous.month, previous.leap) || 30;
  const currentDays = lunarMonthDays(year, month, leap) || 30;
  const nextDays = lunarMonthDays(next.year, next.month, next.leap) || 30;
  const currentDay = Math.min(day, currentDays);

  const buildDays = (count: number, prefix: string, dim: boolean): WheelItem[] =>
    Array.from({ length: count }, (_, i) => ({
      key: `${prefix}-${i + 1}`,
      label: LUNAR_DAYS[i],
      dim,
    }));
  const dayItems = [
    ...buildDays(daysBefore, "prev", true),
    ...buildDays(currentDays, "current", false),
    ...buildDays(nextDays, "next", true),
  ];
  const dayIndex = daysBefore + currentDay - 1;

  const changeYear = (index: number) => {
    const nextYear = MIN_YEAR + index;
    const nextLeap = leap && lunarLeapMonth(nextYear) === month;
    setYear(nextYear);
    setLeap(nextLeap);
    setDay((current) => Math.min(current, lunarMonthDays(nextYear, month, nextLeap) || current));
  };

  const changeMonth = (index: number) => {
    const target = monthOptions[index];
    if (!target) return;
    setMonth(target.month);
    setLeap(target.leap);
    setDay((current) => Math.min(current, lunarMonthDays(year, target.month, target.leap) || current));
  };

  const changeDay = (index: number) => {
    if (index < daysBefore) {
      setYear(previous.year);
      setMonth(previous.month);
      setLeap(previous.leap);
      setDay(index + 1);
      return;
    }
    if (index < daysBefore + currentDays) {
      setDay(index - daysBefore + 1);
      return;
    }
    setYear(next.year);
    setMonth(next.month);
    setLeap(next.leap);
    setDay(index - daysBefore - currentDays + 1);
  };

  const jumpToday = () => {
    const today = solarToLunar(new Date());
    setYear(today.year);
    setMonth(today.month);
    setDay(today.day);
    setLeap(today.leap);
  };

  return (
    <WheelDialog
      open={open}
      hint="上下滑动选择，闰月会出现在月份列里"
      onToday={jumpToday}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ year, month, day: currentDay, leap })}
      columns={[
        { key: "year", label: "年份", items: yearItems, index: year - MIN_YEAR, onIndex: changeYear },
        { key: "month", label: "月份", items: monthItems, index: monthIndex, onIndex: changeMonth },
        { key: "day", label: "日期", items: dayItems, index: dayIndex, onIndex: changeDay },
      ]}
    />
  );
}
