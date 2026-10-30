import ui from "./ui.module.css";

export type IncidentStatus =
  | "OPEN"
  | "RESPONDED"
  | "DECIDED"
  | "APPEALED"
  | "FINAL";

export interface StatusBadgeProps {
  status: IncidentStatus | string | null | undefined;
  className?: string;
}

const LABELS: Record<string, string> = {
  OPEN: "Open",
  RESPONDED: "Response filed",
  DECIDED: "Decided",
  APPEALED: "Appeal filed",
  FINAL: "Final",
};

const ICONS: Record<string, string> = {
  OPEN: "○",
  RESPONDED: " ",
  DECIDED: "§",
  APPEALED: "↺",
  FINAL: "•",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const value = (status ?? "").toString().toUpperCase();
  const label = LABELS[value] ?? (value || "Unknown");

  return (
    <span
      className={[ui.badge, className].filter(Boolean).join(" ")}
      data-status={value || undefined}
      data-testid="status-badge"
    >
      <span aria-hidden="true">{ICONS[value] ?? "•"}</span>
      {label}
    </span>
  );
}
