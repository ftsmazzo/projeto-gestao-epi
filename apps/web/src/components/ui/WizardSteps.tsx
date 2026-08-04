'use client';

type WizardStep = {
  id: string;
  label: string;
};

type WizardStepsProps = {
  steps: WizardStep[];
  currentId: string;
  /** Se informado, permite clicar em etapas anteriores/concluidas. */
  onSelect?: (id: string) => void;
  /** Etapas clicaveis alem da atual (ex.: ja concluidas). */
  unlockedIds?: string[];
  label?: string;
};

export function WizardSteps({
  steps,
  currentId,
  onSelect,
  unlockedIds,
  label = 'Etapas',
}: WizardStepsProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentId),
  );
  const progress = steps.length <= 1 ? 100 : (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className="wizard-steps" aria-label={label}>
      <div className="wizard-steps__track" aria-hidden="true">
        <div
          className="wizard-steps__progress"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="wizard-steps__list">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = step.id === currentId;
          const unlocked =
            current ||
            done ||
            (unlockedIds ? unlockedIds.includes(step.id) : false);
          const className = [
            'wizard-steps__item',
            done ? 'is-done' : '',
            current ? 'is-current' : '',
            !unlocked && !current ? 'is-locked' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const content = (
            <>
              <span className="wizard-steps__num" aria-hidden="true">
                {done ? '✓' : index + 1}
              </span>
              <span className="wizard-steps__label">{step.label}</span>
            </>
          );

          return (
            <li key={step.id} className={className}>
              {onSelect && unlocked ? (
                <button
                  type="button"
                  className="wizard-steps__btn"
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onSelect(step.id)}
                >
                  {content}
                </button>
              ) : (
                <span
                  className="wizard-steps__btn wizard-steps__btn--static"
                  aria-current={current ? 'step' : undefined}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
