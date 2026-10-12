import type { AppState, Settings, TimerState } from "../types";

export const THEME_STORAGE_KEY = "fd-theme";

export const todayKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const defaultSettings: Settings = {
  workMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  autoStart: false,
  sound: true,
  notify: true,
  widgetAlwaysOnTop: true,
  theme: "system",
};

export const defaultTimer: TimerState = {
  mode: "work",
  running: false,
  endAt: null,
  remaining: defaultSettings.workMin * 60,
  round: 0,
  activeTodoId: null,
  today: 0,
  todayKey: todayKey(),
};

export const defaultState: AppState = {
  todos: [],
  countdowns: [],
  settings: defaultSettings,
  timer: defaultTimer,
};

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/**
 * Merges whatever we read from disk with the current defaults. This keeps old
 * data files valid after new fields are introduced.
 */
export function sanitizeState(input: unknown): AppState {
  const raw = (input ?? {}) as Partial<AppState>;
  const settings = (raw.settings ?? {}) as Partial<Settings>;
  const timer = (raw.timer ?? {}) as Partial<TimerState>;

  const merged: AppState = {
    todos: Array.isArray(raw.todos) ? raw.todos : [],
    countdowns: Array.isArray(raw.countdowns) ? raw.countdowns : [],
    settings: {
      workMin: asNumber(settings.workMin, defaultSettings.workMin),
      shortMin: asNumber(settings.shortMin, defaultSettings.shortMin),
      longMin: asNumber(settings.longMin, defaultSettings.longMin),
      longEvery: asNumber(settings.longEvery, defaultSettings.longEvery),
      autoStart: asBool(settings.autoStart, defaultSettings.autoStart),
      sound: asBool(settings.sound, defaultSettings.sound),
      notify: asBool(settings.notify, defaultSettings.notify),
      widgetAlwaysOnTop: asBool(settings.widgetAlwaysOnTop, defaultSettings.widgetAlwaysOnTop),
      theme:
        settings.theme === "light" || settings.theme === "dark" || settings.theme === "system"
          ? settings.theme
          : defaultSettings.theme,
    },
    timer: {
      mode:
        timer.mode === "work" || timer.mode === "short" || timer.mode === "long"
          ? timer.mode
          : defaultTimer.mode,
      running: asBool(timer.running, false),
      endAt: typeof timer.endAt === "number" ? timer.endAt : null,
      remaining: asNumber(timer.remaining, defaultTimer.remaining),
      round: asNumber(timer.round, 0),
      activeTodoId: typeof timer.activeTodoId === "string" ? timer.activeTodoId : null,
      today: asNumber(timer.today, 0),
      todayKey: typeof timer.todayKey === "string" ? timer.todayKey : todayKey(),
    },
  };

  // A new day resets the daily counter.
  if (merged.timer.todayKey !== todayKey()) {
    merged.timer.today = 0;
    merged.timer.todayKey = todayKey();
  }
  if (!merged.timer.running) merged.timer.endAt = null;

  return merged;
}

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
