import { isTauri } from "./env";

/** Where new Windows / Android builds are published. */
export const RELEASES_URL = "https://github.com/shaoyihang2021/focusday/releases";

/**
 * Opens the GitHub Releases page in the system browser.
 *
 * Uses the cross-platform opener plugin so the link also works on Android,
 * where the old shell-based Windows command does not exist.
 */
export async function openReleasePage(): Promise<void> {
  if (!isTauri()) {
    window.open(RELEASES_URL, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(RELEASES_URL);
  } catch (err) {
    console.warn("[focusday] failed to open release page", err);
  }
}
