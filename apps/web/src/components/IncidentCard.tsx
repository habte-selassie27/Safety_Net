import { formatDate } from "../lib/format";
import { Link } from "../lib/router";
import { StatusBadge } from "./StatusBadge";
import { SyntheticBadge } from "./SyntheticBadge";
import { VerdictBadge } from "./VerdictBadge";
import ui from "./ui.module.css";

export interface IncidentCardProps {
  incidentId: string;
  systemName: string;
  verdict?: string | null;
  status?: string;
  synthetic?: boolean;
  filedAt?: number;
  to?: string;
  className?: string;
}

export function IncidentCard({
  incidentId,
  systemName,
  verdict,
  status,
  synthetic,
  filedAt,
  to,
  className,
}: IncidentCardProps) {
  const href = to ?? `/incidents/${incidentId}`;
  return (
    <div
      className={[ui.card, className].filter(Boolean).join(" ")}
      data-testid="incident-card"
      data-incident-id={incidentId}
    >
      <Link to={href} className={ui.cardLink}>
        <div className={ui.rowBetween}>
          <strong>{systemName}</strong>
          <VerdictBadge verdict={verdict} />
        </div>
        <div className={ui.row}>
          <code className={ui.mono}>{incidentId}</code>
          {status ? <StatusBadge status={status} /> : null}
          {synthetic ? <SyntheticBadge /> : null}
        </div>
        {filedAt ? (
          <div className={ui.muted}>Filed {formatDate(filedAt)}</div>
        ) : null}
      </Link>
    </div>
  );
}
