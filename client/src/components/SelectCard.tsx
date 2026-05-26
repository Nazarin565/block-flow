import styles from './SelectCard.module.css';

interface SelectCardProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export default function SelectCard({ label, selected, onSelect }: SelectCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.indicator} />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
