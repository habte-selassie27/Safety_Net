import ui from "./ui.module.css";

export interface CountChipProps {
  value: number | string;
  label?: string;
  className?: string;
}

export function CountChip({ value, label, className }: CountChipProps) {
  return (
    <span
      className={[ui.chip, className].filter(Boolean).join(" ")}
      data-testid="count-chip"
    >
      {value}
      {label ? ` ${label}` : ""}
    </span>
  );
}
