import type { PresetId, Settings, TimerPresetValues } from "../types";

export interface TimerPreset {
  id: PresetId;
  label: string;
  /** Factory numbers, used on a fresh install and as a sanitiser fallback. */
  defaults: TimerPresetValues;
}

/** Three ready-made rhythms. Their numbers can be tweaked and are remembered. */
export const TIMER_PRESETS: TimerPreset[] = [
  { id: "classic", label: "经典", defaults: { workMin: 25, shortMin: 5, longMin: 15 } },
  { id: "deep", label: "深度", defaults: { workMin: 50, shortMin: 10, longMin: 20 } },
  { id: "sprint", label: "冲刺", defaults: { workMin: 15, shortMin: 3, longMin: 10 } },
];

/** Fresh-install numbers for every preset. */
export const defaultPresetValues = TIMER_PRESETS.reduce(
  (acc, preset) => ({ ...acc, [preset.id]: preset.defaults }),
  {} as Record<PresetId, TimerPresetValues>,
);

/** `25 / 5 / 15` shown on the preset chip. */
export const presetHint = (values: TimerPresetValues): string =>
  `${values.workMin} / ${values.shortMin} / ${values.longMin}`;

/** The preset whose remembered numbers match the current lengths. */
export function activePresetId(settings: Settings): PresetId | null {
  return (
    TIMER_PRESETS.find((preset) => {
      const values = settings.presetValues[preset.id];
      return (
        values.workMin === settings.workMin &&
        values.shortMin === settings.shortMin &&
        values.longMin === settings.longMin
      );
    })?.id ?? null
  );
}

/** Numbers applied when a preset chip is clicked. */
export const presetPatch = (settings: Settings, id: PresetId): TimerPresetValues =>
  settings.presetValues[id];

/**
 * Stores the tweaked numbers back into the active preset, so switching to
 * another preset and back restores them instead of the factory values.
 */
export function rememberPresetEdit(
  values: Record<PresetId, TimerPresetValues>,
  activeId: PresetId | null,
  next: TimerPresetValues,
): Record<PresetId, TimerPresetValues> {
  return activeId ? { ...values, [activeId]: next } : values;
}
