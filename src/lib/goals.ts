export interface GoalProgress {
  minutes: number;
  goal: number;
  /** 0–100; 0 when no goal has been set. */
  percent: number;
  done: boolean;
}

/** Clamps both sides so negative or fractional input cannot break the UI. */
export function goalProgress(minutes: number, goal: number): GoalProgress {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const safeGoal = Math.max(0, Math.round(goal));
  return {
    minutes: safeMinutes,
    goal: safeGoal,
    percent: safeGoal > 0 ? Math.min(100, Math.round((safeMinutes / safeGoal) * 100)) : 0,
    done: safeGoal > 0 && safeMinutes >= safeGoal,
  };
}
