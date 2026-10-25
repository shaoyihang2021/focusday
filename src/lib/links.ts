import { isTauri } from "./env";

/** Where new Windows installers are published. */
export const RELEASES_URL = "https://github.com/shaoyihang2021/focusday/releases";

/** Opens the GitHub Releases page in the system browser. */
export async function openReleasePage(): Promise<void> {
  if (!isTauri()) {
    window.open(RELEASES_URL, "_blank", "noopener,noreferrer");
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("open_release_page");
  } catch (err) {
    console.warn("[focusday] failed to open release page", err);
  }
}
