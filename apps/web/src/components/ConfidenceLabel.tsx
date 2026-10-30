import ui from "./ui.module.css";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export interface ConfidenceLabelProps {
  confidence: Confidence | string | null | undefined;
  className?: string;
}

const LABELS: Record<string, string> = {
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
  HIGH: "High confidence",
};

export function ConfidenceLabel({
  confidence,
  className,
}: ConfidenceLabelProps) {
  const value = (confidence ?? "").toString().toUpperCase();
  const label = LABELS[value] ?? `${value || "Unknown"} confidence`;

  return (
    <span
      className={[ui.muted, className].filter(Boolean).join(" ")}
      data-testid="confidence-label"
      data-confidence={value || undefined}
    >
      {label}
    </span>
  );
}
