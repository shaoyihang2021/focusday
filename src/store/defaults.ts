import type {
  Accent,
  AppState,
  CountdownRepeat,
  DayStat,
  FocusByDay,
  Point,
  Settings,
  SubStep,
  Tag,
  TimerState,
  Todo,
  WidgetContent,
  WidgetSize,
} from "../types";

export const THEME_STORAGE_KEY = "fd-theme";

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
  widgetSkin: "glass",
  widgetShow: { ring: true, today: true, countdown: true, todo: true },
  widgetLocked: false,
  widgetPos: null,
  noise: "off",
  focusDnd: false,
  noiseVolume: 0.3,
  noiseTone: 0.72,
  noiseBass: 0,
  trayCountdown: true,
  hotkey: "",
  autoLaunch: false,
  closeToTray: true,
  theme: "system",
  accent: "tomato",
};

export const ACCENTS: Accent[] = ["tomato", "ocean", "violet", "forest", "amber"];

export const WIDGET_SKINS = ["glass", "solid", "outline", "ghost"] as const;
export const NOISE_TYPES = ["off", "white", "pink", "brown", "rain", "cafe"] as const;

/** Palette offered when creating a tag, cycled by index. */
export const TAG_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
];

/** Tags available on a fresh install so the feature is immediately usable. */
export const defaultTags: Tag[] = [
  { id: "tag-work", name: "工作", color: "#3b82f6" },
  { id: "tag-study", name: "学习", color: "#8b5cf6" },
  { id: "tag-life", name: "生活", color: "#10b981" },
];

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
};

export const defaultState: AppState = {
  todos: [],
  tags: defaultTags,
  countdowns: [],
  settings: defaultSettings,
  timer: defaultTimer,
  focusByDay: {},
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

const isTag = (value: unknown): value is Tag => {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<Tag>;
  return (
    typeof t.id === "string" &&
    t.id !== "" &&
    typeof t.name === "string" &&
    typeof t.color === "string"
  );
};

const isSubStep = (value: unknown): value is SubStep => {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<SubStep>;
  return typeof s.id === "string" && s.id !== "" && typeof s.title === "string";
};

/** Keeps only well-formed checklist items, defaulting `done` to false. */
function sanitizeSteps(value: unknown): SubStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSubStep).map((step) => ({
    id: step.id,
    title: step.title,
    done: asBool(step.done, false),
  }));
}

function sanitizeWidgetShow(value: unknown): WidgetContent {
  const raw = (value ?? {}) as Partial<WidgetContent>;
  return {
    ring: asBool(raw.ring, defaultSettings.widgetShow.ring),
    today: asBool(raw.today, defaultSettings.widgetShow.today),
    countdown: asBool(raw.countdown, defaultSettings.widgetShow.countdown),
    todo: asBool(raw.todo, defaultSettings.widgetShow.todo),
  };
}

/** Epoch ms of the start of the current local day. */
export const startOfTodayMs = (): number => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Reopens repeating tasks that were finished on an earlier day, so a daily
 * habit shows up fresh again. Its checklist is reset too, keeping the
 * "task done <=> all steps done" invariant intact. Idempotent — safe to run on
 * every load.
 */
export function rolloverRepeats(todos: Todo[]): Todo[] {
  const start = startOfTodayMs();
  return todos.map((todo) =>
    todo.repeat === "daily" &&
    todo.done &&
    typeof todo.doneAt === "number" &&
    todo.doneAt < start
      ? {
          ...todo,
          done: false,
          completed: 0,
          doneAt: undefined,
          steps: todo.steps.map((step) => ({ ...step, done: false })),
        }
      : todo,
  );
}

const COUNTDOWN_REPEATS = ["none", "weekly", "monthly", "yearly", "custom"] as const;
/** Guard rail for the custom recurrence interval. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

/**
 * Reads a countdown's recurrence, migrating the `yearly: boolean` flag used by
 * v0.6 and earlier.
 */
function sanitizeCountdownRepeat(raw: unknown): CountdownRepeat {
  const value = (raw ?? {}) as { repeat?: unknown; yearly?: unknown };
  if (COUNTDOWN_REPEATS.includes(value.repeat as never)) {
    return value.repeat as CountdownRepeat;
  }
  return value.yearly === true ? "yearly" : "none";
}

/** Keeps only well-formed `YYYY-MM-DD` -> { minutes, count } entries. */
function sanitizeFocusByDay(value: unknown): FocusByDay {
  if (!value || typeof value !== "object") return {};
  const out: FocusByDay = {};
  for (const [date, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const stat = (raw ?? {}) as Partial<DayStat>;
    const minutes = asNumber(stat.minutes, 0);
    const count = asNumber(stat.count, 0);
    if (minutes > 0 || count > 0) out[date] = { minutes, count };
  }
  return out;
}

/**
 * Merges whatever we read from disk with the current defaults. This keeps old
 * data files valid after new fields are introduced.
 */
export function sanitizeState(input: unknown): AppState {
  const raw = (input ?? {}) as Partial<AppState>;
  const settings = (raw.settings ?? {}) as Partial<Settings>;
  const timer = (raw.timer ?? {}) as Partial<TimerState>;

  const tags = Array.isArray(raw.tags) ? raw.tags.filter(isTag) : defaultTags;
  const knownTagIds = new Set(tags.map((t) => t.id));

  const todos = rolloverRepeats(
    (Array.isArray(raw.todos) ? raw.todos : []).map((todo) => ({
      ...todo,
      // Drop references to tags the user deleted.
      tags: Array.isArray(todo.tags) ? todo.tags.filter((id) => knownTagIds.has(id)) : [],
      steps: sanitizeSteps(todo.steps),
      repeat: todo.repeat === "daily" ? ("daily" as const) : ("none" as const),
    })),
  );

  const focusByDay = sanitizeFocusByDay(raw.focusByDay);

  // v0.3 and earlier only tracked a per-day counter in the timer state; fold it
  // into the new history so the numbers stay consistent after upgrading.
  const legacyToday = asNumber((timer as { today?: unknown }).today, 0);
  const legacyKey = (timer as { todayKey?: unknown }).todayKey;
  if (legacyToday > 0 && typeof legacyKey === "string" && !focusByDay[legacyKey]) {
    focusByDay[legacyKey] = {
      minutes: legacyToday * asNumber(settings.workMin, defaultSettings.workMin),
      count: legacyToday,
    };
  }

  const merged: AppState = {
    todos,
    tags,
    countdowns: (Array.isArray(raw.countdowns) ? raw.countdowns : []).map((entry) => {
      const repeat = sanitizeCountdownRepeat(entry);
      const intervalDays = Math.round(
        Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, asNumber(entry.intervalDays, 1))),
      );
      return { ...entry, repeat, intervalDays };
    }),
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
      widgetSkin: WIDGET_SKINS.includes(settings.widgetSkin as never)
        ? (settings.widgetSkin as Settings["widgetSkin"])
        : defaultSettings.widgetSkin,
      widgetShow: sanitizeWidgetShow(settings.widgetShow),
      widgetLocked: asBool(settings.widgetLocked, defaultSettings.widgetLocked),
      widgetPos: asPoint(settings.widgetPos),
      noise: NOISE_TYPES.includes(settings.noise as never)
        ? (settings.noise as Settings["noise"])
        : defaultSettings.noise,
      focusDnd: asBool(settings.focusDnd, defaultSettings.focusDnd),
      noiseVolume: Math.min(1, Math.max(0, asNumber(settings.noiseVolume, defaultSettings.noiseVolume))),
      noiseTone: Math.min(1, Math.max(0, asNumber(settings.noiseTone, defaultSettings.noiseTone))),
      noiseBass: Math.min(12, Math.max(-12, asNumber(settings.noiseBass, defaultSettings.noiseBass))),
      trayCountdown: asBool(settings.trayCountdown, defaultSettings.trayCountdown),
      hotkey: typeof settings.hotkey === "string" ? settings.hotkey : defaultSettings.hotkey,
      autoLaunch: asBool(settings.autoLaunch, defaultSettings.autoLaunch),
      closeToTray: asBool(settings.closeToTray, defaultSettings.closeToTray),
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
    },
    focusByDay,
  };

  if (!merged.timer.running) merged.timer.endAt = null;

  return merged;
}

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
