import type { FocusByDay } from "../types";
import { isTauri } from "./env";
import { formatDate, formatMonth, parseDay, todayISO } from "./date";
import {
  RANGE_CHART_TITLE,
  RANGE_LABEL,
  WEEKDAY_LABELS,
  heatLevel,
  lastDays,
  monthGrid,
  monthPeak,
  rangeBars,
  streakDays,
  sumDates,
  yearGrid,
  type StatsRange,
} from "./stats";

/**
 * Renders a shareable stats card with the Canvas API instead of pulling in a
 * DOM-to-image library: the drawing is fully deterministic, Chinese text uses
 * the system font and Tailwind's modern colour functions never have to be
 * serialised. All colours are read from the live theme tokens so the exported
 * PNG matches the app (including dark mode and the selected accent).
 */

export type ExportRange = StatsRange;

const CARD_W = 1200;
/** Render at 2x so the PNG stays sharp on HiDPI screens and when zoomed. */
const SCALE = 2;
const PAD = 72;
const FONT = '"PingFang SC","Microsoft YaHei",ui-sans-serif,system-ui,sans-serif';
const HEAT_ALPHA = [0, 0.25, 0.45, 0.7, 1];

interface Tokens {
  canvas: string;
  card: string;
  line: string;
  ink: string;
  muted: string;
  brand: string;
}

function readTokens(): Tokens {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    canvas: read("--fd-canvas", "#eef1f7"),
    card: read("--fd-card", "rgba(255,255,255,0.74)"),
    line: read("--fd-line", "rgba(15,23,42,0.09)"),
    ink: read("--fd-ink", "#0f172a"),
    muted: read("--fd-muted", "#64748b"),
    brand: read("--fd-brand", "#f74a2c"),
  };
}

/** `#rrggbb` + alpha -> `rgba(...)`. Falls back to the input when not a hex. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

const text = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
): void => {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
  ctx.textAlign = "left";
};

/** Draws the whole card and resolves with a PNG blob. */
export async function buildStatsCard(
  focusByDay: FocusByDay,
  range: ExportRange = "week",
): Promise<Blob> {
  const t = readTokens();
  const today = todayISO();
  const year = new Date().getFullYear();

  const bars = rangeBars(focusByDay, range);
  const barPeak = Math.max(0, ...bars.map((bar) => bar.minutes));

  // Heatmap: a calendar month for week/month ranges, a whole-year grid for year.
  const monthCells = range === "year" ? [] : monthGrid(focusByDay, new Date().getFullYear(), new Date().getMonth() + 1);
  const yearCells = range === "year" ? yearGrid(focusByDay, year) : [];
  const gridPeak =
    range === "year"
      ? Math.max(0, ...yearCells.flat().filter((c) => c.inMonth).map((c) => c.stat.minutes))
      : monthPeak(monthCells);

  // ---- range metrics ------------------------------------------------------
  const rangeDates: string[] =
    range === "year"
      ? Object.keys(focusByDay).filter((date) => date.startsWith(`${year}-`))
      : lastDays(focusByDay, range === "week" ? 7 : 30).map((day) => day.date);
  const rangeStat = sumDates(focusByDay, rangeDates);
  const rangeDays = range === "week" ? 7 : range === "month" ? 30 : 365;
  const average = Math.round(rangeStat.minutes / Math.max(1, rangeDays));

  const startDate = rangeDates.length > 0 ? rangeDates[0] : today;
  const endDate = range === "year" ? `${year}-12-31` : today;
  const periodText =
    range === "year" ? `${year}年` : `${formatDate(startDate)} - ${formatDate(endDate)}`;

  // ---- layout -------------------------------------------------------------
  const HEADER_TOP = 56;
  const METRICS_TOP = 200;
  const METRICS_H = 170;
  const BARS_TOP = METRICS_TOP + METRICS_H + 80;
  const BARS_TITLE_H = 70;
  const CHART_H = 260;
  const HEAT_TOP = BARS_TOP + BARS_TITLE_H + CHART_H + 128;
  const isYearHeat = range === "year";
  const rows = isYearHeat ? 7 : monthCells.length;
  const heatCellH = isYearHeat ? 22 : 76;
  const heatCols = isYearHeat ? yearCells.length : 7;
  const heatGap = isYearHeat ? 3 : 12;
  const HEAT_GRID_TOP = HEAT_TOP + 30;
  const CARD_H = HEAT_GRID_TOP + 20 + rows * (heatCellH + heatGap) + 90;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = t.canvas;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ---- header -------------------------------------------------------------
  fillRound(ctx, PAD, HEADER_TOP, 8, 46, 4, t.brand);
  text(ctx, "FocusDay 专注统计", PAD + 26, HEADER_TOP + 40, `700 50px ${FONT}`, t.ink);
  text(
    ctx,
    `${RANGE_LABEL[range]} · ${periodText}`,
    PAD + 26,
    HEADER_TOP + 84,
    `400 28px ${FONT}`,
    t.muted,
  );

  // ---- metrics ------------------------------------------------------------
  const metrics: [string, string, string][] = [
    ["本段专注", String(rangeStat.minutes), `${rangeStat.count} 个番茄`],
    ["日均专注", String(average), "分钟 / 天"],
    ["连续专注", String(streakDays(focusByDay)), "天"],
    ["累计专注", String(Object.keys(focusByDay).length ? sumDates(focusByDay, Object.keys(focusByDay)).minutes : 0), "分钟（全部）"],
  ];
  const gap = 24;
  const boxW = (CARD_W - PAD * 2 - gap * 3) / 4;
  metrics.forEach(([label, value, hint], index) => {
    const x = PAD + index * (boxW + gap);
    fillRound(ctx, x, METRICS_TOP, boxW, METRICS_H, 24, t.card);
    roundRect(ctx, x, METRICS_TOP, boxW, METRICS_H, 24);
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    text(ctx, label, x + 28, METRICS_TOP + 48, `500 26px ${FONT}`, t.muted);
    text(ctx, value, x + 28, METRICS_TOP + 116, `700 58px ${FONT}`, t.ink);
    text(ctx, hint, x + 28, METRICS_TOP + 148, `400 22px ${FONT}`, t.muted);
  });

  // ---- bars ---------------------------------------------------------------
  text(
    ctx,
    RANGE_CHART_TITLE[range],
    PAD,
    BARS_TOP + 26,
    `600 34px ${FONT}`,
    t.ink,
  );
  text(
    ctx,
    barPeak > 0 ? `最高 ${barPeak} 分钟` : "暂无记录",
    CARD_W - PAD,
    BARS_TOP + 26,
    `400 24px ${FONT}`,
    t.muted,
    "right",
  );

  const chartTop = BARS_TOP + BARS_TITLE_H;
  const barGap = bars.length > 20 ? 6 : bars.length > 10 ? 14 : 26;
  const barW = (CARD_W - PAD * 2 - barGap * (bars.length - 1)) / bars.length;
  const dense = bars.length > 20;

  bars.forEach((bar, index) => {
    const x = PAD + index * (barW + barGap);
    const ratio = barPeak > 0 ? bar.minutes / barPeak : 0;

    fillRound(ctx, x, chartTop, barW, CHART_H, dense ? 6 : 16, t.line);

    const height = ratio * CHART_H;
    if (height > 0) {
      fillRound(
        ctx,
        x,
        chartTop + CHART_H - height,
        barW,
        height,
        dense ? 6 : 16,
        withAlpha(t.brand, bar.emphasis ? 1 : 0.55),
      );
    }

    if (!dense) {
      text(
        ctx,
        String(bar.minutes),
        x + barW / 2,
        chartTop - 14,
        `600 24px ${FONT}`,
        bar.minutes > 0 ? t.ink : t.muted,
        "center",
      );
    }

    // Too many labels crowd each other, so thin them out for 30 day / 12 month.
    const every = bars.length === 30 ? 3 : 1;
    if (index % every === 0) {
      text(
        ctx,
        bar.label,
        x + barW / 2,
        chartTop + CHART_H + (dense ? 34 : 40),
        `500 ${dense ? 20 : 26}px ${FONT}`,
        bar.emphasis ? t.brand : t.muted,
        "center",
      );
      if (!dense && bars.length <= 12) {
        text(
          ctx,
          bar.sub,
          x + barW / 2,
          chartTop + CHART_H + 72,
          `400 22px ${FONT}`,
          t.muted,
          "center",
        );
      }
    }
  });

  // ---- heatmap ------------------------------------------------------------
  text(
    ctx,
    isYearHeat ? `${year}年 专注热力图` : `${formatMonth(new Date().getFullYear(), new Date().getMonth() + 1)} 专注热力图`,
    PAD,
    HEAT_TOP,
    `600 34px ${FONT}`,
    t.ink,
  );

  if (isYearHeat) {
    // Month tick labels above the week columns.
    const cellW = (CARD_W - PAD * 2 - heatGap * (heatCols - 1)) / heatCols;
    yearCells.forEach((week, colIndex) => {
      const first = parseDay(week[0].date);
      if (first.getDate() <= 7) {
        text(
          ctx,
          `${first.getMonth() + 1}月`,
          PAD + colIndex * (cellW + heatGap),
          HEAT_GRID_TOP,
          `400 20px ${FONT}`,
          t.muted,
        );
      }
    });
  } else {
    WEEKDAY_LABELS.forEach((label, index) => {
      const cellW = (CARD_W - PAD * 2 - heatGap * 6) / 7;
      text(
        ctx,
        `周${label}`,
        PAD + index * (cellW + heatGap) + cellW / 2,
        HEAT_GRID_TOP,
        `400 22px ${FONT}`,
        t.muted,
        "center",
      );
    });
  }

  if (isYearHeat) {
    const cellW = (CARD_W - PAD * 2 - heatGap * (heatCols - 1)) / heatCols;
    const y = HEAT_GRID_TOP + 20;
    yearCells.forEach((week, colIndex) => {
      week.forEach((cell, rowIndex) => {
        const x = PAD + colIndex * (cellW + heatGap);
        const cy = y + rowIndex * (heatCellH + heatGap);
        const level = cell.inMonth ? heatLevel(cell.stat.minutes, gridPeak) : 0;
        fillRound(
          ctx,
          x,
          cy,
          cellW,
          heatCellH,
          3,
          !cell.inMonth || level === 0 ? t.line : withAlpha(t.brand, HEAT_ALPHA[level]),
        );
      });
    });
  } else {
    const cellW = (CARD_W - PAD * 2 - heatGap * 6) / 7;
    monthCells.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const x = PAD + colIndex * (cellW + heatGap);
        const y = HEAT_GRID_TOP + 16 + rowIndex * (heatCellH + heatGap);
        const level = cell.inMonth ? heatLevel(cell.stat.minutes, gridPeak) : 0;
        fillRound(
          ctx,
          x,
          y,
          cellW,
          heatCellH,
          14,
          !cell.inMonth || level === 0 ? t.line : withAlpha(t.brand, HEAT_ALPHA[level]),
        );
        text(
          ctx,
          String(parseDay(cell.date).getDate()),
          x + cellW / 2,
          y + heatCellH / 2 + 9,
          `500 24px ${FONT}`,
          !cell.inMonth ? withAlpha("#94a3b8", 0.5) : level >= 3 ? "#ffffff" : t.muted,
          "center",
        );
      });
    });
  }

  // ---- footer -------------------------------------------------------------
  text(
    ctx,
    "FocusDay · 番茄工作法 + 待办清单 + 倒数日",
    CARD_W / 2,
    CARD_H - 56,
    `400 24px ${FONT}`,
    t.muted,
    "center",
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("导出图片失败"));
    }, "image/png");
  });
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });

/**
 * Exports the stats card as a PNG.
 * In the desktop app the user picks a path; in a plain browser the image opens
 * in a new tab so the feature can still be exercised during development.
 */
export async function exportStatsImage(
  focusByDay: FocusByDay,
  range: ExportRange = "week",
): Promise<string | null> {
  const blob = await buildStatsCard(focusByDay, range);

  if (!isTauri()) {
    window.open(URL.createObjectURL(blob), "_blank");
    return null;
  }

  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const suffix = range === "week" ? "7d" : range === "month" ? "30d" : "12m";
  const path = await save({
    title: "导出专注统计图片",
    defaultPath: `focusday-stats-${suffix}-${todayISO()}.png`,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  });
  if (!path) return null;

  await invoke("write_png", { path, base64: await blobToBase64(blob) });
  return path;
}
