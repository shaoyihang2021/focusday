import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  GripVertical,
  ListChecks,
  ListTodo,
  Plus,
  Repeat,
  Tag as TagIcon,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Card, EmptyState, Segmented } from "./ui";
import { cn } from "../lib/cn";
import { humanizeMinutes } from "../lib/timer";
import type { RepeatMode, Tag, Todo } from "../types";

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

/** Small coloured label chip used in the list and the filter row. */
function TagChip({
  tag,
  active,
  onClick,
  onRemove,
  compact,
}: {
  tag: Tag;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "group/chip inline-flex items-center gap-1 rounded-full border transition-colors",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        active ? "border-transparent" : "border-line",
      )}
      style={
        active
          ? { backgroundColor: `${tag.color}22`, borderColor: `${tag.color}66` }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        title={onClick ? "按此标签筛选" : undefined}
        className={cn("inline-flex items-center gap-1", onClick && "cursor-pointer")}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
        <span className={cn("font-medium", active ? "text-ink" : "text-muted")}>{tag.name}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          title="删除标签"
          className="text-muted opacity-0 transition-opacity group-hover/chip:opacity-100 hover:text-rose-500"
        >
          <X size={compact ? 10 : 11} />
        </button>
      ) : null}
    </span>
  );
}

export default function TodoView() {
  const todos = useAppStore((s) => s.todos);
  const tags = useAppStore((s) => s.tags);
  const activeId = useAppStore((s) => s.timer.activeTodoId);
  const addTodo = useAppStore((s) => s.addTodo);
  const toggleTodo = useAppStore((s) => s.toggleTodo);
  const removeTodo = useAppStore((s) => s.removeTodo);
  const clearDoneTodos = useAppStore((s) => s.clearDoneTodos);
  const setActiveTodo = useAppStore((s) => s.setActiveTodo);
  const addTag = useAppStore((s) => s.addTag);
  const removeTag = useAppStore((s) => s.removeTag);
  const addStep = useAppStore((s) => s.addStep);
  const toggleStep = useAppStore((s) => s.toggleStep);
  const removeStep = useAppStore((s) => s.removeStep);
  const moveStep = useAppStore((s) => s.moveStep);

  const [title, setTitle] = useState("");
  const [estimate, setEstimate] = useState(1);
  const [priority, setPriority] = useState("1");
  const [filter, setFilter] = useState<Filter>("open");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [repeat, setRepeat] = useState<RepeatMode>("none");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState<Record<string, string>>({});
  const [dragStep, setDragStep] = useState<{ todoId: string; index: number } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const endStepDrag = () => {
    setDragStep(null);
    setDropIndex(null);
  };

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const visible = useMemo(() => {
    const list = todos.filter((t) => {
      const matchesStatus =
        filter === "all" ? true : filter === "done" ? t.done : !t.done;
      const matchesTag =
        tagFilter.length === 0 || t.tags.some((id) => tagFilter.includes(id));
      return matchesStatus && matchesTag;
    });
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt - a.createdAt;
    });
  }, [todos, filter, tagFilter]);

  const doneCount = todos.filter((t) => t.done).length;
  const openCount = todos.length - doneCount;

  const toggleDraftTag = (id: string) =>
    setDraftTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleTagFilter = (id: string) =>
    setTagFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!title.trim()) return;
    addTodo(title, estimate, Number(priority) as Todo["priority"], draftTags, repeat);
    setTitle("");
    setEstimate(1);
    setPriority("1");
    setDraftTags([]);
    setRepeat("none");
    setFilter((f) => (f === "done" ? "open" : f));
  };

  const submitTag = () => {
    const created = addTag(newTag);
    if (created) setDraftTags((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
    setNewTag("");
  };

  const confirmRemoveTag = (tag: Tag) => {
    if (!window.confirm(`删除标签「${tag.name}」？它会同时从所有任务上移除。`)) return;
    removeTag(tag.id);
    setDraftTags((prev) => prev.filter((id) => id !== tag.id));
    setTagFilter((prev) => prev.filter((id) => id !== tag.id));
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
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setRepeat((r) => (r === "daily" ? "none" : "daily"))}
              title={repeat === "daily" ? "每日重复：已开启（完成后次日自动重置）" : "设为每日重复"}
              aria-pressed={repeat === "daily"}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors",
                repeat === "daily"
                  ? "border-transparent bg-brand text-white"
                  : "border-line bg-card text-muted hover:text-ink",
              )}
            >
              <Repeat size={16} />
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!title.trim()}
              className="fd-primary flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-lg shadow-brand/25 transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
            >
              <Plus size={16} /> 添加
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
            <TagIcon size={12} />
            标签
          </span>
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              active={draftTags.includes(tag.id)}
              onClick={() => toggleDraftTag(tag.id)}
              onRemove={() => confirmRemoveTag(tag)}
            />
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitTag();
              }
            }}
            onBlur={() => newTag.trim() && submitTag()}
            placeholder="+ 新建标签"
            className="w-24 rounded-full border border-dashed border-line bg-transparent px-2 py-1 text-[11px] text-ink outline-none placeholder:text-muted focus:border-brand"
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTagFilter([])}
            className={cn(
              "rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
              tagFilter.length === 0
                ? "border-transparent bg-brand-soft text-brand"
                : "border-line text-muted hover:text-ink",
            )}
          >
            全部标签
          </button>
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              active={tagFilter.includes(tag.id)}
              onClick={() => toggleTagFilter(tag.id)}
            />
          ))}
          {tagFilter.length > 0 ? (
            <span className="text-[11px] text-muted">已按 {tagFilter.length} 个标签筛选</span>
          ) : null}
        </div>
      ) : null}

      <Card className="fd-pop divide-y divide-line overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            icon={<ListTodo size={24} />}
            title={
              tagFilter.length > 0
                ? "这个标签下还没有任务"
                : filter === "done"
                  ? "还没有完成的任务"
                  : "这里空空如也"
            }
            hint="添加一个任务，然后回到番茄钟开始专注。完成的番茄会累积在任务上。"
          />
        ) : (
          visible.map((todo) => {
            const isOpen = expanded.includes(todo.id);
            const doneSteps = todo.steps.filter((step) => step.done).length;
            const totalSteps = todo.steps.length;
            const allStepsDone = totalSteps > 0 && doneSteps === totalSteps;
            return (
              <div key={todo.id} className="group">
                <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(todo.id)}
                    title={totalSteps > 0 ? (isOpen ? "收起子步骤" : "展开子步骤") : "拆分任务为子步骤"}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors",
                      totalSteps > 0
                        ? "text-muted hover:text-brand"
                        : "text-muted opacity-0 group-hover:opacity-100 hover:text-brand",
                    )}
                  >
                    {totalSteps > 0 ? (
                      isOpen ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )
                    ) : (
                      <ListChecks size={14} />
                    )}
                  </button>

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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          priorityTone(todo.priority),
                        )}
                      >
                        <Flag size={10} />
                        {todo.priority === 2 ? "高" : todo.priority === 1 ? "中" : "低"}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted">
                        {todo.completed}/{todo.estimate} 🍅
                      </span>
                      {todo.focusMinutes > 0 ? (
                        <span className="text-[11px] tabular-nums text-muted">
                          · 专注 {humanizeMinutes(todo.focusMinutes)}
                        </span>
                      ) : null}
                      {totalSteps > 0 ? (
                        <span
                          className={cn(
                            "text-[11px] tabular-nums",
                            allStepsDone ? "font-medium text-brand" : "text-muted",
                          )}
                        >
                          {allStepsDone ? "子步骤已完成" : `步骤 ${doneSteps}/${totalSteps}`}
                        </span>
                      ) : null}
                      {todo.repeat === "daily" ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand">
                          <Repeat size={10} />
                          每日
                        </span>
                      ) : null}
                      {activeId === todo.id && !todo.done ? (
                        <span className="text-[11px] font-medium text-brand">专注中</span>
                      ) : null}
                      {todo.tags.map((id) => {
                        const tag = tagById.get(id);
                        if (!tag) return null;
                        return (
                          <TagChip
                            key={id}
                            tag={tag}
                            compact
                            active={tagFilter.includes(id)}
                            onClick={() => toggleTagFilter(id)}
                          />
                        );
                      })}
                    </div>
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

                {isOpen ? (
                  <div className="border-t border-line bg-black/[0.015] py-2.5 pr-4 pl-12 dark:bg-white/[0.02]">
                    {todo.steps.length === 0 ? (
                      <p className="mb-1.5 text-[11px] text-muted">
                        把任务拆成几个小步骤，更容易开始。
                      </p>
                    ) : null}

                    {todo.steps.length > 1 ? (
                      <p className="mb-1 text-[11px] text-muted">拖动左侧手柄可调整顺序</p>
                    ) : null}

                    {todo.steps.map((step, index) => {
                      const isDragging =
                        dragStep?.todoId === todo.id && dragStep.index === index;
                      const isDropTarget =
                        dropIndex === index && dragStep?.todoId === todo.id && !isDragging;
                      return (
                        <div
                          key={step.id}
                          draggable
                          onDragStart={() => setDragStep({ todoId: todo.id, index })}
                          onDragEnd={endStepDrag}
                          onDragOver={(e) => {
                            if (dragStep?.todoId !== todo.id) return;
                            e.preventDefault();
                            setDropIndex(index);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragStep?.todoId === todo.id) {
                              moveStep(todo.id, dragStep.index, index);
                            }
                            endStepDrag();
                          }}
                          className={cn(
                            "group/step flex items-center gap-2.5 rounded-lg py-1 transition-colors",
                            isDragging && "opacity-40",
                            isDropTarget && "bg-brand-soft ring-1 ring-brand/50",
                          )}
                        >
                          <span
                            title="拖动排序"
                            className="cursor-grab text-muted/50 transition-colors group-hover/step:text-muted active:cursor-grabbing"
                          >
                            <GripVertical size={13} />
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleStep(todo.id, step.id)}
                            className={cn(
                              "grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-all",
                              step.done
                                ? "border-transparent bg-brand text-white"
                                : "border-black/20 text-transparent hover:border-brand dark:border-white/25",
                            )}
                          >
                            <Check size={9} strokeWidth={3.5} />
                          </button>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              step.done ? "text-muted line-through" : "text-ink",
                            )}
                          >
                            {step.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStep(todo.id, step.id)}
                            title="删除子步骤"
                            className="grid h-5 w-5 place-items-center rounded text-muted opacity-0 transition-opacity group-hover/step:opacity-100 hover:text-rose-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        value={stepDraft[todo.id] ?? ""}
                        onChange={(e) =>
                          setStepDraft((prev) => ({ ...prev, [todo.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          addStep(todo.id, stepDraft[todo.id] ?? "");
                          setStepDraft((prev) => ({ ...prev, [todo.id]: "" }));
                        }}
                        placeholder="+ 添加子步骤，回车确认"
                        className="w-full max-w-xs rounded-lg border border-dashed border-line bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-muted focus:border-brand"
                      />
                      {totalSteps > 0 ? (
                        <span className="ml-auto text-[11px] tabular-nums text-muted">
                          {doneSteps}/{totalSteps}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
