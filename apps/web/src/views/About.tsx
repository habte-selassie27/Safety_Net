import { Card } from "../components/Card";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { policyGaps, useDemoState } from "../data/store";
import { Link } from "../lib/router";

const VERDICT_MEANINGS: { verdict: string; means: string; doesNot: string }[] =
  [
    {
      verdict: "POLICY_VIOLATION",
      means:
        "The pinned evidence shows the output contradicted a specific clause of the provider's own policy.",
      doesNot:
        "That a law was broken or that the provider is generally unsafe.",
    },
    {
      verdict: "POLICY_ADEQUATE_BUT_HARM",
      means:
        "The output complied with the published policy, yet harm still occurred. The policy has a gap.",
      doesNot:
        "That the provider intended harm or that the clause was unlawful.",
    },
    {
      verdict: "INSUFFICIENT_EVIDENCE",
      means:
        "The evidence was missing, unverifiable, unavailable, or contradictory. No finding was forced.",
      doesNot:
        "That the incident did not happen, or that the reporter was dishonest.",
    },
    {
      verdict: "OUT_OF_SCOPE",
      means:
        "The claim does not concern the system's safety policy as published.",
      doesNot:
        "That the harm was acceptable or that no other process could address it.",
    },
    {
      verdict: "DISMISSED",
      means:
        "The evidence shows the output complied with the cited policy version.",
      doesNot:
        "That the system is safe in general or that the evidence was authenticated.",
    },
  ];

export function About() {
  const state = useDemoState();
  const gaps = policyGaps(state);

  return (
    <div className={ui.stackLoose} data-testid="page-about">
      <div>
        <div className={ui.row} style={{ marginBottom: 6 }}>
          <SyntheticBadge label="Demo build" />
        </div>
        <h1>About SafetyNet</h1>
        <p className={ui.lede}>
          SafetyNet is the public record of AI harm. Anyone can report an AI
          safety incident with evidence. The AI provider answers. GenLayer
          validators decide whether the system violated its own published safety
          policy. Every verdict is permanent, queryable, and free to check.
        </p>
      </div>

      <Card>
        <h2>Why the provider's own policy is the standard</h2>
        <p style={{ marginTop: 10 }}>
          Most incident processes ask whether a system broke the law or whether
          a company followed its internal process. SafetyNet asks a sharper
          question: did the system break its own published promise?
        </p>
        <p style={{ marginTop: 10 }}>
          That inversion makes the finding hard to dismiss as activist or
          arbitrary. The standard is the provider's words, pinned by hash at
          filing time. A later policy version never applies retroactively.
        </p>
        <p style={{ marginTop: 10 }}>
          The most valuable outcome is <strong>POLICY_ADEQUATE_BUT_HARM</strong>
          : the system followed its policy, but harm still occurred. Aggregated
          across providers, those findings map where AI safety policies are
          insufficient.{" "}
          <Link to="/policy-gaps">See the policy gaps view →</Link>
        </p>
        <p className={ui.hint} style={{ marginTop: 10 }}>
          {gaps.length} gap group{gaps.length === 1 ? "" : "s"} in this
          synthetic demo record.
        </p>
      </Card>

      <section>
        <h2>What a verdict means — and does not mean</h2>
        <div
          className={ui.tableWrap}
          style={{ marginTop: 12 }}
          data-testid="verdict-table"
        >
          <table>
            <caption>The five-verdict closed set</caption>
            <thead>
              <tr>
                <th scope="col">Verdict</th>
                <th scope="col">It means</th>
                <th scope="col">It does not mean</th>
              </tr>
            </thead>
            <tbody>
              {VERDICT_MEANINGS.map((entry) => (
                <tr key={entry.verdict}>
                  <td>
                    <VerdictBadge verdict={entry.verdict} />
                  </td>
                  <td>{entry.means}</td>
                  <td className={ui.muted}>{entry.doesNot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="trust-boundary">
        <h2>The trust boundary</h2>
        <p className={ui.lede} style={{ marginBottom: 12 }}>
          A SafetyNet verdict is a policy compliance finding. It is deliberately
          narrow. Read this table before citing a verdict anywhere.
        </p>
        <div className={ui.grid2}>
          <div className={ui.card}>
            <h3>A verdict means</h3>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              <li>
                Independent validators read the pinned evidence and the pinned
                policy version.
              </li>
              <li>
                They agreed on a bounded verdict under a stated consensus rule.
              </li>
              <li>The record is public and unaltered since finalization.</li>
              <li>The policy text is fixed and hash-verified.</li>
              <li>The evidence bundle is pinned by hash at filing time.</li>
            </ul>
          </div>
          <div className={ui.card}>
            <h3>A verdict does not mean</h3>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              <li>That the evidence is authentic, complete, or unbiased.</li>
              <li>That the provider acted illegally.</li>
              <li>That the provider is generally safe or unsafe.</li>
              <li>
                That the policy was followed internally or enforced in practice.
              </li>
              <li>
                That the reporter is honest, or that the incident happened
                exactly as described.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Card>
        <h2>How adjudication works</h2>
        <ol style={{ marginTop: 10, paddingLeft: 20 }}>
          <li>
            <strong>File.</strong> The reporter pins a policy version and a
            bounded evidence manifest. The manifest is hashed and cannot be
            swapped later.
          </li>
          <li>
            <strong>Respond.</strong> The claimed provider may file a defense. A
            missing defense is recorded as a fact; it is never treated as an
            admission.
          </li>
          <li>
            <strong>Adjudicate.</strong> Independent validators fetch the pinned
            evidence and policy, evaluate each clause against a closed output
            schema, and aggregate deterministically.
          </li>
          <li>
            <strong>Appeal.</strong> Either party may request one larger round
            within 72 hours. The prior verdict is preserved, never overwritten.
          </li>
        </ol>
        <p className={ui.hint} style={{ marginTop: 10 }}>
          If validators do not converge, no verdict is stored. That is a valid,
          intentional outcome: the system fails closed rather than guessing.
        </p>
      </Card>

      <section data-testid="synthetic-explainer">
        <h2>What this demo is</h2>
        <p>
          This build is a local, synthetic demonstration of the public database.
          It contains six illustrative incidents and four illustrative systems,
          all labeled SYNTHETIC. The filing, response, appeal, claim, and
          policy-publish flows write to an in-browser store, not to a chain. No
          wallet is connected and no transaction is sent.
        </p>
        <p style={{ marginTop: 10 }}>
          The deployed contract on {"StudioNet"} is the source of truth for the
          on-chain record.{" "}
          <Link to="/data">See the data and export page →</Link>
        </p>
      </section>

      <section
        className={`${ui.notice} ${ui.noticeWarn}`}
        data-testid="disclaimer"
      >
        <h2>Disclaimer</h2>
        <p style={{ marginTop: 10 }}>
          SafetyNet publishes policy compliance findings produced by independent
          validators against a provider's own published policy. A finding is not
          a legal determination, not an assessment of liability, and not a
          statement that an AI system is safe or unsafe in general. Evidence is
          supplied by reporters and is not independently authenticated. Always
          consult the original sources and the cited policy version.
        </p>
      </section>
    </div>
  );
}
