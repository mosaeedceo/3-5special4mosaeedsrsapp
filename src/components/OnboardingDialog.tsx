import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { BookOpen, Brain, BarChart3, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingDialogProps {
  onComplete: () => void;
}

const steps = [
  { icon: Plus, color: 'bg-primary/15 text-primary' },
  { icon: Brain, color: 'bg-warning/15 text-warning' },
  { icon: BarChart3, color: 'bg-success/15 text-success' },
];

export const OnboardingDialog = ({ onComplete }: OnboardingDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { t, isRTL } = useTranslation();
  const isWelcome = currentStep === 0;
  const isLastStep = currentStep === steps.length;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-6">
      <div className={cn(
        "bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden",
        isRTL && "text-right"
      )}>
        {isWelcome ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {t('onboarding.welcome')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {t('onboarding.welcomeDesc')}
            </p>
            <Button onClick={handleNext} className="w-full h-11 text-sm font-semibold">
              {t('onboarding.next')}
            </Button>
            <button
              onClick={onComplete}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('onboarding.skip')}
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium">
                {t('onboarding.stepOf', { current: String(currentStep), total: String(steps.length) })}
              </span>
              <button
                onClick={onComplete}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('onboarding.skip')}
              </button>
            </div>

            <div className="flex gap-1.5 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-300",
                    i < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>

            {steps.map((step, index) => {
              if (index + 1 !== currentStep) return null;
              const StepIcon = step.icon;
              const titleKey = `onboarding.step${index + 1}Title` as any;
              const descKey = `onboarding.step${index + 1}Desc` as any;

              return (
                <div key={index} className="text-center animate-fade-in">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4",
                    step.color
                  )}>
                    <StepIcon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {t(titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {t(descKey)}
                  </p>
                </div>
              );
            })}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 h-11"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {t('onboarding.back')}
              </Button>
              <Button
                onClick={handleNext}
                className="flex-[2] h-11 text-sm font-semibold"
              >
                {currentStep === steps.length
                  ? t('onboarding.getStarted')
                  : t('onboarding.next')
                }
                {currentStep < steps.length && (
                  isRTL ? <ChevronLeft className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
