import ui from "./ui.module.css";

export function SyntheticBadge({ label = "Synthetic" }: { label?: string }) {
  return (
    <span
      className={ui.synthetic}
      data-testid="synthetic-badge"
      title="Illustrative data only. This is not a real incident."
    >
      {label}
    </span>
  );
}
