import type { CSSProperties, ReactNode } from "react";
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
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
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
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand" : "bg-black/15 dark:bg-white/20",
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
    <div className={cn("inline-flex gap-1 rounded-xl border border-line bg-card p-1", className)}>
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
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-ink"
      >
        −
      </button>
      <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-ink">
        {value}
        {suffix ? <span className="ml-0.5 text-xs font-normal text-muted">{suffix}</span> : null}
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
