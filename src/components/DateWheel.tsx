import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { dateKey, daysInMonth, parseDay, shiftMonth } from "../lib/date";

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

export interface DateWheelProps {
  open: boolean;
  /** `YYYY-MM-DD` the wheel starts on. */
  value: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * In-app date wheel for the countdown form. The platform picker keeps the day
 * column inside one month; here the day column keeps rolling, so swiping past
 * the last day continues into the next month (and back into the previous one).
 * Rendered through a portal because ancestors with `backdrop-blur` would trap
 * a fixed overlay.
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

  const yearItems = useMemo(
    () =>
      Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => ({
        key: String(MIN_YEAR + i),
        label: `${MIN_YEAR + i}年`,
      })),
    [],
  );
  const monthItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), label: `${i + 1}月` })),
    [],
  );

  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const dayItems = useMemo(() => {
    const build = (y: number, m: number, dim: boolean): WheelItem[] =>
      Array.from({ length: daysInMonth(y, m) }, (_, i) => ({
        key: `${y}-${m}-${i + 1}`,
        label: String(i + 1),
        dim,
      }));
    return [
      ...build(previous.year, previous.month, true),
      ...build(year, month, false),
      ...build(next.year, next.month, true),
    ];
  }, [year, month, previous.year, previous.month, next.year, next.month]);

  const daysBefore = daysInMonth(previous.year, previous.month);
  const dayIndex = daysBefore + day - 1;

  if (!open) return null;

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
        className="fd-pop w-full max-w-xs rounded-2xl border border-line bg-solid p-4 shadow-2xl"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p id="fd-date-wheel-title" className="text-sm font-semibold text-ink">
            选择目标日期
          </p>
          <button
            type="button"
            onClick={jumpToday}
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
          <div className="relative flex-1">
            <WheelColumn
              label="年份"
              items={yearItems}
              index={year - MIN_YEAR}
              onIndex={changeYear}
            />
          </div>
          <div className="relative flex-1">
            <WheelColumn
              label="月份"
              items={monthItems}
              index={month - 1}
              onIndex={changeMonth}
            />
          </div>
          <div className="relative flex-1">
            <WheelColumn label="日期" items={dayItems} index={dayIndex} onIndex={changeDay} />
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted">
          上下滑动选择，滑过月末会进入下一个月
        </p>

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
            onClick={() => onConfirm(dateKey(new Date(year, month - 1, day)))}
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
