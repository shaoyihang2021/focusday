import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  Timer as TimerIcon,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { lastDays, monthGrid, monthPeak, streakDays, todayStat, totals } from "../lib/stats";
import { formatDate, formatMonth, parseDay, shortDate, todayISO, weekdayName } from "../lib/date";
import { humanizeMinutes } from "../lib/timer";
import { Card, EmptyState } from "./ui";
import { cn } from "../lib/cn";

const WEEK_HEAD = ["一", "二", "三", "四", "五", "六", "日"];

/** Heat levels: 0 = none, then four steps scaled against the month's peak. */
function heatLevel(minutes: number, peak: number): number {
  if (minutes <= 0 || peak <= 0) return 0;
  const ratio = minutes / peak;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const HEAT_CLASS = [
  "bg-black/[0.05] dark:bg-white/[0.06]",
  "bg-brand/25",
  "bg-brand/45",
  "bg-brand/70",
  "bg-brand",
];

function Metric({
  icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit: string;
  hint?: string;
}) {
  return (
    <Card className="fd-pop p-5">
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-ink">{value}</span>
        <span className="text-xs font-medium text-muted">{unit}</span>
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  );
}

export default function StatsView() {
  const focusByDay = useAppStore((s) => s.focusByDay);

  const week = useMemo(() => lastDays(focusByDay, 7), [focusByDay]);
  const today = todayStat(focusByDay);
  const total = totals(focusByDay);
  const streak = streakDays(focusByDay);
  const weekMinutes = week.reduce((sum, day) => sum + day.stat.minutes, 0);
  const weekCount = week.reduce((sum, day) => sum + day.stat.count, 0);
  const peak = Math.max(...week.map((day) => day.stat.minutes));
  const activeDays = week.filter((day) => day.stat.count > 0).length;

  // Month shown in the heatmap, as an offset in months from the current one.
  const [monthOffset, setMonthOffset] = useState(0);
  const shown = useMemo(() => {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [monthOffset]);
  const grid = useMemo(
    () => monthGrid(focusByDay, shown.year, shown.month),
    [focusByDay, shown.year, shown.month],
  );
  const gridPeak = monthPeak(grid);
  const monthTotal = grid
    .flat()
    .filter((cell) => cell.inMonth)
    .reduce((sum, cell) => sum + cell.stat.minutes, 0);

  if (total.count === 0) {
    return (
      <Card className="fd-pop">
        <EmptyState
          icon={<ChartColumn size={24} />}
          title="还没有专注记录"
          hint="在番茄钟里完成一个专注时段，这里就会显示你的专注趋势、累计时长与连续天数。"
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          icon={<Target size={14} />}
          label="今日专注"
          value={today.minutes}
          unit="分钟"
          hint={`${today.count} 个番茄`}
        />
        <Metric
          icon={<TrendingUp size={14} />}
          label="近 7 天专注"
          value={weekMinutes}
          unit="分钟"
          hint={`${activeDays} 天有专注 · ${weekCount} 个番茄`}
        />
        <Metric
          icon={<TimerIcon size={14} />}
          label="累计专注"
          value={total.minutes}
          unit="分钟"
          hint={`共 ${total.count} 个番茄`}
        />
        <Metric
          icon={<Flame size={14} />}
          label="连续专注"
          value={streak}
          unit="天"
          hint={streak > 0 ? "保持下去！" : "今天开始一个新的连续记录"}
        />
      </div>

      <Card className="fd-pop p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">近 7 天专注时长</h2>
            <p className="mt-0.5 text-xs text-muted">
              共 {humanizeMinutes(weekMinutes)}，单日最高 {humanizeMinutes(peak)}
            </p>
          </div>
          <p className="text-[11px] text-muted">单位：分钟</p>
        </div>

        <div className="flex items-end gap-2 sm:gap-3">
          {week.map(({ date, stat }) => {
            const isToday = date === todayISO();
            const ratio = peak > 0 ? stat.minutes / peak : 0;
            const isBest = peak > 0 && stat.minutes === peak && stat.minutes > 0;
            return (
              <div key={date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    stat.minutes > 0 ? "text-ink" : "text-muted/60",
                  )}
                >
                  {stat.minutes}
                </span>

                <div
                  className={cn(
                    "relative flex h-32 w-full items-end overflow-hidden rounded-lg",
                    "bg-black/[0.045] dark:bg-white/[0.06]",
                    isToday && "ring-1 ring-brand/30",
                  )}
                  title={`${weekdayName(date)} ${formatDate(date)} · ${stat.minutes} 分钟 · ${stat.count} 个番茄`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-[height] duration-500",
                      isToday ? "bg-brand" : isBest ? "bg-brand/70" : "bg-brand/45",
                    )}
                    style={{ height: `${ratio * 100}%` }}
                  />
                </div>

                <div className="text-center">
                  <p
                    className={cn(
                      "text-[11px] leading-tight",
                      isToday ? "font-semibold text-brand" : "text-muted",
                    )}
                  >
                    {weekdayName(date)}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted/80">{shortDate(date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="fd-pop p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{formatMonth(shown.year, shown.month)} 专注热力图</h2>
            <p className="mt-0.5 text-xs text-muted">本月共 {humanizeMinutes(monthTotal)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((v) => v - 1)}
              title="上个月"
              className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              disabled={monthOffset === 0}
              className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              本月
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset((v) => Math.min(0, v + 1))}
              disabled={monthOffset === 0}
              title="下个月"
              className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEK_HEAD.map((label) => (
              <div key={label} className="text-center text-[10px] text-muted">
                周{label}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {grid.map((weekRow, index) => (
              <div key={index} className="grid grid-cols-7 gap-1">
                {weekRow.map((cell) => {
                  const level = cell.inMonth ? heatLevel(cell.stat.minutes, gridPeak) : 0;
                  const isToday = cell.date === todayISO();
                  return (
                    <div
                      key={cell.date}
                      title={`${formatDate(cell.date)} ${weekdayName(cell.date)} · ${cell.stat.minutes} 分钟 · ${cell.stat.count} 个番茄`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-[10px] tabular-nums transition-colors",
                        cell.inMonth ? HEAT_CLASS[level] : "bg-black/[0.025] dark:bg-white/[0.03]",
                        !cell.inMonth && "text-muted/50",
                        cell.inMonth && level >= 3 && "text-white/95",
                        isToday && "ring-1 ring-brand",
                      )}
                    >
                      {parseDay(cell.date).getDate()}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted">
          <span>少</span>
          {HEAT_CLASS.map((cls, level) => (
            <span key={level} className={cn("h-3 w-3 rounded-sm", cls)} />
          ))}
          <span>多</span>
        </div>
      </Card>

      <p className="text-center text-[11px] text-muted">
        专注记录保存在本地，可在「设置 → 数据」中导出备份
      </p>
    </div>
  );
}
