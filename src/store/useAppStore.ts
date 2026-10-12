import { create } from "zustand";
import type { AppState, Countdown, Settings, ThemeMode, TimerMode, Todo } from "../types";
import { defaultSettings, defaultState, defaultTimer, sanitizeState, todayKey, uid } from "./defaults";
import { broadcastState, loadState, onRemoteState, saveState } from "./persist";
import { durationFor } from "../lib/timer";
import { ensureNotificationPermission, notify, playChime } from "../lib/notify";
import { applyTheme } from "../lib/theme";

export interface NewCountdown {
  title: string;
  date: string;
  color: string;
  note?: string;
  yearly: boolean;
  pinned: boolean;
}

interface Actions {
  /** Replaces the whole data slice (used on boot and on cross-window sync). */
  hydrate: (next: AppState) => void;

  addTodo: (title: string, estimate: number, priority: Todo["priority"]) => void;
  updateTodo: (id: string, patch: Partial<Omit<Todo, "id">>) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  clearDoneTodos: () => void;
  setActiveTodo: (id: string | null) => void;

  addCountdown: (input: NewCountdown) => void;
  updateCountdown: (id: string, patch: Partial<Omit<Countdown, "id">>) => void;
  removeCountdown: (id: string) => void;
  togglePinned: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setTheme: (theme: ThemeMode) => void;

  start: () => void;
  pause: () => void;
  toggleRun: () => void;
  resetTimer: () => void;
  skip: () => void;
  setMode: (mode: TimerMode) => void;
  /** Called by the engine when the countdown reaches zero. */
  completeSession: () => void;

  resetAll: () => void;
}

export type Store = AppState & Actions;

const snapshot = (s: Store): AppState => ({
  todos: s.todos,
  countdowns: s.countdowns,
  settings: s.settings,
  timer: s.timer,
});

let applyingRemote = false;
let saveHandle: number | undefined;

function persist(state: Store): void {
  if (applyingRemote) return;
  const data = snapshot(state);
  void broadcastState(data);
  window.clearTimeout(saveHandle);
  saveHandle = window.setTimeout(() => void saveState(data), 300);
}

export const useAppStore = create<Store>((set, get) => ({
  ...defaultState,

  hydrate: (next) => {
    set({
      todos: next.todos,
      countdowns: next.countdowns,
      settings: next.settings,
      timer: next.timer,
    });
    applyTheme(next.settings.theme);
  },

  addTodo: (title, estimate, priority) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const todo: Todo = {
      id: uid(),
      title: trimmed,
      done: false,
      estimate: Math.max(1, Math.min(12, estimate)),
      completed: 0,
      priority,
      createdAt: Date.now(),
    };
    set((s) => ({ todos: [todo, ...s.todos] }));
  },

  updateTodo: (id, patch) =>
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  toggleTodo: (id) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t,
      ),
      timer:
        s.timer.activeTodoId === id && !s.todos.find((t) => t.id === id)?.done
          ? { ...s.timer, activeTodoId: null }
          : s.timer,
    })),

  removeTodo: (id) =>
    set((s) => ({
      todos: s.todos.filter((t) => t.id !== id),
      timer: s.timer.activeTodoId === id ? { ...s.timer, activeTodoId: null } : s.timer,
    })),

  clearDoneTodos: () => set((s) => ({ todos: s.todos.filter((t) => !t.done) })),

  setActiveTodo: (id) => set((s) => ({ timer: { ...s.timer, activeTodoId: id } })),

  addCountdown: (input) => {
    const trimmed = input.title.trim();
    if (!trimmed || !input.date) return;
    const item: Countdown = {
      id: uid(),
      title: trimmed,
      date: input.date,
      color: input.color,
      note: input.note?.trim() || undefined,
      pinned: input.pinned,
      yearly: input.yearly,
      createdAt: Date.now(),
    };
    set((s) => ({ countdowns: [...s.countdowns, item] }));
  },

  updateCountdown: (id, patch) =>
    set((s) => ({
      countdowns: s.countdowns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  removeCountdown: (id) =>
    set((s) => ({ countdowns: s.countdowns.filter((c) => c.id !== id) })),

  togglePinned: (id) =>
    set((s) => ({
      countdowns: s.countdowns.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
    })),

  updateSettings: (patch) => {
    const { settings, timer } = get();
    const next: Settings = { ...settings, ...patch };
    const durationChanged =
      patch.workMin !== undefined || patch.shortMin !== undefined || patch.longMin !== undefined;
    const nextTimer =
      durationChanged && !timer.running
        ? { ...timer, remaining: durationFor(timer.mode, next) }
        : timer;
    set({ settings: next, timer: nextTimer });
    applyTheme(next.theme);
    if (patch.notify === true) void ensureNotificationPermission();
  },

  setTheme: (theme) => {
    set((s) => ({ settings: { ...s.settings, theme } }));
    applyTheme(theme);
  },

  start: () => {
    const { timer, settings } = get();
    const remaining = timer.remaining > 0 ? timer.remaining : durationFor(timer.mode, settings);
    set({
      timer: { ...timer, running: true, remaining, endAt: Date.now() + remaining * 1000 },
    });
  },

  pause: () => {
    const { timer } = get();
    if (!timer.running || !timer.endAt) return;
    const remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    set({ timer: { ...timer, running: false, endAt: null, remaining } });
  },

  toggleRun: () => (get().timer.running ? get().pause() : get().start()),

  resetTimer: () => {
    const { timer, settings } = get();
    set({
      timer: {
        ...timer,
        running: false,
        endAt: null,
        remaining: durationFor(timer.mode, settings),
      },
    });
  },

  skip: () => {
    const { timer, settings } = get();
    const nextMode: TimerMode = timer.mode === "work" ? "short" : "work";
    set({
      timer: {
        ...timer,
        mode: nextMode,
        running: false,
        endAt: null,
        remaining: durationFor(nextMode, settings),
      },
    });
  },

  setMode: (mode) => {
    const { timer, settings } = get();
    set({
      timer: {
        ...timer,
        mode,
        running: false,
        endAt: null,
        remaining: durationFor(mode, settings),
      },
    });
  },

  completeSession: () => {
    const { timer, settings, todos } = get();
    const finished = timer.mode;
    const every = Math.max(1, settings.longEvery);
    const nextRound = finished === "work" ? timer.round + 1 : timer.round;
    const nextMode: TimerMode =
      finished === "work" ? (nextRound % every === 0 ? "long" : "short") : "work";
    const duration = durationFor(nextMode, settings);
    const autoStart = settings.autoStart;

    const activeId = timer.activeTodoId;
    const nextTodos =
      finished === "work" && activeId
        ? todos.map((t) => (t.id === activeId ? { ...t, completed: t.completed + 1 } : t))
        : todos;

    const key = todayKey();
    const nextToday = finished === "work" ? (timer.todayKey === key ? timer.today + 1 : 1) : timer.today;

    set({
      todos: nextTodos,
      timer: {
        ...timer,
        mode: nextMode,
        round: finished === "work" ? nextRound % every : timer.round,
        running: autoStart,
        endAt: autoStart ? Date.now() + duration * 1000 : null,
        remaining: duration,
        today: nextToday,
        todayKey: key,
      },
    });

    if (settings.sound) playChime();
    if (settings.notify) {
      void notify(
        finished === "work" ? "专注结束 · 收获一颗番茄 🍅" : "休息结束 · 该回来啦 ☕️",
        finished === "work" ? "起身活动一下，休息也是生产力。" : "开始下一轮专注吧。",
      );
    }
  },

  resetAll: () => {
    set({ ...defaultState, settings: { ...defaultSettings }, timer: { ...defaultTimer } });
    applyTheme(defaultSettings.theme);
  },
}));

/** Boots the store: load from disk, wire cross-window sync and persistence. */
export async function initStore(): Promise<void> {
  const loaded = await loadState();
  useAppStore.getState().hydrate(sanitizeState(loaded));

  await onRemoteState((remote) => {
    applyingRemote = true;
    useAppStore.getState().hydrate(sanitizeState(remote));
    applyingRemote = false;
  });

  useAppStore.subscribe((state) => persist(state));
}

/**
 * Runs the timer engine. Only the main window should start it so that a single
 * window owns session completion (notifications, counters).
 */
export function startEngine(): () => void {
  const id = window.setInterval(() => {
    const { timer, completeSession } = useAppStore.getState();
    if (timer.running && timer.endAt && Date.now() >= timer.endAt) completeSession();
  }, 500);
  return () => window.clearInterval(id);
}
