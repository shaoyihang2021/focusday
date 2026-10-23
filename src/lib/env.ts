/** True when the UI runs inside the Tauri shell (as opposed to a plain browser). */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True when this webview is the detached desktop widget window. */
export const isWidgetWindow = (): boolean =>
  typeof window !== "undefined" && window.location.hash.includes("/widget");

/** Countdown id when this webview is a per-countdown desktop widget. */
export const countdownWidgetId = (): string | null => {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/#\/cd\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};
