import styles from './NumberInput.module.css';

interface NumberInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  'aria-label': string;
  placeholder?: string;
}

export default function NumberInput({ value, onChange, placeholder, 'aria-label': ariaLabel }: NumberInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow digits and at most one decimal point
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    // Trailing dot means the user is still typing (e.g. "1.") — not yet valid
    const isValid = !raw.endsWith('.') && parseFloat(raw) > 0;
    onChange(raw, isValid);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      className={styles.input}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
