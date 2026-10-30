import { CardLink } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { policyGaps } from "../data/store";
import { usePublishedIndex } from "../hooks/usePublishedIndex";
import { formatDate } from "../lib/format";
import { Link } from "../lib/router";

export function Systems() {
  const indexState = usePublishedIndex();
  if (indexState.status === "loading") {
    return (
      <div className={ui.stackLoose} data-testid="page-systems">
        <Skeleton />
      </div>
    );
  }
  if (indexState.status === "error") {
    return (
      <ErrorState
        title="Could not load the systems index"
        body={indexState.error}
      />
    );
  }
  const state = {
    incidents: indexState.index.incidents,
    systems: indexState.index.systems,
  } as unknown as Parameters<typeof policyGaps>[0];
  const gaps = policyGaps(state as never);

  return (
    <div className={ui.stackLoose} data-testid="page-systems">
      <div className={ui.pageHead}>
        <div>
          <div className={ui.row} style={{ marginBottom: 6 }}>
            <SyntheticBadge />
          </div>
          <h1>AI systems</h1>
          <p className={ui.lede}>
            The registry of systems and the policy versions they published. A
            system can be unclaimed: incidents are still accepted, with
            confidence capped.
          </p>
        </div>
        <Link className={`${ui.button} ${ui.buttonSecondary}`} to="/report">
          Report against a system
        </Link>
      </div>

      {state.systems.length === 0 ? (
        <EmptyState
          testId="systems-empty"
          title="No systems registered"
          action="Register a policy"
          actionTo="/provider"
        >
          A system needs a published policy version before an incident can pin
          it.
        </EmptyState>
      ) : (
        <div className={ui.grid2} data-testid="systems-cards">
          {state.systems.map((system) => {
            const incidents = state.incidents.filter(
              (incident) => incident.system_id === system.system_id,
            );
            const decisions = incidents.filter((incident) => incident.verdict);
            const systemGaps = gaps.filter(
              (gap) => gap.system_id === system.system_id,
            );
            const current = system.policies.find(
              (policy) => policy.version === system.current_policy,
            );
            return (
              <CardLink
                key={system.system_id}
                to={`/systems/${system.system_id}`}
              >
                <div
                  className={ui.card}
                  style={{ height: "100%" }}
                  data-testid="system-row"
                >
                  <div className={ui.rowBetween}>
                    <strong>{system.display_name}</strong>
                    {system.claimed ? (
                      <span className={ui.badge} data-verdict="DISMISSED">
                        Claimed
                      </span>
                    ) : (
                      <span
                        className={ui.badge}
                        data-verdict="INSUFFICIENT_EVIDENCE"
                      >
                        Unclaimed
                      </span>
                    )}
                  </div>
                  <p className={ui.hint} style={{ marginTop: 4 }}>
                    {system.system_id} · {system.provider_id}
                  </p>
                  <div className={ui.row} style={{ marginTop: 12 }}>
                    <span className={ui.chip}>
                      policy v{system.current_policy}
                    </span>
                    <span className={ui.chip}>
                      {incidents.length} incidents
                    </span>
                    <span className={ui.chip}>{decisions.length} verdicts</span>
                    <span className={ui.chip}>{systemGaps.length} gaps</span>
                  </div>
                  {current ? (
                    <p className={ui.hint} style={{ marginTop: 10 }}>
                      {current.clauses.length} clauses · effective{" "}
                      {formatDate(current.effective_at)}
                    </p>
                  ) : null}
                  {decisions.length > 0 ? (
                    <div className={ui.row} style={{ marginTop: 12 }}>
                      {[
                        ...new Set(
                          decisions.map(
                            (incident) => incident.verdict?.verdict,
                          ),
                        ),
                      ].map((verdict) => (
                        <VerdictBadge key={verdict} verdict={verdict} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
