import ui from "./ui.module.css";

const ORDER = ["LOW", "MODERATE", "SERIOUS", "CRITICAL"] as const;

export function SeverityChips({
  severity,
}: { severity: string | null | undefined }) {
  if (!severity) return null;
  const index = ORDER.indexOf(severity as (typeof ORDER)[number]);
  return (
    <span
      className={ui.severity}
      data-severity={severity}
      data-testid="severity-meter"
      title={`Severity: ${severity}`}
    >
      <span className={ui.severityBars} aria-hidden="true">
        {ORDER.map((level, i) => (
          <span
            key={level}
            className={`${ui.severityBar} ${i <= index ? ui.severityBarOn : ""}`}
          />
        ))}
      </span>
      {severity}
    </span>
  );
}
