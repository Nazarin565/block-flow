import styles from './SegmentedControl.module.css';

interface SegmentedControlProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export default function SegmentedControl({ options, value, onChange, label }: SegmentedControlProps) {
  return (
    <div className={styles.control} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`${styles.option} ${value === option ? styles.active : ''}`}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
