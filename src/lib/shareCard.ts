import type { FocusByDay } from "../types";
import { isTauri } from "./env";
import { formatDate, formatMonth, parseDay, todayISO, weekdayName } from "./date";
import { lastDays, monthGrid, monthPeak, streakDays, todayStat, totals } from "./stats";

/**
 * Renders a shareable stats card with the Canvas API instead of pulling in a
 * DOM-to-image library: the drawing is fully deterministic, the Chinese text
 * uses the system font and Tailwind's modern colour functions never have to be
 * serialised. All colours are read from the live theme tokens so the exported
 * PNG matches the app (including dark mode and the selected accent).
 */

const CARD_W = 1200;
const CARD_H = 1560;
const PAD = 72;
const FONT = '"PingFang SC","Microsoft YaHei",ui-sans-serif,system-ui,sans-serif';
const WEEK_HEAD = ["一", "二", "三", "四", "五", "六", "日"];
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
  const radius = Math.min(r, w / 2, h / 2);
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
export async function buildStatsCard(focusByDay: FocusByDay): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  const t = readTokens();
  const today = todayISO();
  const week = lastDays(focusByDay, 7);
  const todayStatValue = todayStat(focusByDay);
  const total = totals(focusByDay);
  const streak = streakDays(focusByDay);
  const weekMinutes = week.reduce((sum, day) => sum + day.stat.minutes, 0);
  const weekCount = week.reduce((sum, day) => sum + day.stat.count, 0);
  const weekPeak = Math.max(...week.map((day) => day.stat.minutes));
  const now = new Date();
  const grid = monthGrid(focusByDay, now.getFullYear(), now.getMonth() + 1);
  const gridPeak = monthPeak(grid);

  ctx.fillStyle = t.canvas;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ---- header -------------------------------------------------------------
  fillRound(ctx, PAD, 56, 8, 46, 4, t.brand);
  text(ctx, "FocusDay 专注统计", PAD + 26, 96, `700 50px ${FONT}`, t.ink);
  text(
    ctx,
    `${formatDate(today)} ${weekdayName(today)}`,
    PAD + 26,
    140,
    `400 28px ${FONT}`,
    t.muted,
  );

  // ---- metrics ------------------------------------------------------------
  const metrics: [string, string, string][] = [
    ["今日专注", String(todayStatValue.minutes), `${todayStatValue.count} 个番茄`],
    ["近 7 天专注", String(weekMinutes), `${weekCount} 个番茄`],
    ["累计专注", String(total.minutes), `共 ${total.count} 个番茄`],
    ["连续专注", String(streak), streak > 0 ? "保持下去" : "从今天开始"],
  ];
  const gap = 24;
  const boxW = (CARD_W - PAD * 2 - gap * 3) / 4;
  metrics.forEach(([label, value, hint], index) => {
    const x = PAD + index * (boxW + gap);
    fillRound(ctx, x, 200, boxW, 170, 24, t.card);
    roundRect(ctx, x, 200, boxW, 170, 24);
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    text(ctx, label, x + 28, 248, `500 26px ${FONT}`, t.muted);
    text(ctx, value, x + 28, 316, `700 62px ${FONT}`, t.ink);
    const valueWidth = ctx.measureText(value).width;
    text(ctx, "分钟", x + 28 + valueWidth + 10, 316, `400 24px ${FONT}`, t.muted);
    text(ctx, hint, x + 28, 348, `400 22px ${FONT}`, t.muted);
  });

  // ---- 7 day bars ---------------------------------------------------------
  const barsTop = 450;
  text(ctx, "近 7 天专注时长", PAD, barsTop + 26, `600 34px ${FONT}`, t.ink);
  text(
    ctx,
    `${weekPeak > 0 ? `单日最高 ${weekPeak} 分钟` : "暂无记录"}`,
    CARD_W - PAD,
    barsTop + 26,
    `400 24px ${FONT}`,
    t.muted,
    "right",
  );

  const chartTop = barsTop + 70;
  const chartH = 260;
  const barGap = 26;
  const barW = (CARD_W - PAD * 2 - barGap * 6) / 7;
  week.forEach((day, index) => {
    const x = PAD + index * (barW + barGap);
    const ratio = weekPeak > 0 ? day.stat.minutes / weekPeak : 0;
    const isToday = day.date === today;

    fillRound(ctx, x, chartTop, barW, chartH, 16, t.line);

    const height = Math.max(0, ratio * chartH);
    if (height > 0) {
      fillRound(ctx, x, chartTop + chartH - height, barW, height, 16, withAlpha(t.brand, isToday ? 1 : 0.55));
    }

    text(
      ctx,
      String(day.stat.minutes),
      x + barW / 2,
      chartTop - 14,
      `600 24px ${FONT}`,
      day.stat.minutes > 0 ? t.ink : t.muted,
      "center",
    );
    text(
      ctx,
      weekdayName(day.date),
      x + barW / 2,
      chartTop + chartH + 40,
      `500 26px ${FONT}`,
      isToday ? t.brand : t.muted,
      "center",
    );
    text(
      ctx,
      `${parseDay(day.date).getMonth() + 1}/${parseDay(day.date).getDate()}`,
      x + barW / 2,
      chartTop + chartH + 72,
      `400 22px ${FONT}`,
      t.muted,
      "center",
    );
  });

  // ---- month heatmap ------------------------------------------------------
  const heatTop = chartTop + chartH + 128;
  text(
    ctx,
    `${formatMonth(now.getFullYear(), now.getMonth() + 1)} 专注热力图`,
    PAD,
    heatTop,
    `600 34px ${FONT}`,
    t.ink,
  );

  const heatGridTop = heatTop + 40;
  const cellGap = 12;
  const cellW = (CARD_W - PAD * 2 - cellGap * 6) / 7;
  const cellH = 76;

  WEEK_HEAD.forEach((label, index) => {
    text(
      ctx,
      `周${label}`,
      PAD + index * (cellW + cellGap) + cellW / 2,
      heatGridTop,
      `400 22px ${FONT}`,
      t.muted,
      "center",
    );
  });

  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = PAD + colIndex * (cellW + cellGap);
      const y = heatGridTop + 16 + rowIndex * (cellH + cellGap);
      const level = cell.inMonth && gridPeak > 0 ? heatLevel(cell.stat.minutes, gridPeak) : 0;

      const bg = !cell.inMonth
        ? t.line
        : level === 0
          ? t.line
          : withAlpha(t.brand, HEAT_ALPHA[level]);
      fillRound(ctx, x, y, cellW, cellH, 14, bg);

      text(
        ctx,
        String(parseDay(cell.date).getDate()),
        x + cellW / 2,
        y + cellH / 2 + 9,
        `500 24px ${FONT}`,
        !cell.inMonth ? withAlpha("#94a3b8", 0.5) : level >= 3 ? "#ffffff" : t.muted,
        "center",
      );
    });
  });

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

function heatLevel(minutes: number, peak: number): number {
  if (minutes <= 0 || peak <= 0) return 0;
  const ratio = minutes / peak;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
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
export async function exportStatsImage(focusByDay: FocusByDay): Promise<string | null> {
  const blob = await buildStatsCard(focusByDay);

  if (!isTauri()) {
    window.open(URL.createObjectURL(blob), "_blank");
    return null;
  }

  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const path = await save({
    title: "导出专注统计图片",
    defaultPath: `focusday-stats-${todayISO()}.png`,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  });
  if (!path) return null;

  await invoke("write_png", { path, base64: await blobToBase64(blob) });
  return path;
}
