export type ThemeMode = "light" | "dark" | "system";

export type TimerMode = "work" | "short" | "long";

/** Preset sizes for the detached desktop widget window. */
export type WidgetSize = "small" | "medium" | "large";

/** Accent colour scheme applied across the whole UI. */
export type Accent = "tomato" | "ocean" | "violet" | "forest" | "amber";

/** Logical (DPI independent) screen position. */
export interface Point {
  x: number;
  y: number;
}

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
  /** Lock the widget so it can no longer be dragged by accident. */
  widgetLocked: boolean;
  /** Last known widget position, restored on next launch. */
  widgetPos: Point | null;
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
  /** Pomodoros finished today. */
  today: number;
  /** `YYYY-MM-DD` the `today` counter belongs to. */
  todayKey: string;
}

export interface AppState {
  todos: Todo[];
  countdowns: Countdown[];
  settings: Settings;
  timer: TimerState;
}

export type View = "pomodoro" | "todos" | "countdowns" | "settings";
