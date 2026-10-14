export type ThemeMode = "light" | "dark" | "system";

export type TimerMode = "work" | "short" | "long";

/** Preset sizes for the detached desktop widget window. */
export type WidgetSize = "small" | "medium" | "large";

/** Accent colour scheme applied across the whole UI. */
export type Accent = "tomato" | "ocean" | "violet" | "forest" | "amber";

/** Appearance variants for the detached desktop widget. */
export type WidgetSkin = "glass" | "solid" | "outline" | "ghost";

/** Ambient noise played while the timer runs. */
export type NoiseType = "off" | "white" | "pink" | "brown" | "rain" | "cafe";

/** How often a todo repeats after being completed. */
export type RepeatMode = "none" | "daily";

/** Logical (DPI independent) screen position. */
export interface Point {
  x: number;
  y: number;
}

/** A user defined label that can be attached to todos. */
export interface Tag {
  id: string;
  name: string;
  color: string;
}

/** Focused time recorded for a single calendar day. */
export interface DayStat {
  minutes: number;
  count: number;
}

/** A single checklist item inside a todo, used to break work into steps. */
export interface SubStep {
  id: string;
  title: string;
  done: boolean;
}

/** Which blocks the detached desktop widget renders. */
export interface WidgetContent {
  /** Circular progress ring; when off the clock is shown as plain text. */
  ring: boolean;
  /** Today's finished pomodoro count. */
  today: boolean;
  /** Pinned (or nearest) countdown. */
  countdown: boolean;
  /** The next unfinished todo. */
  todo: boolean;
}

/** `YYYY-MM-DD` -> focused time for that day. */
export type FocusByDay = Record<string, DayStat>;

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  /** Planned number of pomodoros. */
  estimate: number;
  /** Pomodoros actually finished for this task. */
  completed: number;
  /** 0 = low, 1 = normal, 2 = high */
  priority: 0 | 1 | 2;
  /** Ids of the tags attached to this task. */
  tags: string[];
  /** Optional checklist breaking the task into smaller steps. */
  steps: SubStep[];
  /** Whether the task reopens automatically on the next day. */
  repeat: RepeatMode;
  createdAt: number;
  doneAt?: number;
}

export interface Countdown {
  id: string;
  title: string;
  /** Target date, `YYYY-MM-DD`. */
  date: string;
  color: string;
  note?: string;
  /** Pinned events float to the top and are shown on the widget. */
  pinned: boolean;
  /** If true, the event repeats every year (birthdays, anniversaries...). */
  yearly: boolean;
  createdAt: number;
}

export interface Settings {
  workMin: number;
  shortMin: number;
  longMin: number;
  /** Take a long break after every N finished pomodoros. */
  longEvery: number;
  autoStart: boolean;
  sound: boolean;
  notify: boolean;
  widgetAlwaysOnTop: boolean;
  /** Widget panel opacity, 0.4 – 1. */
  widgetOpacity: number;
  widgetSize: WidgetSize;
  /** Widget visual style. */
  widgetSkin: WidgetSkin;
  /** Which blocks the widget renders. */
  widgetShow: WidgetContent;
  /** Lock the widget so it can no longer be dragged by accident. */
  widgetLocked: boolean;
  /** Last known widget position, restored on next launch. */
  widgetPos: Point | null;
  /** Ambient noise played while the timer runs. */
  noise: NoiseType;
  /** Noise volume, 0 – 1. */
  noiseVolume: number;
  /** EQ: low-pass cutoff as 0 (deep, 200Hz) – 1 (bright, 16kHz). */
  noiseTone: number;
  /** EQ: low-shelf gain in dB, -12 – +12. */
  noiseBass: number;
  /** Show the live countdown in the tray tooltip. */
  trayCountdown: boolean;
  /**
   * Global shortcut accelerator used to toggle the main window.
   * An empty string disables the shortcut.
   */
  hotkey: string;
  /** Launch FocusDay automatically when Windows starts. */
  autoLaunch: boolean;
  /** Hide to the system tray instead of quitting when the window is closed. */
  closeToTray: boolean;
  theme: ThemeMode;
  accent: Accent;
}

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** Epoch ms when the current run ends. Only meaningful while running. */
  endAt: number | null;
  /** Seconds left while paused. */
  remaining: number;
  /** Finished work rounds inside the current cycle (0..longEvery). */
  round: number;
  activeTodoId: string | null;
}

export interface AppState {
  todos: Todo[];
  tags: Tag[];
  countdowns: Countdown[];
  settings: Settings;
  timer: TimerState;
  /** Focus history used by the stats view. */
  focusByDay: FocusByDay;
}

export type View = "pomodoro" | "todos" | "countdowns" | "stats" | "settings";
