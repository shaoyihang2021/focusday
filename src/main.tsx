import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WidgetApp from "./components/WidgetApp";
import { initStore, startEngine, useAppStore } from "./store/useAppStore";
import { widgetScale } from "./store/defaults";
import { ensureNotificationPermission } from "./lib/notify";
import { watchSystemTheme } from "./lib/theme";
import { applyWidgetWindowSettings, registerCloseBehaviour, setAutoLaunch, setGlobalShortcut } from "./lib/widget";
import { startTrayTooltipSync } from "./lib/trayTooltip";
import { syncNoise } from "./lib/noise";
import { isWidgetWindow } from "./lib/env";
import "./index.css";

const widget = isWidgetWindow();

async function bootstrap(): Promise<void> {
  await initStore();

  watchSystemTheme(() => useAppStore.getState().settings.theme);

  if (!widget) {
    // Only the main window owns session completion (counters, notifications).
    startEngine();
    void ensureNotificationPermission();

    // Push the persisted window / system preferences down to the OS.
    const { settings } = useAppStore.getState();
    void applyWidgetWindowSettings({
      alwaysOnTop: settings.widgetAlwaysOnTop,
      scale: widgetScale[settings.widgetSize],
    });
    void setAutoLaunch(settings.autoLaunch);
    void registerCloseBehaviour(() => useAppStore.getState().settings.closeToTray);
    void setGlobalShortcut(settings.hotkey);
    startTrayTooltipSync();

    // Ambient noise follows the timer. Driving it from a store subscription
    // means a start triggered in the widget window also starts the audio here.
    const syncFromStore = () => {
      const { timer: t, settings: s } = useAppStore.getState();
      syncNoise(t.running, s.noise, s.noiseVolume, s.noiseTone, s.noiseBass);
    };
    syncFromStore();
    useAppStore.subscribe(syncFromStore);
  }

  const container = document.getElementById("root");
  if (!container) return;
  createRoot(container).render(
    <StrictMode>{widget ? <WidgetApp /> : <App />}</StrictMode>,
  );
}

void bootstrap();

