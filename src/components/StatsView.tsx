import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Flame,
  ImageDown,
  Target,
  Timer as TimerIcon,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import {
  RANGE_CHART_TITLE,
  RANGE_LABEL,
  WEEKDAY_LABELS,
  heatLevel,
  monthGrid,
  monthPeak,
  rangeBars,
  streakDays,
  todayStat,
  totals,
  weekStat,
  yearGrid,
} from "../lib/stats";
import { formatDate, formatMonth, parseDay, todayISO, weekdayName } from "../lib/date";
import { humanizeMinutes } from "../lib/timer";
import { goalProgress } from "../lib/goals";
import { taskFocusRanking, tagFocusTotals, untaggedMinutes } from "../lib/focusBreakdown";
import { exportStatsImage, type ExportRange } from "../lib/shareCard";
import { isTauri } from "../lib/env";
import { Card, EmptyState, Segmented } from "./ui";
import { cn } from "../lib/cn";

const RANGES: { value: ExportRange; label: string }[] = (["week", "month", "year"] as const).map(
  (value) => ({ value, label: RANGE_LABEL[value] }),
);

/** Metric label per range; the chart heading comes from the shared copy. */
const RANGE_METRIC: Record<ExportRange, string> = {
  week: "近 7 天专注",
  month: "近 30 天专注",
  year: "近 12 个月专注",
};

const HEAT_CLASS = [
  "bg-black/[0.05] dark:bg-white/[0.06]",
  "bg-brand/25",
  "bg-brand/45",
  "bg-brand/70",
  "bg-brand",
];

/** The 少 → 多 swatch strip repeated under both heatmaps. */
function HeatLegend() {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted">
      <span>少</span>
      {HEAT_CLASS.map((cls, level) => (
        <span key={level} className={cn("h-3 w-3 rounded-sm", cls)} />
      ))}
      <span>多</span>
    </div>
  );
}

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

/** Horizontal bar used by the task / tag breakdown. */
function FocusBar({
  label,
  minutes,
  max,
  color,
}: {
  label: string;
  minutes: number;
  max: number;
  color?: string;
}) {
  const width = max > 0 ? Math.max(4, (minutes / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-ink">{label}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">
          {humanizeMinutes(minutes)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color ?? "var(--fd-brand)" }}
        />
      </div>
    </div>
  );
}

export default function StatsView() {
  const focusByDay = useAppStore((s) => s.focusByDay);
  const todos = useAppStore((s) => s.todos);
  const tags = useAppStore((s) => s.tags);
  const settings = useAppStore((s) => s.settings);

  const today = todayStat(focusByDay);
  const total = totals(focusByDay);
  const streak = streakDays(focusByDay);
  const todayGoal = goalProgress(today.minutes, settings.dailyGoalMin);
  const week = weekStat(focusByDay);
  const weekGoal = goalProgress(week.minutes, settings.weeklyGoalMin);
  const taskFocus = useMemo(() => taskFocusRanking(todos, 5), [todos]);
  const tagFocus = useMemo(() => tagFocusTotals(todos, tags), [todos, tags]);
  const untagged = useMemo(() => untaggedMinutes(todos), [todos]);

  // One time span drives the metrics, the bar chart, the heatmap and the export.
  const [range, setRange] = useState<ExportRange>("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const bars = useMemo(() => rangeBars(focusByDay, range), [focusByDay, range]);
  const isYear = range === "year";
  const unit = isYear ? "个月" : "天";
  const rangeMinutes = bars.reduce((sum, bar) => sum + bar.minutes, 0);
  const rangeCount = bars.reduce((sum, bar) => sum + bar.count, 0);
  const activeBuckets = bars.filter((bar) => bar.minutes > 0).length;
  const barPeak = Math.max(0, ...bars.map((bar) => bar.minutes));

  // Month shown in the calendar heatmap (only used for the two day ranges).
  const shown = useMemo(() => {
    const base = new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [monthOffset]);
  const monthCells = useMemo(
    () => (isYear ? [] : monthGrid(focusByDay, shown.year, shown.month)),
    [focusByDay, isYear, shown.year, shown.month],
  );
  const monthPeakMinutes = monthPeak(monthCells);
  const monthTotal = monthCells
    .flat()
    .filter((cell) => cell.inMonth)
    .reduce((sum, cell) => sum + cell.stat.minutes, 0);

  const yearCells = useMemo(
    () => (isYear ? yearGrid(focusByDay, new Date().getFullYear()) : []),
    [focusByDay, isYear],
  );
  const yearPeakMinutes = Math.max(
    0,
    ...yearCells.flat().filter((cell) => cell.inMonth).map((cell) => cell.stat.minutes),
  );
  const yearTotal = yearCells
    .flat()
    .filter((cell) => cell.inMonth)
    .reduce((sum, cell) => sum + cell.stat.minutes, 0);

  if (total.minutes === 0) {
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

  const handleExport = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      const path = await exportStatsImage(focusByDay, range);
      setExportNote(
        path ? `图片已保存到 ${path}` : isTauri() ? "已取消导出" : "已在新标签页打开生成的图片",
      );
    } catch (err) {
      setExportNote(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const dense = bars.length > 12;
  const labelEvery = bars.length >= 28 ? 3 : 1;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">统计范围</span>
          <Segmented options={RANGES} value={range} onChange={setRange} />
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {exportNote ? (
            <p className="min-w-0 max-w-xs truncate text-[11px] text-muted">{exportNote}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageDown size={14} />
            {exporting ? "生成中…" : "导出图片"}
          </button>
        </div>
      </div>

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
          label={RANGE_METRIC[range]}
          value={rangeMinutes}
          unit="分钟"
          hint={`${activeBuckets} ${unit}有专注 · ${rangeCount} 个番茄`}
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

      <Card className="fd-pop p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Target size={16} className="text-brand" />
            专注目标
          </div>
          <p className="text-[11px] text-muted">可在「设置 → 专注目标」调整</p>
        </div>
        <div className="flex flex-col gap-4">
          {[
            { label: "今日", progress: todayGoal },
            { label: "本周", progress: weekGoal },
          ].map(({ label, progress }) => (
            <div key={label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-ink">{label}</span>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    progress.done ? "font-semibold text-brand" : "text-muted",
                  )}
                >
                  {progress.goal > 0
                    ? `${progress.minutes} / ${progress.goal} 分钟 · ${progress.percent}%`
                    : "未设定目标"}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    progress.done ? "bg-brand" : "bg-brand/55",
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="fd-pop p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{RANGE_CHART_TITLE[range]}</h2>
            <p className="mt-0.5 text-xs text-muted">
              共 {humanizeMinutes(rangeMinutes)}，{isYear ? "单月" : "单日"}最高{" "}
              {humanizeMinutes(barPeak)}
            </p>
          </div>
          <p className="text-[11px] text-muted">单位：分钟</p>
        </div>

        <div className={cn("flex items-end", dense ? "gap-1" : "gap-2 sm:gap-3")}>
          {bars.map((bar, index) => {
            const ratio = barPeak > 0 ? bar.minutes / barPeak : 0;
            const isBest = barPeak > 0 && bar.minutes === barPeak;
            const title = isYear
              ? `${bar.label} · ${bar.minutes} 分钟 · ${bar.count} 个番茄`
              : `${bar.label} ${bar.sub} · ${bar.minutes} 分钟 · ${bar.count} 个番茄`;
            return (
              <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                {!dense ? (
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      bar.minutes > 0 ? "text-ink" : "text-muted/60",
                    )}
                  >
                    {bar.minutes}
                  </span>
                ) : null}

                <div
                  className={cn(
                    "relative flex h-32 w-full items-end overflow-hidden rounded-lg",
                    "bg-black/[0.045] dark:bg-white/[0.06]",
                    bar.emphasis && "ring-1 ring-brand/30",
                  )}
                  title={title}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-[height] duration-500",
                      bar.emphasis ? "bg-brand" : isBest ? "bg-brand/70" : "bg-brand/45",
                    )}
                    style={{ height: `${ratio * 100}%` }}
                  />
                </div>

                <div className="text-center">
                  {index % labelEvery === 0 ? (
                    <>
                      <p
                        className={cn(
                          "text-[11px] leading-tight whitespace-nowrap",
                          bar.emphasis ? "font-semibold text-brand" : "text-muted",
                        )}
                      >
                        {bar.label}
                      </p>
                      {range === "week" ? (
                        <p className="text-[10px] tabular-nums text-muted/80">{bar.sub}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="fd-pop p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-ink">时间花在哪</h2>
          <p className="mt-0.5 text-xs text-muted">
            番茄钟关联待办后，完成时会把分钟记到任务与标签上
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted">按任务</p>
            {taskFocus.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted">还没有任务专注记录。</p>
            ) : (
              <div className="flex flex-col gap-3">
                {taskFocus.map((task) => (
                  <FocusBar
                    key={task.id}
                    label={task.title}
                    minutes={task.minutes}
                    max={taskFocus[0].minutes}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted">
              按标签（可重复计入）
            </p>
            {tagFocus.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted">还没有带标签的任务专注记录。</p>
            ) : (
              <div className="flex flex-col gap-3">
                {tagFocus.map((tag) => (
                  <FocusBar
                    key={tag.id}
                    label={tag.name}
                    minutes={tag.minutes}
                    max={tagFocus[0].minutes}
                    color={tag.color}
                  />
                ))}
              </div>
            )}
            {untagged > 0 ? (
              <p className="mt-3 text-[11px] text-muted">未打标签的任务共 {humanizeMinutes(untagged)}</p>
            ) : null}
          </div>
        </div>
      </Card>

      {isYear ? (
        <Card className="fd-pop p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {new Date().getFullYear()}年 专注热力图
              </h2>
              <p className="mt-0.5 text-xs text-muted">全年共 {humanizeMinutes(yearTotal)}</p>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="w-max">
              <div className="flex gap-[3px] pb-1">
                {yearCells.map((week, index) => {
                  const first = parseDay(week[0].date);
                  const label = first.getDate() <= 7 ? `${first.getMonth() + 1}月` : "";
                  return (
                    <div key={index} className="w-3.5 shrink-0">
                      <span className="block whitespace-nowrap text-[10px] text-muted">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-[3px]">
                {yearCells.map((week, colIndex) => (
                  <div key={colIndex} className="flex shrink-0 flex-col gap-[3px]">
                    {week.map((cell) => {
                      const level = cell.inMonth
                        ? heatLevel(cell.stat.minutes, yearPeakMinutes)
                        : 0;
                      const isToday = cell.date === todayISO();
                      return (
                        <div
                          key={cell.date}
                          title={`${formatDate(cell.date)} ${weekdayName(cell.date)} · ${cell.stat.minutes} 分钟 · ${cell.stat.count} 个番茄`}
                          className={cn(
                            "h-3.5 w-3.5 rounded-[3px] transition-colors",
                            cell.inMonth ? HEAT_CLASS[level] : "bg-transparent",
                            isToday && "ring-1 ring-brand",
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <HeatLegend />
        </Card>
      ) : (
        <Card className="fd-pop p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {formatMonth(shown.year, shown.month)} 专注热力图
              </h2>
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
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[10px] text-muted">
                  周{label}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {monthCells.map((weekRow, index) => (
                <div key={index} className="grid grid-cols-7 gap-1">
                  {weekRow.map((cell) => {
                    const level = cell.inMonth
                      ? heatLevel(cell.stat.minutes, monthPeakMinutes)
                      : 0;
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

          <HeatLegend />
        </Card>
      )}

      <p className="text-center text-[11px] text-muted">
        专注记录保存在本地，可在「设置 → 数据」中导出备份
      </p>
    </div>
  );
}
