import type { ReactNode } from "react";
import ui from "./ui.module.css";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className={ui.stat} data-testid="stat">
      <div className={ui.statValue}>{value}</div>
      <div className={ui.statLabel}>{label}</div>
      {hint ? (
        <div className={ui.hint} style={{ marginTop: 4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
