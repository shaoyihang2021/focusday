import { isTauri } from "./env";
import type { Point } from "../types";

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

/** Pushes the live countdown into the tray icon's tooltip. */
export async function updateTrayTooltip(text: string): Promise<void> {
  await invoke("update_tray_tooltip", { text });
}

/**
 * Paints the tray icon with the focus progress.
 * Passing `minutes = null` restores the default application icon.
 */
export async function setTrayProgress(
  minutes: number | null,
  fraction: number,
  color: string,
): Promise<void> {
  await invoke("set_tray_progress", { minutes, fraction, color });
}

/**
 * Registers the global shortcut that toggles the main window.
 * An empty accelerator unregisters it. Returns whether one is active.
 */
export async function setGlobalShortcut(accelerator: string): Promise<boolean> {
  const active = await invoke<boolean>("set_global_shortcut", {
    accelerator: accelerator.trim() === "" ? null : accelerator,
  });
  return active ?? false;
}

/** Fully exits the app, including the tray icon and widget window. */
export async function quitApp(): Promise<void> {
  await invoke("quit_app");
}

/** Moves the widget window back to a saved logical position. */
export async function restoreWidgetPosition(pos: Point): Promise<void> {
  if (!isTauri()) return;
  const [{ getCurrentWindow }, { LogicalPosition }] = await Promise.all([
    import("@tauri-apps/api/window"),
    import("@tauri-apps/api/dpi"),
  ]);
  try {
    await getCurrentWindow().setPosition(new LogicalPosition(pos.x, pos.y));
  } catch (err) {
    console.warn("[focusday] failed to restore widget position", err);
  }
}

/**
 * Subscribes to widget window moves. Positions are reported in logical pixels
 * so they can be restored correctly regardless of the monitor's scale factor.
 */
export async function onWidgetMoved(cb: (pos: Point) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  try {
    const win = getCurrentWindow();
    return await win.onMoved(async ({ payload }) => {
      const factor = await win.scaleFactor();
      cb({ x: Math.round(payload.x / factor), y: Math.round(payload.y / factor) });
    });
  } catch (err) {
    console.warn("[focusday] failed to watch widget moves", err);
    return () => undefined;
  }
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


