import { useAppStore } from "../store/useAppStore";
import { displaySeconds, formatClock, modeLabel, timerProgress } from "./timer";
import { todayStat } from "./stats";
import { setTrayProgress, updateTrayTooltip } from "./widget";

let lastAccentKey = "";
let lastAccentColor = "#007aff";

/** Reads the accent from the theme once per accent / light-dark switch. */
const accentColor = (accent: string, dark: boolean): string => {
  const key = `${accent}|${dark}`;
  if (key === lastAccentKey) return lastAccentColor;
  lastAccentKey = key;
  lastAccentColor =
    getComputedStyle(document.documentElement).getPropertyValue("--fd-brand").trim() || "#007aff";
  return lastAccentColor;
};

/**
 * Mirrors the timer into the system tray.
 *
 * Only the main window runs this, so the tray is updated exactly once per
 * second. The tooltip carries the exact remaining time, while the icon shows
 * a progress ring plus the remaining minutes. The icon is only repainted when
 * the displayed minute (or the timer state) actually changes, so the tray is
 * not redrawn 60 times a minute for no visible difference.
 */
export function startTraySync(): () => void {
  let lastTooltip = "";
  let lastIconKey = "";

  const tick = () => {
    const { timer, settings, focusByDay } = useAppStore.getState();
    const running = settings.trayCountdown && timer.running;
    const now = Date.now();
    const seconds = displaySeconds(timer, now);
    const progress = timerProgress(timer, settings, now);
    const color = accentColor(settings.accent, document.documentElement.classList.contains("dark"));
    const label =
      timer.mode === "work" && timer.timing === "stopwatch" ? "正计时" : modeLabel(timer.mode);
    const today = todayStat(focusByDay);
    const goalText =
      settings.dailyGoalMin > 0
        ? `今日 ${today.minutes}/${settings.dailyGoalMin} 分钟`
        : `今日 ${today.count} 🍅`;

    const tooltip = running
      ? `FocusDay · ${label} ${formatClock(seconds)} · ${goalText}`
      : `FocusDay · ${goalText}`;

    if (tooltip !== lastTooltip) {
      lastTooltip = tooltip;
      void updateTrayTooltip(tooltip);
    }

    // The icon reflects the timer regardless of the tooltip preference.
    const minutes = timer.running ? Math.max(0, Math.ceil(seconds / 60)) : null;
    const iconKey = `${minutes}|${timer.mode}|${color}`;

    if (iconKey !== lastIconKey) {
      lastIconKey = iconKey;
      void setTrayProgress(minutes, progress, color);
    }
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
