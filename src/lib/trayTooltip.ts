import { useAppStore } from "../store/useAppStore";
import { computeRemaining, durationFor, formatClock, modeLabel } from "./timer";
import { todayStat } from "./stats";
import { setTrayProgress, updateTrayTooltip } from "./widget";

const IDLE_TOOLTIP = "FocusDay · 番茄待办与倒数日";

/** Current accent colour, so the tray ring matches the app theme. */
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
    const remaining = computeRemaining(timer, Date.now());
    const total = durationFor(timer.mode, settings);
    const color = accentColor();

    const tooltip = running
      ? `FocusDay · ${modeLabel(timer.mode)} ${formatClock(remaining)} · 今日 ${
          todayStat(focusByDay).count
        } 🍅`
      : IDLE_TOOLTIP;

    if (tooltip !== lastTooltip) {
      lastTooltip = tooltip;
      void updateTrayTooltip(tooltip);
    }

    // The icon reflects the timer regardless of the tooltip preference.
    const minutes = timer.running ? Math.max(0, Math.ceil(remaining / 60)) : null;
    const fraction = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
    const iconKey = `${minutes}|${timer.mode}|${color}`;

    if (iconKey !== lastIconKey) {
      lastIconKey = iconKey;
      void setTrayProgress(minutes, fraction, color);
    }
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
