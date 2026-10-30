import { formatDate } from "../lib/format";
import { ConfidenceLabel } from "./ConfidenceLabel";
import { SeverityMeter } from "./SeverityMeter";
import { TrustNote } from "./TrustNote";
import { VerdictBadge } from "./VerdictBadge";
import ui from "./ui.module.css";

export interface VerdictSummaryProps {
  verdict?: string | null;
  severity?: string | null;
  confidence?: string | null;
  round?: number;
  ruledAt?: number;
  rationale?: string;
  clauses?: string[];
  evidenceCount?: number;
  unavailableCount?: number;
  status?: string;
  responseDeadline?: number;
  className?: string;
}

export function VerdictSummary({
  verdict,
  severity,
  confidence,
  round,
  ruledAt,
  rationale,
  clauses = [],
  evidenceCount,
  unavailableCount,
  status,
  responseDeadline,
  className,
}: VerdictSummaryProps) {
  const hasVerdict = Boolean(verdict);

  return (
    <div
      className={[ui.card, className].filter(Boolean).join(" ")}
      data-testid="verdict-summary"
      data-verdict={verdict ?? "NONE"}
    >
      {hasVerdict ? (
        <>
          <div className={ui.rowBetween}>
            <VerdictBadge verdict={verdict} />
            {severity ? (
              <SeverityMeter severity={severity} verdict={verdict} />
            ) : null}
          </div>
          <p className={ui.muted}>
            <ConfidenceLabel confidence={confidence} /> · Round {round ?? 1}
            {ruledAt ? ` · ${formatDate(ruledAt)}` : ""}
          </p>
          {rationale ? <p>{rationale}</p> : null}
          <div>
            {clauses.length ? (
              clauses.map((c) => (
                <span key={c} className={ui.chip}>
                  {c}
                </span>
              ))
            ) : (
              <span className={ui.muted}>No clause cited.</span>
            )}
          </div>
          {typeof evidenceCount === "number" ? (
            <p className={ui.muted}>
              {evidenceCount} items considered
              {typeof unavailableCount === "number" && unavailableCount > 0
                ? ` · ${unavailableCount} unavailable`
                : ""}
            </p>
          ) : null}
          <TrustNote variant="verdict" />
        </>
      ) : (
        <>
          <p>
            <strong>No verdict yet</strong>
          </p>
          <p className={ui.muted}>
            {status === "OPEN" && responseDeadline
              ? `Adjudication opens after the response deadline on ${formatDate(
                  responseDeadline,
                )}.`
              : "Adjudication can be requested now."}
          </p>
        </>
      )}
    </div>
  );
}
