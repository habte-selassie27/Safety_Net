import { Card } from "../components/Card";
import { NetworkBadge } from "../components/NetworkBadge";
import { SeverityMeter } from "../components/SeverityMeter";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { verdictDistribution } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import { formatDate, percent } from "../lib/format";
import { href } from "../lib/router";

export function EmbedSystem({ systemId }: { systemId: string }) {
  const index = useRecordIndex();
  const state =
    index.status === "ready" ? index.state : emptyRecordState();
  const system = state.systems.find((entry) => entry.system_id === systemId);

  if (!system) {
    return (
      <div className={ui.embedShell} data-testid="page-embed">
        <p className={ui.hint}>No SafetyNet system with id “{systemId}”.</p>
      </div>
    );
  }

  const incidents = state.incidents
    .filter((incident) => incident.system_id === system.system_id)
    .sort(
      (a, b) =>
        (b.verdict?.ruled_at ?? b.filed_at) -
        (a.verdict?.ruled_at ?? a.filed_at),
    );
  const decisions = incidents.filter((incident) => incident.verdict);
  const distribution = verdictDistribution(incidents);
  const total = decisions.length;
  const gaps = decisions.filter(
    (incident) => incident.verdict?.verdict === "POLICY_ADEQUATE_BUT_HARM",
  ).length;
  const latest = decisions.slice(0, 3);

  return (
    <div className={ui.embedShell} data-testid="page-embed">
      <Card>
        <div className={ui.rowBetween}>
          <div className={ui.row}>
            <SyntheticBadge />
            <NetworkBadge />
          </div>
          {system.claimed ? (
            <span className={ui.badge} data-verdict="DISMISSED">
              Claimed
            </span>
          ) : (
            <span className={ui.badge} data-verdict="INSUFFICIENT_EVIDENCE">
              Unverified
            </span>
          )}
        </div>
        <h2 style={{ marginTop: 10 }}>{system.display_name}</h2>
        <p className={ui.hint}>
          {incidents.length} incident{incidents.length === 1 ? "" : "s"} ·{" "}
          {total} verdict
          {total === 1 ? "" : "s"} · {gaps} policy gap{gaps === 1 ? "" : "s"} ·
          policy v{system.current_policy}
        </p>

        {total === 0 ? (
          <p className={ui.hint} style={{ marginTop: 12 }}>
            No verdicts recorded yet.
          </p>
        ) : (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            {distribution.map((entry) => (
              <div key={entry.verdict}>
                <div className={ui.rowBetween}>
                  <VerdictBadge verdict={entry.verdict} />
                  <span className={ui.hint}>
                    {entry.count} · {percent(entry.count, total)}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: "var(--surface-2)",
                    marginTop: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: percent(entry.count, total),
                      height: "100%",
                      background: "currentColor",
                      opacity: 0.45,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {latest.length > 0 ? (
          <div className={ui.stack} style={{ marginTop: 16 }}>
            {latest.map((incident) => (
              <div key={incident.incident_id}>
                <div className={ui.rowBetween}>
                  <a
                    className={ui.mono}
                    href={href(`/incidents/${incident.incident_id}`)}
                    target="_top"
                  >
                    {incident.incident_id}
                  </a>
                  <SeverityMeter
                    severity={incident.verdict?.severity}
                    verdict={incident.verdict?.verdict}
                  />
                </div>
                <p className={ui.hint} style={{ marginTop: 2 }}>
                  {formatDate(incident.verdict?.ruled_at ?? incident.filed_at)}{" "}
                  ·{" "}
                  {incident.verdict?.clauses.length
                    ? `clause ${incident.verdict.clauses.join(", ")}`
                    : "no clause cited"}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p style={{ marginTop: 16 }}>
          <a href={href(`/systems/${system.system_id}`)} target="_top">
            Open the full SafetyNet record →
          </a>
        </p>
        <p className={`${ui.hint}`} style={{ marginTop: 10 }}>
          Policy compliance findings, not legal determinations. SYNTHETIC demo
          data.
        </p>
      </Card>
    </div>
  );
}
