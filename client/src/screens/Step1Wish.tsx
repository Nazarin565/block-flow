import type { OnboardingHandle } from '../state/onboarding';
import SelectCard from '../components/SelectCard';
import Button from '../components/Button';
import styles from './Step1Wish.module.css';

const WISHES = [
  { id: 'lose_weight',     label: 'Lose weight',           emoji: '😋' },
  { id: 'build_muscle',    label: 'Build muscle',           emoji: '🤩' },
  { id: 'balance',         label: 'Maintain balance',       emoji: '⚖️' },
  { id: 'healthy_heart',   label: 'Have a healthy heart',   emoji: '💚' },
  { id: 'feel_better',     label: 'Just feel better',       emoji: '😊' },
];

interface Props { onboarding: OnboardingHandle; }

export default function Step1Wish({ onboarding }: Props) {
  const { state, setWish, next } = onboarding;

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>What is your main wish?</h1>
      <ul className={styles.list} role="list">
        {WISHES.map(w => (
          <li key={w.id}>
            <SelectCard
              label={w.label}
              emoji={w.emoji}
              selected={state.wish === w.id}
              onSelect={() => setWish(w.id)}
            />
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <Button onClick={next} disabled={state.wish === null}>
          Continue
        </Button>
      </div>
    </div>
  );
}
