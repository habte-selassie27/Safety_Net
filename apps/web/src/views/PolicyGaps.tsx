import { EmptyState } from "../components/EmptyState";
import { SyntheticBadge } from "../components/SyntheticBadge";
import ui from "../components/ui.module.css";
import { policyGaps } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import { downloadText, gapReport } from "../lib/exports";
import { NETWORK, SAFETYNET_ADDRESS } from "../lib/network";
import { Link } from "../lib/router";

export function PolicyGaps() {
  const index = useRecordIndex();
  const state =
    index.status === "ready" ? index.state : emptyRecordState();
  const groups = policyGaps(state);
  const totalIncidents = new Set(groups.flatMap((group) => group.incident_ids))
    .size;
  const meta = { network: NETWORK, contract: SAFETYNET_ADDRESS };

  return (
    <div className={ui.stackLoose} data-testid="page-policy-gaps">
      <div className={ui.pageHead}>
        <div data-testid="gap-explainer">
          <div className={ui.row} style={{ marginBottom: 6 }}>
            <SyntheticBadge />
          </div>
          <h1>Policy gaps</h1>
          <p className={ui.lede}>
            These incidents found harm even though the system followed its own
            published policy. That means the policy has a gap. Grouping gaps by
            clause shows where AI safety policies are insufficient.
          </p>
        </div>
        {groups.length > 0 ? (
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSecondary}`}
            data-testid="gap-export"
            onClick={() =>
              downloadText(
                "policy-gaps.md",
                gapReport(groups, meta),
                "text/markdown",
              )
            }
          >
            Export markdown
          </button>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          testId="gap-empty"
          title="No policy gaps recorded yet"
          action="Browse the record"
          actionTo="/incidents"
        >
          A gap appears when validators return POLICY_ADEQUATE_BUT_HARM: the
          output complied with the policy, but harm still occurred.
        </EmptyState>
      ) : (
        <>
          <section
            className={ui.grid3}
            aria-label="Gap summary"
            data-testid="gap-summary"
          >
            <div className={ui.stat}>
              <div className={ui.statValue}>{groups.length}</div>
              <div className={ui.statLabel}>Gap groups</div>
            </div>
            <div className={ui.stat}>
              <div className={ui.statValue}>{totalIncidents}</div>
              <div className={ui.statLabel}>Incidents with gaps</div>
            </div>
            <div className={ui.stat}>
              <div className={ui.statValue}>
                {new Set(groups.map((group) => group.clause.id)).size}
              </div>
              <div className={ui.statLabel}>Distinct clauses</div>
            </div>
          </section>

          <section className={ui.stack}>
            {groups.map((group) => (
              <article
                key={`${group.system_id}-${group.clause.id}`}
                className={ui.card}
                data-testid="gap-group"
              >
                <div className={ui.rowBetween}>
                  <div>
                    <h2>
                      {group.clause.id} — {group.clause.title}
                    </h2>
                    <p className={ui.hint}>
                      {group.system_name} ·{" "}
                      {group.clause.mandatory
                        ? "mandatory clause"
                        : "non-mandatory clause"}
                    </p>
                  </div>
                  <span
                    className={ui.badge}
                    data-verdict="POLICY_ADEQUATE_BUT_HARM"
                  >
                    {group.incident_ids.length} gap
                    {group.incident_ids.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p style={{ marginTop: 10 }}>{group.clause.text}</p>
                <p style={{ marginTop: 12 }}>
                  <strong>Incidents:</strong>{" "}
                  {group.incident_ids.map((id, index) => (
                    <span key={id}>
                      {index > 0 ? ", " : ""}
                      <Link className={ui.mono} to={`/incidents/${id}`}>
                        {id}
                      </Link>
                    </span>
                  ))}
                </p>
                <p
                  className={`${ui.notice} ${ui.noticeWarn}`}
                  style={{ marginTop: 12 }}
                >
                  A gap is a finding about the policy text, not about the
                  provider's intent. The clause did not cover the harm that
                  occurred.
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
