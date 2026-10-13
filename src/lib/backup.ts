import type { AppState } from "../types";
import { isTauri } from "./env";
import { sanitizeState } from "../store/defaults";
import { todayISO } from "./date";

/**
 * Writes the whole app state to a user-chosen JSON file.
 * Returns the path that was written, or null when the user cancelled.
 */
export async function exportBackup(state: AppState): Promise<string | null> {
  if (!isTauri()) return null;
  const [{ save }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const path = await save({
    title: "导出 FocusDay 备份",
    defaultPath: `focusday-backup-${todayISO()}.json`,
    filters: [{ name: "FocusDay 备份", extensions: ["json"] }],
  });
  if (!path) return null;

  await invoke("write_backup", { path, content: JSON.stringify(state, null, 2) });
  return path;
}

/**
 * Lets the user pick a backup file and returns the parsed, sanitized state.
 * Returns null when the user cancelled.
 */
export async function importBackup(): Promise<AppState | null> {
  if (!isTauri()) return null;
  const [{ open }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const picked = await open({
    title: "导入 FocusDay 备份",
    multiple: false,
    filters: [{ name: "FocusDay 备份", extensions: ["json"] }],
  });
  if (!picked || typeof picked !== "string") return null;

  const content = await invoke<string>("read_backup", { path: picked });
  return sanitizeState(JSON.parse(content));
}
