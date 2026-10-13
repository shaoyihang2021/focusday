import { useAppStore } from "../store/useAppStore";
import { computeRemaining, formatClock, modeLabel } from "./timer";
import { updateTrayTooltip } from "./widget";

const IDLE_TOOLTIP = "FocusDay · 番茄待办与倒数日";

/**
 * Mirrors the live countdown into the tray icon's tooltip.
 *
 * Only the main window runs this, so the tooltip is updated exactly once per
 * second. The timer state itself does not change while running (the remaining
 * time is derived from `endAt`), which is why a plain interval is used here
 * instead of subscribing to the store.
 */
export function startTrayTooltipSync(): () => void {
  let last = "";

  const tick = () => {
    const { timer, settings } = useAppStore.getState();
    const text =
      settings.trayCountdown && timer.running
        ? `FocusDay · ${modeLabel(timer.mode)} ${formatClock(
            computeRemaining(timer, Date.now()),
          )} · 今日 ${timer.today} 🍅`
        : IDLE_TOOLTIP;

    if (text === last) return;
    last = text;
    void updateTrayTooltip(text);
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
