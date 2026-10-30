import { useState } from "react";

import { ClauseCard } from "../components/ClauseCard";
import { EmptyState } from "../components/EmptyState";
import { SeverityChips } from "../components/SeverityChips";
import { StatCard } from "../components/StatCard";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { demoStore } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import {
  formatDate,
  formatDateTime,
  shortAddress,
  shortHash,
} from "../lib/format";
import { Link, useRoute } from "../lib/router";

export function SystemDetail() {
  const route = useRoute();
  const index = useRecordIndex();
  const state =
    index.status === "ready" ? index.state : emptyRecordState();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const system = state.systems.find((entry) => entry.system_id === route.id);
  if (!system) {
    return (
      <EmptyState
        title="System not found"
        action="All systems"
        actionTo="/systems"
      >
        No system with id “{route.id}” is registered.
      </EmptyState>
    );
  }

  const incidents = state.incidents
    .filter((incident) => incident.system_id === system.system_id)
    .sort((a, b) => b.filed_at - a.filed_at);
  const decisions = incidents.filter((incident) => incident.verdict);
  const gaps = decisions.filter(
    (incident) => incident.verdict?.verdict === "POLICY_ADEQUATE_BUT_HARM",
  );
  const responses = incidents.filter((incident) => incident.response);
  const medianResponse = (() => {
    if (responses.length === 0) return null;
    const durations = responses
      .map(
        (incident) =>
          (incident.response?.responded_at ?? 0) - incident.filed_at,
      )
      .sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    return durations.length % 2 === 0
      ? Math.round(
          ((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2 / 3_600_000,
        )
      : Math.round((durations[mid] ?? 0) / 3_600_000);
  })();

  const claim = () => {
    setError(null);
    setMessage(null);
    const result = demoStore.claimSystem(system.system_id);
    if (!result.ok) {
      setError(`${result.code}: ${result.message}`);
      return;
    }
    setMessage(
      "System claimed locally by the demo account. On-chain claiming is first-come in v1.",
    );
  };

  return (
    <div
      className={ui.stackLoose}
      data-testid="page-system"
      data-system-id={system.system_id}
    >
      <div data-testid="system-header">
        <p className={ui.breadcrumbs}>
          <Link to="/systems">AI systems</Link> / {system.system_id}
        </p>
        <div className={ui.pageHead}>
          <div>
            <div className={ui.row} style={{ marginBottom: 8 }}>
              <SyntheticBadge />
              {system.claimed ? (
                <span className={ui.badge} data-verdict="DISMISSED">
                  Provider claimed
                </span>
              ) : (
                <span className={ui.badge} data-verdict="INSUFFICIENT_EVIDENCE">
                  Unverified provider
                </span>
              )}
            </div>
            <h1>{system.display_name}</h1>
            <p className={ui.lede}>
              {system.system_id} · provider {system.provider_id}
              {system.claimed
                ? ` · claimed by ${shortAddress(system.claimed_by)}`
                : ""}
            </p>
          </div>
          <div className={ui.row}>
            <Link
              className={ui.button}
              to={`/report?system=${system.system_id}`}
            >
              Report an incident
            </Link>
            <Link
              className={`${ui.button} ${ui.buttonSecondary}`}
              to="/provider"
            >
              Provider console
            </Link>
          </div>
        </div>
      </div>

      {!system.claimed ? (
        <section className={`${ui.notice} ${ui.noticeWarn}`}>
          <p>
            <strong>Provider not verified.</strong> No party has claimed this
            system. Incidents still work, but verdict confidence is capped at
            MEDIUM and the UI flags the record.
          </p>
          <p style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSmall}`}
              onClick={claim}
            >
              Claim this system (demo)
            </button>
          </p>
          {message ? (
            <p className={ui.noticeOk} style={{ marginTop: 8 }}>
              {message}
            </p>
          ) : null}
          {error ? (
            <p className={ui.errorText} style={{ marginTop: 8 }} role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={ui.grid3} aria-label="System statistics">
        <StatCard label="Incidents filed" value={incidents.length} />
        <StatCard label="Verdicts" value={decisions.length} />
        <StatCard
          label="Policy gaps"
          value={gaps.length}
          hint="Harm despite compliance"
        />
        <StatCard
          label="Median response"
          value={medianResponse === null ? "—" : `${medianResponse}h`}
          hint="From filing to provider response"
        />
      </section>

      <section data-testid="system-policies">
        <div className={ui.sectionHead}>
          <h2>Policy versions</h2>
          <span className={ui.hint}>Immutable once published</span>
        </div>
        <div className={ui.stack}>
          {[...system.policies].reverse().map((policy) => (
            <details
              key={policy.version}
              className={ui.card}
              open={policy.version === system.current_policy}
            >
              <summary style={{ cursor: "pointer" }}>
                <span
                  className={ui.rowBetween}
                  style={{ display: "inline-flex", width: "100%" }}
                >
                  <strong>
                    v{policy.version}
                    {policy.version === system.current_policy
                      ? " · current"
                      : ""}
                  </strong>
                  <span className={ui.hint}>
                    effective {formatDate(policy.effective_at)}
                  </span>
                </span>
              </summary>
              <dl className={ui.kv} style={{ marginTop: 12 }}>
                <dt>Text hash</dt>
                <dd className={`${ui.mono}`} title={policy.text_hash}>
                  {shortHash(policy.text_hash)}
                </dd>
                <dt>Published</dt>
                <dd>{formatDateTime(policy.published_at)}</dd>
                <dt>Source</dt>
                <dd>
                  <a
                    href={policy.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {policy.url}
                  </a>
                </dd>
                <dt>Supersedes</dt>
                <dd>{policy.supersedes || "—"}</dd>
                <dt>Clauses</dt>
                <dd>{policy.clause_ids.join(", ")}</dd>
              </dl>
              <div className={ui.stack} style={{ marginTop: 12 }}>
                {policy.clauses.map((clause) => (
                  <ClauseCard key={clause.id} clause={clause} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <div className={ui.sectionHead}>
          <h2>Incidents</h2>
          <Link to={`/incidents?system=${system.system_id}`}>
            Filter in the record →
          </Link>
        </div>
        {incidents.length === 0 ? (
          <EmptyState
            title="No incidents filed"
            action="File one"
            actionTo={`/report?system=${system.system_id}`}
          >
            This system has no reports yet.
          </EmptyState>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <caption className={ui.srOnly}>
                Incidents filed against {system.display_name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Incident</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Filed</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.incident_id}>
                    <td>
                      <Link
                        className={ui.mono}
                        to={`/incidents/${incident.incident_id}`}
                      >
                        {incident.incident_id}
                      </Link>
                    </td>
                    <td>
                      <VerdictBadge verdict={incident.verdict?.verdict} />
                    </td>
                    <td>
                      <SeverityChips severity={incident.verdict?.severity} />
                      {!incident.verdict ? (
                        <span className={ui.hint}>—</span>
                      ) : null}
                    </td>
                    <td className={ui.hint}>v{incident.policy_version}</td>
                    <td className={ui.hint}>{formatDate(incident.filed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
