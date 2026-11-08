import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

export function Card({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  /** Inline overrides for cards that need a fixed look (e.g. the poster skin). */
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card backdrop-blur-xl",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

interface IconButtonProps {
  className?: string;
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}

export function IconButton({ className, active, title, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors",
        active
          ? "border-transparent bg-brand text-white"
          : "border-line bg-card text-muted hover:bg-solid hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand" : "bg-black/15 dark:bg-white/20",
          disabled && "cursor-not-allowed opacity-45",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** `danger` paints the confirm button red for destructive actions. */
  tone?: "brand" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app modal used instead of `window.confirm`, so prompts follow the app's
 * theme instead of the OS dialog. Rendered through a portal because ancestors
 * with `backdrop-blur` would otherwise trap a fixed overlay.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  tone = "brand",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fd-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fd-confirm-title"
        className="fd-pop w-full max-w-sm rounded-2xl border border-line bg-solid p-5 shadow-2xl"
      >
        <p id="fd-confirm-title" className="text-sm font-semibold text-ink">
          {title}
        </p>
        {description ? (
          <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-solid"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90",
              tone === "danger" ? "bg-rose-500" : "fd-primary",
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-solid text-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export function Stepper({ value, min, max, step = 1, suffix, onChange }: StepperProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const [draft, setDraft] = useState(String(value));

  // Keep the field in sync when +/- or an external settings change moves the value.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? value : Number(trimmed);
    const next = clamp(Number.isFinite(parsed) ? Math.round(parsed) : value);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
      >
        −
      </button>
      <span className="flex items-baseline">
        <input
          type="text"
          inputMode="numeric"
          aria-label={suffix ? `输入${suffix}` : "输入数值"}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(String(value));
              e.currentTarget.blur();
            }
          }}
          className="w-14 rounded-lg border border-transparent bg-transparent px-1 py-1 text-center text-sm font-semibold tabular-nums text-ink outline-none transition-colors hover:border-line focus:border-brand focus:bg-solid"
        />
        {suffix ? <span className="text-xs font-normal text-muted">{suffix}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
      >
        +
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-xs text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
