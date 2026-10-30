import { formatDate } from "../lib/format";
import { Link } from "../lib/router";
import { StatusBadge } from "./StatusBadge";
import { SyntheticBadge } from "./SyntheticBadge";
import { VerdictBadge } from "./VerdictBadge";
import ui from "./ui.module.css";

export interface IncidentRowProps {
  incidentId: string;
  systemName: string;
  verdict?: string | null;
  status?: string;
  synthetic?: boolean;
  filedAt?: number;
  decidedAt?: number;
  clauseCount?: number;
  confidence?: string;
  to?: string;
  className?: string;
}

export function IncidentRow({
  incidentId,
  systemName,
  verdict,
  status,
  synthetic,
  filedAt,
  decidedAt,
  clauseCount,
  confidence,
  to,
  className,
}: IncidentRowProps) {
  const href = to ?? `/incidents/${incidentId}`;
  return (
    <Link
      to={href}
      className={[ui.card, ui.cardLink, className].filter(Boolean).join(" ")}
      data-testid="incident-row"
      data-incident-id={incidentId}
      data-status={status}
      data-verdict={verdict ?? "NONE"}
      data-synthetic={synthetic ? "true" : undefined}
    >
      <div className={ui.rowBetween}>
        <strong>{systemName}</strong>
        <VerdictBadge verdict={verdict} />
      </div>
      <div className={ui.row}>
        <code className={ui.mono}>{incidentId}</code>
        {status ? <StatusBadge status={status} /> : null}
        {synthetic ? <SyntheticBadge /> : null}
      </div>
      <div className={ui.muted}>
        {filedAt ? `Filed ${formatDate(filedAt)}` : ""}
        {decidedAt ? ` · Decided ${formatDate(decidedAt)}` : ""}
        {typeof clauseCount === "number" ? ` · ${clauseCount} clauses` : ""}
        {confidence ? ` · ${confidence}` : ""}
      </div>
    </Link>
  );
}
