import Header from './components/Header';
import { useOnboarding } from './state/onboarding';
import Step1Wish from './screens/Step1Wish';
import Step2Weight from './screens/Step2Weight';
import Step3Goal from './screens/Step3Goal';
import Step4Processing from './screens/Step4Processing';
import styles from './App.module.css';

const TOTAL_STEPS = 3;

export default function App() {
  const onboarding = useOnboarding();
  const { state, back } = onboarding;

  const showBack = state.step > 1 && state.step <= 3;
  const progressStep = Math.min(state.step, 3);

  function renderScreen() {
    switch (state.step) {
      case 1: return <Step1Wish onboarding={onboarding} />;
      case 2: return <Step2Weight onboarding={onboarding} />;
      case 3: return <Step3Goal onboarding={onboarding} />;
      case 4: return <Step4Processing onboarding={onboarding} />;
      default: return null;
    }
  }

  return (
    <div className={styles.app}>
      {state.step <= 3 && (
        <Header
          step={progressStep}
          totalSteps={TOTAL_STEPS}
          onBack={showBack ? back : undefined}
        />
      )}
      <main className={styles.main}>
        {renderScreen()}
      </main>
    </div>
  );
}
