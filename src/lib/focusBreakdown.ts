import type { Tag, Todo } from "../types";

export interface TaskFocus {
  id: string;
  title: string;
  minutes: number;
}

export interface TagFocus {
  id: string;
  name: string;
  color: string;
  minutes: number;
}

/** Tasks with recorded focus, biggest first. */
export function taskFocusRanking(todos: Todo[], limit = 5): TaskFocus[] {
  return todos
    .filter((todo) => todo.focusMinutes > 0)
    .sort((a, b) => b.focusMinutes - a.focusMinutes)
    .slice(0, limit)
    .map((todo) => ({ id: todo.id, title: todo.title, minutes: todo.focusMinutes }));
}

/** Per-tag totals; a task with two tags contributes to both. */
export function tagFocusTotals(todos: Todo[], tags: Tag[]): TagFocus[] {
  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      minutes: todos.reduce(
        (sum, todo) => sum + (todo.tags.includes(tag.id) ? todo.focusMinutes : 0),
        0,
      ),
    }))
    .filter((tag) => tag.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** Focus minutes on tasks that carry no tag at all. */
export const untaggedMinutes = (todos: Todo[]): number =>
  todos.reduce((sum, todo) => sum + (todo.tags.length === 0 ? todo.focusMinutes : 0), 0);
