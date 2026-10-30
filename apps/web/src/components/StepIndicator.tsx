import ui from "./ui.module.css";

export type StepState = "complete" | "current" | "upcoming";

export interface Step {
  label: string;
  state: StepState;
  to?: string;
}

export interface StepIndicatorProps {
  steps: Step[];
  className?: string;
}

export function StepIndicator({ steps, className }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.state === "current");
  const currentNumber = currentIndex >= 0 ? currentIndex + 1 : 1;

  return (
    <div className={className} data-testid="step-indicator">
      <ol className={ui.stepper} aria-label="Progress">
        {steps.map((step) => {
          const classes = [ui.step];
          if (step.state === "complete") classes.push(ui.stepDone);
          if (step.state === "current") classes.push(ui.stepActive);
          return (
            <li
              key={step.label}
              className={classes.join(" ")}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span className={ui.stepDot} aria-hidden="true" />
              {step.state === "complete" ? "✓ " : null}
              {step.label}
            </li>
          );
        })}
      </ol>
      <p className={ui.muted}>
        Step {currentNumber} of {steps.length} —{" "}
        {steps[currentIndex >= 0 ? currentIndex : 0]?.label}
      </p>
    </div>
  );
}
