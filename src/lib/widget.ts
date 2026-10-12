import { isTauri } from "./env";

/** Shows / hides the detached desktop widget window (Tauri only). */
export async function setWidgetVisible(visible: boolean): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("toggle_widget", { visible });
  } catch (err) {
    console.warn("[focusday] toggle_widget failed", err);
  }
}

/** Applies the always-on-top preference to the widget window. */
export async function setWidgetAlwaysOnTop(value: boolean): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("set_widget_always_on_top", { value });
  } catch (err) {
    console.warn("[focusday] set_widget_always_on_top failed", err);
  }
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
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("focus_main_window");
  } catch (err) {
    console.warn("[focusday] focus_main_window failed", err);
  }
}
