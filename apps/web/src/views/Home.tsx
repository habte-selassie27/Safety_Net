import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { SeverityChips } from "../components/SeverityChips";
import { StatCard } from "../components/StatCard";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { TrustNote } from "../components/TrustNote";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { headlineStats, policyGaps } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import { formatDate, shortHash } from "../lib/format";
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
  const featured = latest[0];

  return (
    <div className={ui.stackLoose} data-testid="page-home">
      <section className={ui.hero} data-testid="home-hero">
        <div className={ui.heroInner}>
          <span className={ui.heroEyebrow}>
            <span className={ui.liveDot} aria-hidden="true" />
            Live on StudioNet · public record
          </span>
          <h1 className={ui.heroTitle}>
            The public record of <span className={ui.heroAccent}>AI harm</span>
            .
          </h1>
          <p className={ui.heroLede}>
            Report an AI safety incident with evidence. The AI provider answers.
            GenLayer validators decide whether the system violated its own
            published policy. Every verdict is permanent, queryable, and free to
            check.
          </p>
          <div className={ui.heroActions}>
            <Link className={`${ui.button} ${ui.buttonLarge}`} to="/report">
              Report an incident <span aria-hidden="true">→</span>
            </Link>
            <Link
              className={`${ui.button} ${ui.buttonSecondary} ${ui.buttonLarge}`}
              to="/incidents"
            >
              Explore the record
            </Link>
          </div>
          <p className={ui.heroTrust}>
            Permanent · Queryable · Free to check
          </p>
          <div className={ui.row} style={{ justifyContent: "center", marginTop: 14 }}>
            <SyntheticBadge label="Demo data — synthetic" />
          </div>
        </div>

        {featured ? (
          <div className={ui.heroPreview}>
            <div className={ui.heroPreviewBar}>
              <span className={ui.windowDots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className={ui.heroPreviewPath}>
                safetynet / {featured.incident_id}
              </span>
              <span className={ui.heroPreviewStatus}>Final record</span>
            </div>
            <div className={ui.heroPreviewBody}>
              <div className={ui.heroPreviewHead}>
                <div>
                  <span className={ui.heroPreviewLabel}>Verdict</span>
                  <VerdictBadge verdict={featured.verdict?.verdict} />
                </div>
                <SeverityChips severity={featured.verdict?.severity} />
              </div>
              <div className={ui.heroPreviewGrid}>
                <div>
                  <span className={ui.heroPreviewLabel}>System</span>
                  <strong>{featured.system_name}</strong>
                </div>
                <div>
                  <span className={ui.heroPreviewLabel}>Policy</span>
                  <strong>v{featured.policy_version}</strong>
                </div>
                <div>
                  <span className={ui.heroPreviewLabel}>Clauses</span>
                  <strong>
                    {featured.verdict?.clauses.length
                      ? featured.verdict.clauses.join(", ")
                      : "None cited"}
                  </strong>
                </div>
                <div>
                  <span className={ui.heroPreviewLabel}>Evidence</span>
                  <code title={featured.evidence_hash}>
                    {shortHash(featured.evidence_hash)}
                  </code>
                </div>
              </div>
              <div className={ui.heroPreviewFoot}>
                <span>
                  {formatDate(
                    featured.verdict?.ruled_at ?? featured.filed_at,
                  )}{" "}
                  · confidence {featured.verdict?.confidence ?? "—"}
                </span>
                <Link to={`/incidents/${featured.incident_id}`}>
                  Open record →
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-label="Headline numbers" data-testid="home-stats">
        <p className={ui.sectionEyebrow}>The record at a glance</p>
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

      <div className={ui.homeSplit}>
        <section data-testid="home-latest">
          <div className={ui.sectionHead}>
            <div>
              <p className={ui.sectionEyebrow}>Latest verdicts</p>
              <h2 className={ui.sectionTitle}>The record, as it lands</h2>
            </div>
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
                  <Card>
                    <div className={ui.rowBetween}>
                      <strong>{incident.system_name}</strong>
                      <VerdictBadge verdict={incident.verdict?.verdict} />
                    </div>
                    <p className={ui.hint} style={{ marginTop: 7 }}>
                      {incident.incident_id} ·{" "}
                      {formatDate(
                        incident.verdict?.ruled_at ?? incident.filed_at,
                      )}
                    </p>
                    <div
                      className={ui.rowBetween}
                      style={{ marginTop: 10, alignItems: "flex-end" }}
                    >
                      <p style={{ margin: 0, fontSize: "0.88rem" }}>
                        {incident.verdict?.clauses.length
                          ? `Clause ${incident.verdict.clauses.join(", ")} cited`
                          : "No clause cited"}
                      </p>
                      <SeverityChips severity={incident.verdict?.severity} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section data-testid="home-gaps">
          <div className={ui.sectionHead}>
            <div>
              <p className={ui.sectionEyebrow}>Policy gaps</p>
              <h2 className={ui.sectionTitle}>Where the policy missed</h2>
            </div>
            <Link to="/policy-gaps">All gaps →</Link>
          </div>
          <p className={ui.hint} style={{ marginBottom: 14 }}>
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
                <Card key={`${gap.system_id}-${gap.clause.id}`}>
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
                  <p style={{ marginTop: 9, fontSize: "0.86rem" }}>
                    {gap.clause.text}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <section data-testid="home-how">
        <p className={ui.sectionEyebrow}>How it works</p>
        <h2 className={ui.sectionTitle}>Four steps. One public record.</h2>
        <p className={ui.sectionIntro}>
          The standard is not invented by SafetyNet. It is the provider&apos;s
          own published policy, pinned at filing time.
        </p>
        <ol className={ui.howGrid}>
          <li className={ui.howStep}>
            <span className={ui.howNumber} aria-hidden="true">
              01
            </span>
            <strong>File</strong>
            <p>Pin evidence hashes and the exact policy version.</p>
          </li>
          <li className={ui.howStep}>
            <span className={ui.howNumber} aria-hidden="true">
              02
            </span>
            <strong>Respond</strong>
            <p>
              The claimed provider submits a defense. A missing response is a
              fact, not a finding.
            </p>
          </li>
          <li className={ui.howStep}>
            <span className={ui.howNumber} aria-hidden="true">
              03
            </span>
            <strong>Adjudicate</strong>
            <p>Independent validators judge clause by clause.</p>
          </li>
          <li className={ui.howStep}>
            <span className={ui.howNumber} aria-hidden="true">
              04
            </span>
            <strong>Appeal</strong>
            <p>
              Either party can request one larger round within 72 hours.
            </p>
          </li>
        </ol>
      </section>

      <section className={ui.ctaBand}>
        <div>
          <p className={ui.sectionEyebrow}>Hold systems to their own words</p>
          <h2>File a record. Make it permanent.</h2>
          <p>
            Anyone can report. The provider can answer. Validators decide
            against the policy the provider published.
          </p>
        </div>
        <Link className={`${ui.button} ${ui.buttonLarge}`} to="/report">
          Report an incident <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className={ui.trustCallout} data-testid="home-trust">
        <strong>What a verdict does not mean.</strong> A SafetyNet finding is a
        policy compliance result, not a legal determination and not proof that
        the evidence is authentic.{" "}
        <Link to="/about">Read the trust boundary →</Link>
        <TrustNote variant="short" />
      </section>
    </div>
  );
}
