import { useState } from 'react';
import type { OnboardingHandle } from '../state/onboarding';
import SegmentedControl from '../components/SegmentedControl';
import NumberInput from '../components/NumberInput';
import Button from '../components/Button';
import styles from './WeightScreen.module.css';
import goalStyles from './Step3Goal.module.css';

const RANGES = {
  lbs: { min: 22, max: 485 },
  kg:  { min: 10, max: 220 },
};

interface Props { onboarding: OnboardingHandle; }

export default function Step3Goal({ onboarding }: Props) {
  const { state, setGoal, next } = onboarding;
  const initialUnit = state.goal?.unit ?? state.weight?.unit ?? 'lbs';
  const initialValue = state.goal?.value ?? '';

  const [unit, setUnit] = useState<'kg' | 'lbs'>(initialUnit);
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(() => {
    const p = parseFloat(initialValue);
    return p >= RANGES[initialUnit].min && p <= RANGES[initialUnit].max;
  });

  function handleChange(v: string, valid: boolean) {
    setValue(v);
    setIsValid(valid);
    if (valid) setGoal(v, unit);
  }

  function handleUnit(u: string) {
    const nextUnit = u as 'kg' | 'lbs';
    setUnit(nextUnit);
    setValue('');
    setIsValid(false);
  }

  const range = RANGES[unit];

  // Only show insight card when units match (prevents mixed-unit % calculation)
  const currentWeight = state.weight && state.weight.unit === unit
    ? parseFloat(state.weight.value)
    : null;
  const goalValue = parseFloat(value);
  const showGoalCard = isValid && currentWeight !== null && currentWeight > 0;
  const diffPct = showGoalCard
    ? Math.round(Math.abs(goalValue - currentWeight) / currentWeight * 100)
    : 0;
  const goalDirection = showGoalCard
    ? goalValue < currentWeight ? 'Lose' : goalValue > currentWeight ? 'Gain' : 'Maintain'
    : null;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>
        What is your <em>goal</em> weight?
      </h1>
      <SegmentedControl
        options={['lbs', 'kg']}
        value={unit}
        onChange={handleUnit}
        label="Weight unit"
      />
      <NumberInput
        value={value}
        onChange={handleChange}
        unit={unit}
        hint={`Please enter a value from ${range.min} ${unit} to ${range.max} ${unit}`}
        min={range.min}
        max={range.max}
        aria-label="Goal weight value"
        placeholder="0"
      />
      {showGoalCard && (
        <div className={goalStyles.card}>
          <span className={goalStyles.cardIcon}>⚖️</span>
          <strong className={goalStyles.cardTitle}>
            {goalDirection === 'Maintain'
              ? 'Goal: Maintain your weight'
              : `Goal: ${goalDirection} ${diffPct}% of your weight`}
          </strong>
          <p className={goalStyles.cardText}>
            {goalDirection === 'Gain'
              ? "Building strength takes time and consistency. We'll support you with a plan to help you gain weight healthily and feel stronger."
              : goalDirection === 'Maintain'
              ? "Staying at your current weight is a great goal. We'll help you build habits that keep you balanced and feeling your best."
              : "Even small, steady changes can make a meaningful difference. We'll support you with a balanced plan to help you feel lighter, healthier, and more confident over time."}
          </p>
        </div>
      )}
      <div className={styles.footer}>
        <Button onClick={next} disabled={!isValid}>
          Continue
        </Button>
      </div>
    </div>
  );
}
