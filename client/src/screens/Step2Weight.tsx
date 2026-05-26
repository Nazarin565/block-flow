import { useState } from 'react';
import type { OnboardingHandle } from '../state/onboarding';
import SegmentedControl from '../components/SegmentedControl';
import NumberInput from '../components/NumberInput';
import Button from '../components/Button';
import styles from './WeightScreen.module.css';

const RANGES = {
  lbs: { min: 22, max: 485 },
  kg:  { min: 10, max: 220 },
};

interface Props { onboarding: OnboardingHandle; }

export default function Step2Weight({ onboarding }: Props) {
  const { state, setWeight, next } = onboarding;
  const initialUnit = state.weight?.unit ?? 'lbs';
  const initialValue = state.weight?.value ?? '';

  const [unit, setUnit] = useState<'kg' | 'lbs'>(initialUnit);
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(() => {
    const p = parseFloat(initialValue);
    return p >= RANGES[initialUnit].min && p <= RANGES[initialUnit].max;
  });

  function handleChange(v: string, valid: boolean) {
    setValue(v);
    setIsValid(valid);
    if (valid) setWeight(v, unit);
  }

  function handleUnit(u: string) {
    const next_unit = u as 'kg' | 'lbs';
    setUnit(next_unit);
    setValue('');
    setIsValid(false);
  }

  const range = RANGES[unit];

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>What is your weight?</h1>
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
        hint={`Please enter a value between ${range.min} ${unit} and ${range.max} ${unit}`}
        min={range.min}
        max={range.max}
        aria-label="Weight value"
        placeholder="Weight"
      />
      <div className={styles.footer}>
        <Button onClick={next} disabled={!isValid}>
          Continue
        </Button>
      </div>
    </div>
  );
}
