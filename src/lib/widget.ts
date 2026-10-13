import { isTauri } from "./env";

const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!isTauri()) return null;
  const { invoke: call } = await import("@tauri-apps/api/core");
  try {
    return await call<T>(cmd, args);
  } catch (err) {
    console.warn(`[focusday] ${cmd} failed`, err);
    return null;
  }
};

/** Shows / hides the detached desktop widget window (Tauri only). */
export async function setWidgetVisible(visible: boolean): Promise<void> {
  await invoke("toggle_widget", { visible });
}

/** Applies the always-on-top preference to the widget window. */
export async function setWidgetAlwaysOnTop(value: boolean): Promise<void> {
  await invoke("set_widget_always_on_top", { value });
}

/** Resizes the widget window using a scale multiplier of its base size. */
export async function setWidgetSize(scale: number): Promise<void> {
  await invoke("set_widget_size", { scale });
}

/** Applies every widget-window preference at once (used on boot). */
export async function applyWidgetWindowSettings(opts: {
  alwaysOnTop: boolean;
  scale: number;
}): Promise<void> {
  await Promise.all([setWidgetAlwaysOnTop(opts.alwaysOnTop), setWidgetSize(opts.scale)]);
}

/** Registers / removes FocusDay from the OS auto-start list. */
export async function setAutoLaunch(value: boolean): Promise<boolean> {
  const result = await invoke<boolean>("set_auto_launch", { value });
  return result ?? false;
}

/** Hides the current window. Used by the widget's close button. */
export async function hideSelf(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  try {
    await getCurrentWindow().hide();
  } catch (err) {
    console.warn("[focusday] hide failed", err);
  }
}

/** Opens the app's main window and focuses it (used from the widget). */
export async function focusMainWindow(): Promise<void> {
  await invoke("focus_main_window");
}

/** Fully exits the app, including the tray icon and widget window. */
export async function quitApp(): Promise<void> {
  await invoke("quit_app");
}

/**
 * Intercepts the main window's close button.
 * When `closeToTray` is on the window hides into the tray; otherwise the whole
 * app quits — otherwise a hidden widget window would keep the process alive
 * with no visible UI.
 */
export async function registerCloseBehaviour(getCloseToTray: () => boolean): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  try {
    await win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (getCloseToTray()) {
        await win.hide();
      } else {
        await quitApp();
      }
    });
  } catch (err) {
    console.warn("[focusday] onCloseRequested failed", err);
  }
}


