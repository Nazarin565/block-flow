import styles from './CircularProgress.module.css';

interface CircularProgressProps {
  value: number;
}

const SIZE = 180;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CircularProgress({ value }: CircularProgressProps) {
  const offset = CIRCUMFERENCE - (value / 100) * CIRCUMFERENCE;

  return (
    <div className={styles.wrapper}>
      <svg width={SIZE} height={SIZE} className={styles.svg}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#e8f5ee"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#2dbf7e"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={styles.arc}
        />
      </svg>
      <span className={styles.label}>{value}%</span>
    </div>
  );
}
