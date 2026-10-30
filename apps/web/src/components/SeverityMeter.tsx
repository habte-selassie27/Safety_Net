import ui from "./ui.module.css";

export type Severity = "LOW" | "MODERATE" | "SERIOUS" | "CRITICAL";

export interface SeverityMeterProps {
  severity: Severity | string | null | undefined;
  verdict?: string | null | undefined;
  className?: string;
}

const APPLICABLE = new Set(["POLICY_VIOLATION", "POLICY_ADEQUATE_BUT_HARM"]);

const LABELS: Record<string, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  SERIOUS: "Serious",
  CRITICAL: "Critical",
};

const ORDER: Severity[] = ["LOW", "MODERATE", "SERIOUS", "CRITICAL"];

export function SeverityMeter({
  severity,
  verdict,
  className,
}: SeverityMeterProps) {
  const applicable =
    !verdict || APPLICABLE.has((verdict ?? "").toString().toUpperCase());
  const value = (severity ?? "").toString().toUpperCase();

  if (!applicable) {
    return (
      <span
        className={[ui.muted, className].filter(Boolean).join(" ")}
        data-testid="severity-meter"
        aria-label="Severity: not applicable"
      >
        —<span className={ui.srOnly}>Not applicable.</span>
      </span>
    );
  }

  const index = ORDER.indexOf(value as Severity);

  return (
    <span
      className={[ui.severity, className].filter(Boolean).join(" ")}
      data-testid="severity-meter"
      data-severity={value || undefined}
      aria-label={`Severity: ${LABELS[value] ?? value}`}
    >
      <span className={ui.severityBars} aria-hidden="true">
        {ORDER.map((level, i) => (
          <span
            key={level}
            className={`${ui.severityBar} ${
              i <= index ? ui.severityBarOn : ""
            }`}
          />
        ))}
      </span>
      {LABELS[value] ?? value}
    </span>
  );
}
