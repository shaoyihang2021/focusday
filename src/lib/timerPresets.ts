import type { Settings } from "../types";

export interface TimerPreset {
  id: string;
  label: string;
  /** `25 / 5 / 15` shown under the label. */
  hint: string;
  workMin: number;
  shortMin: number;
  longMin: number;
}

/** Three ready-made rhythms. Applying one only rewrites the three lengths. */
export const TIMER_PRESETS: TimerPreset[] = [
  { id: "classic", label: "经典", hint: "25 / 5 / 15", workMin: 25, shortMin: 5, longMin: 15 },
  { id: "deep", label: "深度", hint: "50 / 10 / 20", workMin: 50, shortMin: 10, longMin: 20 },
  { id: "sprint", label: "冲刺", hint: "15 / 3 / 10", workMin: 15, shortMin: 3, longMin: 10 },
];

/** The preset matching all three current lengths, or null for a custom mix. */
export function activePreset(settings: Settings): TimerPreset | null {
  return (
    TIMER_PRESETS.find(
      (preset) =>
        preset.workMin === settings.workMin &&
        preset.shortMin === settings.shortMin &&
        preset.longMin === settings.longMin,
    ) ?? null
  );
}

/** Patch applied through `updateSettings`. */
export function presetPatch(
  preset: TimerPreset,
): Pick<Settings, "workMin" | "shortMin" | "longMin"> {
  return { workMin: preset.workMin, shortMin: preset.shortMin, longMin: preset.longMin };
}
