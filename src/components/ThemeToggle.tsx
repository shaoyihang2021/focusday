import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../types";
import { cn } from "../lib/cn";

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
  { value: "system", label: "跟随系统", Icon: Monitor },
];

interface Props {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export function ThemeToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line bg-card p-1 backdrop-blur">
      {OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full transition-all duration-200",
            value === v
              ? "bg-solid text-brand shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
