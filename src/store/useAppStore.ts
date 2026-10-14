import { create } from "zustand";
import type {
  AppState,
  Countdown,
  RepeatMode,
  Settings,
  SubStep,
  Tag,
  ThemeMode,
  TimerMode,
  Todo,
} from "../types";
import {
  TAG_COLORS,
  defaultSettings,
  defaultState,
  defaultTags,
  defaultTimer,
  rolloverRepeats,
  sanitizeState,
  uid,
} from "./defaults";
import { broadcastState, loadState, onRemoteState, saveState } from "./persist";
import { durationFor } from "../lib/timer";
import { todayISO } from "../lib/date";
import { ensureNotificationPermission, notify, playChime } from "../lib/notify";
import { applyAccent, applyTheme } from "../lib/theme";

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

  addTodo: (
    title: string,
    estimate: number,
    priority: Todo["priority"],
    tagIds?: string[],
    repeat?: RepeatMode,
  ) => void;
  updateTodo: (id: string, patch: Partial<Omit<Todo, "id">>) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  clearDoneTodos: () => void;
  setActiveTodo: (id: string | null) => void;

  /** Creates a tag, or returns the existing one with the same name. */
  addTag: (name: string) => Tag | null;
  /** Deletes a tag and strips it from every todo. */
  removeTag: (id: string) => void;

  /** Checklist items inside a todo. */
  addStep: (todoId: string, title: string) => void;
  toggleStep: (todoId: string, stepId: string) => void;
  removeStep: (todoId: string, stepId: string) => void;
  /** Moves a step to a new index (drag and drop reordering). */
  moveStep: (todoId: string, from: number, to: number) => void;

  /** Reopens repeating tasks that were completed on an earlier day. */
  rolloverRepeats: () => void;

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
  tags: s.tags,
  countdowns: s.countdowns,
  settings: s.settings,
  timer: s.timer,
  focusByDay: s.focusByDay,
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
      tags: next.tags,
      countdowns: next.countdowns,
      settings: next.settings,
      timer: next.timer,
      focusByDay: next.focusByDay,
    });
    applyTheme(next.settings.theme);
    applyAccent(next.settings.accent);
  },

  addTodo: (title, estimate, priority, tagIds = [], repeat = "none") => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const todo: Todo = {
      id: uid(),
      title: trimmed,
      done: false,
      estimate: Math.max(1, Math.min(12, estimate)),
      completed: 0,
      priority,
      tags: [...tagIds],
      steps: [],
      repeat,
      createdAt: Date.now(),
    };
    set((s) => ({ todos: [todo, ...s.todos] }));
  },

  addTag: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { tags } = get();
    const existing = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const tag: Tag = {
      id: uid(),
      name: trimmed,
      color: TAG_COLORS[tags.length % TAG_COLORS.length],
    };
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  removeTag: (id) =>
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      todos: s.todos.map((todo) =>
        todo.tags.includes(id) ? { ...todo, tags: todo.tags.filter((tagId) => tagId !== id) } : todo,
      ),
    })),

  updateTodo: (id, patch) =>
    set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  addStep: (todoId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const step: SubStep = { id: uid(), title: trimmed, done: false };
    set((s) => ({
      todos: s.todos.map((t) => (t.id === todoId ? { ...t, steps: [...t.steps, step] } : t)),
    }));
  },

  toggleStep: (todoId, stepId) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId
          ? {
              ...t,
              steps: t.steps.map((step) =>
                step.id === stepId ? { ...step, done: !step.done } : step,
              ),
            }
          : t,
      ),
    })),

  removeStep: (todoId, stepId) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId ? { ...t, steps: t.steps.filter((step) => step.id !== stepId) } : t,
      ),
    })),

  moveStep: (todoId, from, to) =>
    set((s) => ({
      todos: s.todos.map((t) => {
        if (t.id !== todoId) return t;
        if (from === to || from < 0 || to < 0 || from >= t.steps.length || to >= t.steps.length) {
          return t;
        }
        const steps = [...t.steps];
        const [moved] = steps.splice(from, 1);
        steps.splice(to, 0, moved);
        return { ...t, steps };
      }),
    })),

  rolloverRepeats: () => {
    const { todos } = get();
    const next = rolloverRepeats(todos);
    if (next.some((todo, i) => todo !== todos[i])) set({ todos: next });
  },

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
    applyAccent(next.accent);
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
    const { timer, settings, todos, focusByDay } = get();
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

    // Record the finished focus session into the daily history (used by stats).
    let nextFocusByDay = focusByDay;
    if (finished === "work") {
      const key = todayISO();
      const previous = focusByDay[key] ?? { minutes: 0, count: 0 };
      nextFocusByDay = {
        ...focusByDay,
        [key]: {
          minutes: previous.minutes + settings.workMin,
          count: previous.count + 1,
        },
      };
    }

    set({
      todos: nextTodos,
      focusByDay: nextFocusByDay,
      timer: {
        ...timer,
        mode: nextMode,
        round: finished === "work" ? nextRound % every : timer.round,
        running: autoStart,
        endAt: autoStart ? Date.now() + duration * 1000 : null,
        remaining: duration,
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
    set({
      ...defaultState,
      tags: [...defaultTags],
      settings: { ...defaultSettings },
      timer: { ...defaultTimer },
      focusByDay: {},
    });
    applyTheme(defaultSettings.theme);
    applyAccent(defaultSettings.accent);
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
  let lastDay = todayISO();

  const id = window.setInterval(() => {
    const { timer, completeSession, rolloverRepeats } = useAppStore.getState();
    if (timer.running && timer.endAt && Date.now() >= timer.endAt) completeSession();

    // Reopen daily repeating tasks when the app is left running overnight.
    const day = todayISO();
    if (day !== lastDay) {
      lastDay = day;
      rolloverRepeats();
    }
  }, 500);
  return () => window.clearInterval(id);
}
