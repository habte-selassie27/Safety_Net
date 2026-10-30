import { EmptyState } from "../components/EmptyState";
import { StatCard } from "../components/StatCard";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { TrustNote } from "../components/TrustNote";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { headlineStats, policyGaps } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import { formatDate } from "../lib/format";
import { Link } from "../lib/router";

export function Home() {
  const index = useRecordIndex();
  const state =
    index.status === "ready" ? index.state : emptyRecordState();
  const stats = headlineStats(state);
  const latest = state.incidents
    .filter((incident) => incident.verdict)
    .sort((a, b) => (b.verdict?.ruled_at ?? 0) - (a.verdict?.ruled_at ?? 0))
    .slice(0, 5);
  const gaps = policyGaps(state).slice(0, 3);

  return (
    <div className={ui.stackLoose} data-testid="page-home">
      <section data-testid="home-hero">
        <div className={ui.row} style={{ marginBottom: 8 }}>
          <SyntheticBadge label="Demo data — synthetic" />
        </div>
        <h1>
          The public record of{" "}
          <span style={{ color: "var(--accent)" }}>AI harm</span>.
        </h1>
        <p className={ui.lede} style={{ fontSize: "1.02rem", marginTop: 10 }}>
          Report an AI safety incident with evidence. The AI provider answers.
          GenLayer validators decide whether the system violated its own
          published policy. Every verdict is permanent, queryable, and free to
          check.
        </p>
        <div className={ui.row} style={{ marginTop: 18 }}>
          <Link className={ui.button} to="/report">
            Report an incident
          </Link>
          <Link
            className={`${ui.button} ${ui.buttonSecondary}`}
            to="/incidents"
          >
            Browse the record
          </Link>
        </div>
      </section>

      <section
        className={ui.grid}
        aria-label="Headline numbers"
        data-testid="home-stats"
      >
        <div className={ui.grid3}>
          <StatCard
            label="Incidents filed"
            value={stats.incidents}
            hint="All synthetic in this demo build"
          />
          <StatCard
            label="Verdicts reached"
            value={stats.verdicts}
            hint="Closed set: 5 outcomes"
          />
          <StatCard
            label="Policy gaps found"
            value={stats.gaps}
            hint="Harm despite policy compliance"
          />
        </div>
      </section>

      <div className={ui.grid2} style={{ display: "grid" }}>
        <section data-testid="home-latest">
          <div className={ui.sectionHead}>
            <h2>Latest verdicts</h2>
            <Link to="/incidents">All incidents →</Link>
          </div>
          {latest.length === 0 ? (
            <EmptyState
              title="No verdicts yet"
              action="File the first incident"
              actionTo="/report"
            >
              Verdicts appear here once validators converge.
            </EmptyState>
          ) : (
            <div className={ui.stack}>
              {latest.map((incident) => (
                <Link
                  key={incident.incident_id}
                  to={`/incidents/${incident.incident_id}`}
                  className={ui.cardLink}
                >
                  <article className={ui.card}>
                    <div className={ui.rowBetween}>
                      <strong>{incident.system_name}</strong>
                      <VerdictBadge verdict={incident.verdict?.verdict} />
                    </div>
                    <p className={ui.hint} style={{ marginTop: 6 }}>
                      {incident.incident_id} ·{" "}
                      {formatDate(
                        incident.verdict?.ruled_at ?? incident.filed_at,
                      )}
                    </p>
                    <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
                      {incident.verdict?.clauses.length
                        ? `Clause ${incident.verdict.clauses.join(", ")} cited`
                        : "No clause cited"}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section data-testid="home-gaps">
          <div className={ui.sectionHead}>
            <h2>Policy gaps</h2>
            <Link to="/policy-gaps">All gaps →</Link>
          </div>
          <p className={ui.hint} style={{ marginBottom: 10 }}>
            Incidents where the system followed its own policy but harm still
            occurred. This is the part of the record no one else publishes.
          </p>
          {gaps.length === 0 ? (
            <EmptyState
              title="No policy gaps recorded"
              action="How gaps work"
              actionTo="/about"
            >
              A gap appears when validators find harm despite policy compliance.
            </EmptyState>
          ) : (
            <div className={ui.stack}>
              {gaps.map((gap) => (
                <article
                  key={`${gap.system_id}-${gap.clause.id}`}
                  className={ui.card}
                >
                  <div className={ui.rowBetween}>
                    <strong>
                      {gap.clause.id} — {gap.clause.title}
                    </strong>
                    <span className={ui.chip}>
                      {gap.incident_ids.length} cited
                    </span>
                  </div>
                  <p className={ui.hint} style={{ marginTop: 4 }}>
                    {gap.system_name}
                  </p>
                  <p style={{ marginTop: 8, fontSize: "0.86rem" }}>
                    {gap.clause.text}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section data-testid="home-how">
        <h2>How it works</h2>
        <ol className={ui.grid4} style={{ marginTop: 12, paddingLeft: 20 }}>
          <li>
            <strong>File</strong>
            <p className={ui.hint}>
              Pin evidence hashes and the exact policy version.
            </p>
          </li>
          <li>
            <strong>Respond</strong>
            <p className={ui.hint}>
              The claimed provider submits a defense. A missing response is a
              fact, not a finding.
            </p>
          </li>
          <li>
            <strong>Adjudicate</strong>
            <p className={ui.hint}>
              Independent validators judge clause by clause.
            </p>
          </li>
          <li>
            <strong>Appeal</strong>
            <p className={ui.hint}>
              Either party can request one larger round within 72 hours.
            </p>
          </li>
        </ol>
      </section>

      <section
        className={`${ui.notice} ${ui.noticeWarn}`}
        data-testid="home-trust"
      >
        <strong>What a verdict does not mean.</strong> A SafetyNet finding is a
        policy compliance result, not a legal determination and not proof that
        the evidence is authentic.{" "}
        <Link to="/about">Read the trust boundary →</Link>
        <TrustNote variant="short" />
      </section>
    </div>
  );
}
