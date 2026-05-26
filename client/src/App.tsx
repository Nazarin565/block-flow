import Header from './components/Header';
import { useOnboarding } from './state/onboarding';
import Step1Wish from './screens/Step1Wish';
import Step2Weight from './screens/Step2Weight';
import Step3Goal from './screens/Step3Goal';
import Step4Processing from './screens/Step4Processing';

export default function App() {
  const onboarding = useOnboarding();
  const { state } = onboarding;

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
    <>
      <Header />
      {renderScreen()}
    </>
  );
}
