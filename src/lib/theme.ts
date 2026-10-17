import type { Accent, ThemeMode } from "../types";
import { isTauri } from "./env";

export function resolveDark(mode: ThemeMode): boolean {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return mode === "dark" || (mode === "system" && prefersDark);
}

/**
 * Tells the OS to paint the native window chrome (title bar, caption buttons)
 * in the same scheme as the app, so dark mode stays dark all the way to the top.
 */
async function applyWindowTheme(dark: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTheme(dark ? "dark" : "light");
  } catch (err) {
    console.warn("[focusday] failed to set window theme", err);
  }
}

export function applyTheme(mode: ThemeMode): void {
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle("dark", dark);
  void applyWindowTheme(dark);
  try {
    localStorage.setItem("fd-theme", mode);
  } catch {
    /* ignore */
  }
}

/** Switches the accent scheme by setting `data-accent` on <html>. */
export function applyAccent(accent: Accent): void {
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem("fd-accent", accent);
  } catch {
    /* ignore */
  }
}

/** Re-applies the theme when the OS switches between light and dark. */
export function watchSystemTheme(getMode: () => ThemeMode): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getMode() === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
