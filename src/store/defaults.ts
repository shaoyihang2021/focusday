import type { Accent, AppState, Point, Settings, TimerState, WidgetSize } from "../types";

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
  widgetOpacity: 0.92,
  widgetSize: "medium",
  widgetLocked: false,
  widgetPos: null,
  trayCountdown: true,
  hotkey: "",
  autoLaunch: false,
  closeToTray: true,
  theme: "system",
  accent: "tomato",
};

export const ACCENTS: Accent[] = ["tomato", "ocean", "violet", "forest", "amber"];

/** Multipliers applied to the widget window's base size (324 × 216). */
export const widgetScale: Record<WidgetSize, number> = {
  small: 0.85,
  medium: 1,
  large: 1.25,
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

const asPoint = (value: unknown): Point | null => {
  if (!value || typeof value !== "object") return null;
  const p = value as { x?: unknown; y?: unknown };
  return typeof p.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: p.x, y: p.y }
    : null;
};

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
      widgetOpacity: Math.min(1, Math.max(0.4, asNumber(settings.widgetOpacity, defaultSettings.widgetOpacity))),
      widgetSize:
        settings.widgetSize === "small" ||
        settings.widgetSize === "medium" ||
        settings.widgetSize === "large"
          ? settings.widgetSize
          : defaultSettings.widgetSize,
      autoLaunch: asBool(settings.autoLaunch, defaultSettings.autoLaunch),
      closeToTray: asBool(settings.closeToTray, defaultSettings.closeToTray),
      widgetLocked: asBool(settings.widgetLocked, defaultSettings.widgetLocked),
      widgetPos: asPoint(settings.widgetPos),
      trayCountdown: asBool(settings.trayCountdown, defaultSettings.trayCountdown),
      hotkey: typeof settings.hotkey === "string" ? settings.hotkey : defaultSettings.hotkey,
      accent: ACCENTS.includes(settings.accent as Accent)
        ? (settings.accent as Accent)
        : defaultSettings.accent,
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
