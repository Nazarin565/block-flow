import { useId } from 'react';
import styles from './NumberInput.module.css';

interface NumberInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  unit: string;
  hint: string;
  min: number;
  max: number;
  'aria-label': string;
  placeholder?: string;
}

export default function NumberInput({
  value,
  onChange,
  unit,
  hint,
  min,
  max,
  'aria-label': ariaLabel,
  placeholder = '0',
}: NumberInputProps) {
  const hintId = useId();
  const parsed = parseFloat(value);
  const hasValue = value !== '' && !value.endsWith('.');
  const isOutOfRange = hasValue && (parsed < min || parsed > max);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    const p = parseFloat(raw);
    const valid = !raw.endsWith('.') && p >= min && p <= max;
    onChange(raw, valid);
  }

  return (
    <div>
      <div className={`${styles.wrapper} ${isOutOfRange ? styles.error : ''}`}>
        <input
          type="text"
          inputMode="decimal"
          className={`${styles.input} ${hasValue ? styles.hasValue : ''}`}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={hintId}
        />
        <span className={styles.unit}>{unit}</span>
      </div>
      <p id={hintId} className={`${styles.hint} ${isOutOfRange ? styles.error : ''}`}>{hint}</p>
    </div>
  );
}
