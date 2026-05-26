import styles from './SelectCard.module.css';

interface SelectCardProps {
  label: string;
  emoji: string;
  selected: boolean;
  onSelect: () => void;
}

export default function SelectCard({ label, emoji, selected, onSelect }: SelectCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.emoji}>{emoji}</span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
