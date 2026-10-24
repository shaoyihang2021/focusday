import { useAppStore } from "../store/useAppStore";
import { displaySeconds, formatClock, modeLabel, timerProgress } from "./timer";
import { todayStat } from "./stats";
import { setTrayProgress, updateTrayTooltip } from "./widget";

const accentColor = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue("--fd-brand").trim() || "#f74a2c";

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
    const seconds = displaySeconds(timer, Date.now());
    const progress = timerProgress(timer, settings, Date.now());
    const color = accentColor();
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
