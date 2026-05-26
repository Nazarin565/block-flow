import styles from './Header.module.css';

interface HeaderProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
}

export default function Header({ step, totalSteps, onBack }: HeaderProps) {
  const progress = (step / totalSteps) * 100;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          disabled={!onBack}
          aria-label="Go back"
        >
          ‹
        </button>
        <div className={styles.track} role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}>
          <div className={styles.fill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </header>
  );
}
