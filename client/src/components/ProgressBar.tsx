import styles from './ProgressBar.module.css';

type ProgressBarProps =
  | { mode: 'determinate'; value: number }
  | { mode: 'indeterminate' };

export default function ProgressBar(props: ProgressBarProps) {
  if (props.mode === 'indeterminate') {
    return (
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles.indeterminate}`} />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${props.value}%` }} />
      </div>
      <span className={styles.label}>{props.value}%</span>
    </div>
  );
}
