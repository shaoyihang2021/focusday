import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useNow } from "../hooks/useNow";
import { countdownInfo, formatDate } from "../lib/date";
import { posterContent, repeatText } from "../lib/countdown";
import { hideSelf, onWidgetMoved, restoreWidgetPosition } from "../lib/widget";
import { cn } from "../lib/cn";

/**
 * Desktop window for one pinned countdown. It reads the same store as the main
 * window (kept in sync through the `fd://state` event), so edits and unpinning
 * are reflected here immediately.
 */
export default function CountdownWidgetApp({ id }: { id: string }) {
  const item = useAppStore((s) => s.countdowns.find((c) => c.id === id));
  const updateCountdown = useAppStore((s) => s.updateCountdown);
  const now = new Date(useNow(60_000));

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.classList.add("fd-widget");
    return () => document.body.classList.remove("fd-widget");
  }, []);

  // Restore the last position once, after the store has hydrated.
  const restored = useRef(false);
  const savedPos = item?.widgetPos;
  useEffect(() => {
    if (restored.current || !savedPos) return;
    restored.current = true;
    void restoreWidgetPosition(savedPos);
  }, [savedPos]);

  useEffect(() => {
    // Only persist once this window knows the event is really pinned. If it
    // loaded a stale state (pinned = false), writing a position back would
    // overwrite the fresh pin and make the main window close it again.
    if (!item?.pinned) return;
    let debounce: number | undefined;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onWidgetMoved((pos) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => updateCountdown(id, { widgetPos: pos }), 400);
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      unlisten?.();
    };
  }, [id, updateCountdown, item?.pinned]);

  if (!item) return null;

  const info = countdownInfo(item, now);
  const { lead, value, unitCn, lines } = posterContent(item, info);
  const dark = item.style === "wandering";
  const dragProps = { "data-tauri-drag-region": "true" } as const;

  const unpin = () => {
    // Unpinning is the single source of truth: the main window sees the flag
    // change and asks Rust to destroy this window.
    updateCountdown(id, { pinned: false });
    void hideSelf();
  };

  return (
    <div className="h-full w-full p-2">
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-2xl border px-3.5 py-2.5",
          dark ? "border-white/10" : "fd-skin-glass",
        )}
        style={dark ? { backgroundColor: "#0b0b0c" } : undefined}
      >
        <div {...dragProps} className="flex h-6 shrink-0 items-center gap-1.5 select-none">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className={cn("text-[10px] font-semibold tracking-wide", dark ? "text-white/55" : "text-muted")}>
            倒数日
          </span>
          <button
            type="button"
            onClick={unpin}
            title="取消钉在桌面"
            className={cn(
              "ml-auto grid h-5 w-5 place-items-center rounded-md transition-colors",
              dark ? "text-white/45 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-solid hover:text-ink",
            )}
          >
            <X size={12} />
          </button>
        </div>

        <p
          {...dragProps}
          className={cn("mt-1 truncate text-sm font-bold", dark ? "text-white" : "text-ink")}
        >
          距{item.title}
        </p>

        <div className="mt-2 flex items-stretch gap-2">
          <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-end gap-x-2">
              <span className={cn("text-[11px] font-semibold", dark ? "text-white/80" : "text-muted")}>
                {lead}
              </span>
              <span
                className="text-4xl leading-none font-black tracking-tight tabular-nums"
                style={{ color: item.color }}
              >
                {value}
              </span>
              <span className={cn("mb-0.5 text-sm font-bold", dark ? "text-white" : "text-ink")}>
                {unitCn}
              </span>
            </div>
            <div
              className={cn(
                "mt-1.5 flex flex-col gap-0.5 text-[9px] leading-tight font-semibold tracking-[0.12em] uppercase",
                dark ? "text-white/80" : "text-muted",
              )}
            >
              {lines.map((line) => (
                <p key={line} className="truncate">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <p className={cn("mt-auto truncate text-[10px]", dark ? "text-white/40" : "text-muted")}>
          {formatDate(info.nextDate)}
          {item.repeat === "none" ? "" : ` · ${repeatText(item)}`}
        </p>
      </div>
    </div>
  );
}
