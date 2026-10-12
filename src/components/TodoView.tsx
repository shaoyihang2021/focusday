import { useMemo, useState } from "react";
import { Check, Flag, ListTodo, Plus, Target, Trash2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Card, EmptyState, Segmented } from "./ui";
import { cn } from "../lib/cn";
import type { Todo } from "../types";

type Filter = "all" | "open" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "进行中" },
  { value: "all", label: "全部" },
  { value: "done", label: "已完成" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "0", label: "低" },
  { value: "1", label: "中" },
  { value: "2", label: "高" },
];

const priorityTone = (p: Todo["priority"]) =>
  p === 2
    ? "text-rose-500 bg-rose-500/10"
    : p === 1
      ? "text-amber-500 bg-amber-500/10"
      : "text-slate-400 bg-slate-400/10";

export default function TodoView() {
  const todos = useAppStore((s) => s.todos);
  const activeId = useAppStore((s) => s.timer.activeTodoId);
  const addTodo = useAppStore((s) => s.addTodo);
  const toggleTodo = useAppStore((s) => s.toggleTodo);
  const removeTodo = useAppStore((s) => s.removeTodo);
  const clearDoneTodos = useAppStore((s) => s.clearDoneTodos);
  const setActiveTodo = useAppStore((s) => s.setActiveTodo);

  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState(1);
  const [priority, setPriority] = useState("1");
  const [filter, setFilter] = useState<Filter>("open");

  const visible = useMemo(() => {
    const list = todos.filter((t) =>
      filter === "all" ? true : filter === "done" ? t.done : !t.done,
    );
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt - a.createdAt;
    });
  }, [todos, filter]);

  const doneCount = todos.filter((t) => t.done).length;
  const openCount = todos.length - doneCount;

  const submit = () => {
    if (!title.trim()) return;
    addTodo(title, estimate, Number(priority) as Todo["priority"]);
    setTitle("");
    setEstimate(1);
    setPriority("1");
    setFilter((f) => (f === "done" ? "open" : f));
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Card className="fd-pop p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="要做点什么？回车快速添加"
              className="w-full rounded-xl border border-line bg-solid px-4 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-card px-2 py-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEstimate(n)}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg text-xs font-semibold transition-colors",
                    estimate === n ? "bg-brand text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="px-1 text-[11px] text-muted">🍅</span>
            </div>
            <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
            <button
              type="button"
              onClick={submit}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#ff7a5c] to-[#e23213] px-4 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Plus size={16} /> 添加
            </button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <p className="text-xs text-muted">
          {openCount} 项待办 · {doneCount} 项完成
          {doneCount > 0 ? (
            <button
              type="button"
              onClick={clearDoneTodos}
              className="ml-3 text-muted underline decoration-dotted underline-offset-2 hover:text-brand"
            >
              清除已完成
            </button>
          ) : null}
        </p>
      </div>

      <Card className="fd-pop divide-y divide-line overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ListTodo size={24} />}
            title={filter === "done" ? "还没有完成的任务" : "这里空空如也"}
            hint="添加一个任务，然后回到番茄钟开始专注。完成的番茄会累积在任务上。"
          />
        ) : (
          visible.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <button
                type="button"
                onClick={() => toggleTodo(todo.id)}
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all",
                  todo.done
                    ? "border-transparent bg-brand text-white"
                    : "border-black/20 text-transparent hover:border-brand dark:border-white/25",
                )}
              >
                <Check size={12} strokeWidth={3} />
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    todo.done ? "text-muted line-through" : "text-ink",
                  )}
                >
                  {todo.title}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                      priorityTone(todo.priority),
                    )}
                  >
                    <Flag size={10} />
                    {todo.priority === 2 ? "高" : todo.priority === 1 ? "中" : "低"}
                  </span>
                  <span className="tabular-nums">
                    {todo.completed}/{todo.estimate} 🍅
                  </span>
                  {activeId === todo.id && !todo.done ? (
                    <span className="font-medium text-brand">专注中</span>
                  ) : null}
                </p>
              </div>

              {!todo.done ? (
                <button
                  type="button"
                  onClick={() => setActiveTodo(activeId === todo.id ? null : todo.id)}
                  title="设为当前专注任务"
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg border transition-colors",
                    activeId === todo.id
                      ? "border-transparent bg-brand text-white"
                      : "border-line text-muted opacity-0 group-hover:opacity-100 hover:text-brand",
                  )}
                >
                  <Target size={15} />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => removeTodo(todo.id)}
                title="删除"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
