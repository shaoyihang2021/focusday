import type { AppState } from "../types";
import { isTauri } from "../lib/env";

const FILE_NAME = "focusday.store.json";
const KEY = "state";
const EVENT = "fd://state";
const LS_KEY = "fd-state";

type TauriStore = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

let store: TauriStore | null = null;
let storeReady = false;

/** Loads persisted state. Falls back to localStorage outside of Tauri. */
export async function loadState(): Promise<Partial<AppState> | null> {
  if (isTauri()) {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      store = (await load(FILE_NAME, { autoSave: false })) as unknown as TauriStore;
      storeReady = true;
      const data = await store.get<Partial<AppState>>(KEY);
      return data ?? null;
    } catch (err) {
      console.warn("[focusday] tauri store unavailable, falling back to localStorage", err);
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppState>) : null;
  } catch {
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (store && storeReady) {
    try {
      await store.set(KEY, state);
      await store.save();
      return;
    } catch (err) {
      console.warn("[focusday] failed to write to tauri store", err);
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

/** Pushes the new state to every other window (main <-> widget). */
export async function broadcastState(state: AppState): Promise<void> {
  if (!isTauri()) return;
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(EVENT, state);
  } catch (err) {
    console.warn("[focusday] broadcast failed", err);
  }
}

export async function onRemoteState(cb: (state: AppState) => void): Promise<() => void> {
  if (!isTauri()) return () => undefined;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<AppState>(EVENT, (event) => cb(event.payload));
  } catch (err) {
    console.warn("[focusday] listen failed", err);
    return () => undefined;
  }
}
