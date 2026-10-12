import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import WidgetApp from "./components/WidgetApp";
import { initStore, startEngine, useAppStore } from "./store/useAppStore";
import { ensureNotificationPermission } from "./lib/notify";
import { watchSystemTheme } from "./lib/theme";
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
  }

  const container = document.getElementById("root");
  if (!container) return;
  createRoot(container).render(
    <StrictMode>{widget ? <WidgetApp /> : <App />}</StrictMode>,
  );
}

void bootstrap();
