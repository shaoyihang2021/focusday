import { create } from "zustand";
import type {
  AppState,
  Countdown,
  CountdownCalendar,
  CountdownRepeat,
  CountdownStyle,
  RepeatMode,
  Settings,
  SubStep,
  Tag,
  ThemeMode,
  TimerMode,
  TimerTiming,
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
import { durationFor, initialSeconds, minutesKeyFor } from "../lib/timer";
import { todayISO } from "../lib/date";
import { ensureNotificationPermission, notify, playChime } from "../lib/notify";
import { applyAccent, applyTheme } from "../lib/theme";

export interface NewCountdown {
  title: string;
  date: string;
  color: string;
  note?: string;
  repeat: CountdownRepeat;
  intervalDays?: number;
  style: CountdownStyle;
  subtitleEn?: string;
  calendar?: CountdownCalendar;
  leapMonth?: boolean;
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
  /** Switch between countdown and stopwatch (ignored while running). */
  setTiming: (timing: TimerTiming) => void;
  /** Records a stopwatch round and moves to a short break. */
  finishStopwatch: () => void;
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

/** Writes the current state immediately, bypassing the 300ms debounce. */
export async function flushPersist(): Promise<void> {
  window.clearTimeout(saveHandle);
  await saveState(snapshot(useAppStore.getState()));
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
      focusMinutes: 0,
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
      todos: s.todos.map((t) => {
        if (t.id !== todoId) return t;
        const steps = t.steps.map((step) =>
          step.id === stepId ? { ...step, done: !step.done } : step,
        );
        const stepNowDone = steps.find((step) => step.id === stepId)?.done ?? false;
        const allDone = steps.length > 0 && steps.every((step) => step.done);

        // Checking the last step completes the task; unchecking one reopens it.
        if (allDone) return { ...t, steps, done: true, doneAt: Date.now() };
        if (!stepNowDone && t.done) return { ...t, steps, done: false, doneAt: undefined };
        return { ...t, steps };
      }),
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
      todos: s.todos.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        // A task with a checklist is "done" exactly when every step is done, so
        // toggling either side keeps the two in sync.
        const steps =
          t.steps.length > 0 ? t.steps.map((step) => ({ ...step, done })) : t.steps;
        return { ...t, done, doneAt: done ? Date.now() : undefined, steps };
      }),
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
      pinned: false,
      repeat: input.repeat,
      intervalDays: input.intervalDays,
      style: input.style,
      subtitleEn: input.subtitleEn?.trim() || undefined,
      calendar: input.calendar ?? "solar",
      leapMonth: input.calendar === "lunar" ? input.leapMonth === true : undefined,
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
    // Editing the current phase's length also re-arms the clock, so the new
    // preset shows up immediately instead of leaving a stale paused round.
    // Running rounds keep their own length and pick the new preset next round.
    const key = minutesKeyFor(timer.mode);
    const editedCurrentPreset = patch[key] !== undefined && patch[key] !== settings[key];
    const stopwatchFocus = timer.timing === "stopwatch" && timer.mode === "work";
    const nextTimer =
      editedCurrentPreset && !timer.running && !stopwatchFocus
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
    if (timer.timing === "stopwatch" && timer.mode === "work") {
      const elapsed = Math.max(0, timer.remaining);
      set({
        timer: {
          ...timer,
          running: true,
          endAt: null,
          startedAt: Date.now() - elapsed * 1000,
          remaining: elapsed,
        },
      });
      return;
    }
    const remaining = timer.remaining > 0 ? timer.remaining : durationFor(timer.mode, settings);
    set({
      timer: {
        ...timer,
        running: true,
        remaining,
        startedAt: null,
        endAt: Date.now() + remaining * 1000,
      },
    });
  },

  pause: () => {
    const { timer } = get();
    if (!timer.running) return;
    if (timer.timing === "stopwatch" && timer.mode === "work") {
      // Keep fractional seconds so repeated pauses cannot accumulate drift.
      const elapsed = timer.startedAt
        ? Math.max(0, (Date.now() - timer.startedAt) / 1000)
        : Math.max(0, timer.remaining);
      set({
        timer: { ...timer, running: false, endAt: null, startedAt: null, remaining: elapsed },
      });
      return;
    }
    // Keeping the fraction also prevents a pause in the last second from
    // rounding the round down to zero (which would restart the whole preset).
    const remaining = timer.endAt
      ? Math.max(0, (timer.endAt - Date.now()) / 1000)
      : timer.remaining;
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
        startedAt: null,
        remaining: initialSeconds(timer.mode, settings, timer.timing),
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
        startedAt: null,
        remaining: initialSeconds(nextMode, settings, timer.timing),
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
        startedAt: null,
        remaining: initialSeconds(mode, settings, timer.timing),
      },
    });
  },

  setTiming: (timing) => {
    const { timer, settings } = get();
    if (timer.running) return;
    set({
      timer: {
        ...timer,
        timing,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: initialSeconds(timer.mode, settings, timing),
      },
    });
  },

  finishStopwatch: () => {
    const { timer, settings, todos, focusByDay } = get();
    if (timer.timing !== "stopwatch" || timer.mode !== "work") return;
    const seconds =
      timer.running && timer.startedAt
        ? Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000))
        : Math.max(0, timer.remaining);
    const minutes = seconds < 60 ? 0 : Math.round(seconds / 60);
    const activeId = timer.activeTodoId;

    const nextTodos =
      minutes > 0 && activeId
        ? todos.map((t) =>
            t.id === activeId ? { ...t, focusMinutes: t.focusMinutes + minutes } : t,
          )
        : todos;

    let nextFocusByDay = focusByDay;
    if (minutes > 0) {
      const key = todayISO();
      const previous = focusByDay[key] ?? { minutes: 0, count: 0 };
      nextFocusByDay = {
        ...focusByDay,
        [key]: { minutes: previous.minutes + minutes, count: previous.count },
      };
    }

    const nextMode: TimerMode = "short";
    set({
      todos: nextTodos,
      focusByDay: nextFocusByDay,
      timer: {
        ...timer,
        mode: nextMode,
        running: false,
        endAt: null,
        startedAt: null,
        remaining: durationFor(nextMode, settings),
      },
    });

    if (minutes > 0) {
      if (settings.sound) playChime();
      if (settings.notify) {
        void notify(
          `正计时结束 · 已记录 ${minutes} 分钟专注`,
          "起身活动一下，休息也是生产力。",
        );
      }
    }
  },

  completeSession: () => {
    const { timer, settings, todos, focusByDay } = get();
    const finished = timer.mode;
    const every = Math.max(1, settings.longEvery);
    const nextRound = finished === "work" ? timer.round + 1 : timer.round;
    const nextMode: TimerMode =
      finished === "work" ? (nextRound % every === 0 ? "long" : "short") : "work";
    const duration = initialSeconds(nextMode, settings, timer.timing);
    const autoStart =
      settings.autoStart && !(timer.timing === "stopwatch" && nextMode === "work");

    const activeId = timer.activeTodoId;
    const nextTodos =
      finished === "work" && activeId
        ? todos.map((t) =>
            t.id === activeId
              ? { ...t, completed: t.completed + 1, focusMinutes: t.focusMinutes + settings.workMin }
              : t,
          )
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
        startedAt: null,
        remaining: duration,
      },
    });

    // "专注时免打扰" 静默 FocusDay 自身在专注时段发出的提醒（提示音与系统通知）；
    // 休息结束的提醒不属于专注时段，因此不受影响。
    const silent = settings.focusDnd && finished === "work";
    if (settings.sound && !silent) playChime();
    if (settings.notify && !silent) {
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
  }, 250);
  return () => window.clearInterval(id);
}
