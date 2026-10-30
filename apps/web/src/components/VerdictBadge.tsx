import { verdictIcon, verdictLabel } from "../lib/format";
import ui from "./ui.module.css";

export function VerdictBadge({
  verdict,
}: { verdict: string | null | undefined }) {
  if (!verdict) {
    return (
      <span className={ui.badge} data-verdict="NONE">
        <span aria-hidden="true">•</span>
        No verdict
      </span>
    );
  }
  return (
    <span
      className={ui.badge}
      data-verdict={verdict}
      data-testid="verdict-badge"
    >
      <span aria-hidden="true">{verdictIcon(verdict)}</span>
      {verdictLabel(verdict)}
    </span>
  );
}
