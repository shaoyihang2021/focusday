import { useMemo, useState } from "react";
import { CalendarDays, Pin, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import { countdownInfo, formatDate, todayISO } from "../lib/date";
import { Card, EmptyState, Toggle } from "./ui";
import { cn } from "../lib/cn";

const COLORS = ["#f74a2c", "#f59e0b", "#22a699", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function CountdownView() {
  const countdowns = useAppStore((s) => s.countdowns);
  const addCountdown = useAppStore((s) => s.addCountdown);
  const removeCountdown = useAppStore((s) => s.removeCountdown);
  const togglePinned = useAppStore((s) => s.togglePinned);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [color, setColor] = useState(COLORS[0]);
  const [yearly, setYearly] = useState(false);
  const [pinned, setPinned] = useState(false);

  const now = new Date(useNow(60_000));

  const items = useMemo(() => {
    const enriched = countdowns.map((c) => ({ item: c, info: countdownInfo(c.date, c.yearly, now) }));
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
    addCountdown({ title, date, color, yearly, pinned });
    setTitle("");
    setDate(todayISO());
    setYearly(false);
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-line bg-solid px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">标记色</label>
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2 py-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform",
                    color === c ? "scale-110 ring-2 ring-offset-2 ring-offset-transparent" : "opacity-70",
                  )}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            className="fd-primary flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-lg shadow-brand/25 transition-all hover:brightness-105 active:scale-[0.98]"
          >
            <Plus size={16} /> 添加
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-line pt-1">
          <div className="w-64">
            <Toggle checked={yearly} onChange={setYearly} label="每年重复" hint="生日、纪念日等" />
          </div>
          <div className="w-64">
            <Toggle checked={pinned} onChange={setPinned} label="置顶显示" hint="同时展示在桌面小组件" />
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="fd-pop">
          <EmptyState
            icon={<CalendarDays size={24} />}
            title="还没有倒数事件"
            hint="添加你期待的日子，它会每天自动计算还剩多少天，还能钉到桌面小组件上。"
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ item, info }) => (
            <Card
              key={item.id}
              className={cn("fd-pop group relative overflow-hidden p-5", !info.upcoming && "opacity-75")}
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDate(item.date)} · {info.weekday}
                    {item.yearly ? " · 每年" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => togglePinned(item.id)}
                    title="置顶"
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg transition-colors",
                      item.pinned
                        ? "bg-brand-soft text-brand"
                        : "text-muted opacity-0 group-hover:opacity-100 hover:text-ink",
                    )}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCountdown(item.id)}
                    title="删除"
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
