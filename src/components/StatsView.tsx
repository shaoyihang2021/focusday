import type { ReactNode } from "react";
import { useMemo } from "react";
import { ChartColumn, Flame, Target, Timer as TimerIcon, TrendingUp } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { lastDays, streakDays, todayStat, totals } from "../lib/stats";
import { shortDate, todayISO, weekdayName } from "../lib/date";
import { humanizeMinutes } from "../lib/timer";
import { Card, EmptyState } from "./ui";
import { cn } from "../lib/cn";

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
                  title={`${weekdayName(date)} ${date} · ${stat.minutes} 分钟 · ${stat.count} 个番茄`}
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

      <p className="text-center text-[11px] text-muted">
        专注记录保存在本地，可在「设置 → 数据」中导出备份
      </p>
    </div>
  );
}
