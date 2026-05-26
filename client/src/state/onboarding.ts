import { useState } from 'react';

type WishId = string;
type WeightUnit = 'kg' | 'lbs';

interface OnboardingState {
  step: 1 | 2 | 3 | 4;
  wish: WishId | null;
  weight: { value: string; unit: WeightUnit } | null;
  goal: { value: string; unit: WeightUnit } | null;
}

const INITIAL_STATE: OnboardingState = {
  step: 1,
  wish: null,
  weight: null,
  goal: null,
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  function setWish(wish: WishId) {
    setState(s => ({ ...s, wish }));
  }

  function setWeight(value: string, unit: WeightUnit) {
    setState(s => ({ ...s, weight: { value, unit } }));
  }

  function setGoal(value: string, unit: WeightUnit) {
    setState(s => ({ ...s, goal: { value, unit } }));
  }

  // Callers are responsible for guarding (e.g. disabling the button at step 4 / step 1)
  function next() {
    setState(s => ({ ...s, step: Math.min(s.step + 1, 4) as OnboardingState['step'] }));
  }

  function back() {
    setState(s => ({ ...s, step: Math.max(s.step - 1, 1) as OnboardingState['step'] }));
  }

  function reset() {
    setState(INITIAL_STATE);
  }

  return { state, setWish, setWeight, setGoal, next, back, reset };
}

export type OnboardingHandle = ReturnType<typeof useOnboarding>;
