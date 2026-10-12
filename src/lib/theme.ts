import type { ThemeMode } from "../types";

export function resolveDark(mode: ThemeMode): boolean {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return mode === "dark" || (mode === "system" && prefersDark);
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", resolveDark(mode));
  try {
    localStorage.setItem("fd-theme", mode);
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
