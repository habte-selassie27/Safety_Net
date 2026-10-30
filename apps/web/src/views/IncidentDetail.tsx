import { useEffect, useState } from "react";

import { Button } from "../components/Button";
import { ClauseCard } from "../components/ClauseCard";
import { ConfidenceLabel } from "../components/ConfidenceLabel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Skeleton } from "../components/Skeleton";
import { EvidenceList } from "../components/EvidenceList";
import { SeverityMeter } from "../components/SeverityMeter";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { APPEAL_WINDOW_HOURS, DEMO_ACCOUNT, MAX_APPEALS } from "../data/seed";
import { demoStore, useDemoState } from "../data/store";
import {
  formatDate,
  formatDateTime,
  hoursRemaining,
  shortAddress,
  shortHash,
  statusLabel,
} from "../lib/format";
import { Link, useRoute } from "../lib/router";
import { APP_CONFIG } from "../lib/config";
import { submitContractWrite } from "../lib/data";
import { isChainMode } from "../lib/data/mode";
import { useChainIncident } from "../lib/data/useChainIncident";
import { useWallet, walletOnExpectedNetwork } from "../lib/wallet";

function reasonFor(verdict: string | undefined): string {
  switch (verdict) {
    case "POLICY_VIOLATION":
      return "VIOLATED";
    case "POLICY_ADEQUATE_BUT_HARM":
      return "NOT_COVERED";
    case "DISMISSED":
      return "COMPLIANT";
    case "INSUFFICIENT_EVIDENCE":
      return "AMBIGUOUS";
    default:
      return "CITED";
  }
}

export function IncidentDetail() {
  const route = useRoute();
  const state = useDemoState();
  const chainState = useChainIncident(route.id);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const wallet = useWallet();

  const incident = isChainMode()
    ? chainState.status === "ready"
      ? chainState.incident
      : null
    : state.incidents.find((entry) => entry.incident_id === route.id);

  useEffect(() => {
    if (incident) {
      const verdictLabel = incident.verdict ?? "No verdict yet";
      document.title = `${incident.incident_id} — ${verdictLabel} — ${incident.system_id} — SafetyNet`;
    }
  }, [incident]);

  if (isChainMode()) {
    if (chainState.status === "loading" || chainState.status === "idle") {
      return (
        <div className={ui.stackLoose} data-testid="page-incident">
          <Skeleton />
        </div>
      );
    }
    if (chainState.status === "error") {
      return (
        <ErrorState
          title="Could not load incident"
          body={chainState.error}
        />
      );
    }
  }

  if (!incident) {
    return (
      <EmptyState
        title="Incident not found"
        action="Back to the record"
        actionTo="/incidents"
      >
        No incident with id “{route.id}” exists in this record.
      </EmptyState>
    );
  }

  const system = state.systems.find(
    (entry) => entry.system_id === incident.system_id,
  );
  const policy = system?.policies.find(
    (entry) => entry.version === incident.policy_version,
  );
  const verdict = incident.verdict;
  const cited = new Set(verdict?.clauses ?? []);
  const drift = policy ? policy.text_hash !== incident.policy_hash : false;
  const actor = wallet.address ?? DEMO_ACCOUNT;
  const isReporter = incident.reporter.toLowerCase() === actor.toLowerCase();
  const isProvider = system?.claimed
    ? system.claimed_by.toLowerCase() === actor.toLowerCase()
    : false;
  const isAppellant = isReporter || isProvider;
  const windowMs = APPEAL_WINDOW_HOURS * 3600 * 1000;
  const withinWindow = verdict
    ? Date.now() - verdict.ruled_at <= windowMs
    : false;
  const canAppeal =
    Boolean(verdict) &&
    (incident.status === "DECIDED" || incident.status === "APPEALED") &&
    incident.appeals.length < MAX_APPEALS &&
    withinWindow &&
    isAppellant;

  /**
   * One action path for every permissionless or role-bound write. Demo mode
   * mutates the local store; chain mode signs with the connected wallet and
   * tracks the real transaction lifecycle.
   */
  const runAction = async (
    method: "adjudicate" | "finalize" | "appeal",
    args: unknown[],
    demoRun: () => { ok: boolean; message?: string; code?: string },
  ) => {
    setError(null);
    setTxStatus(null);
    if (!isChainMode()) {
      const result = demoRun();
      if (!result.ok) setError(result.message ?? "Action failed.");
      else setSubmitted(true);
      return;
    }
    if (!wallet.address) {
      setError("Connect a wallet to submit this action.");
      return;
    }
    if (!walletOnExpectedNetwork(wallet)) {
      setError(`Switch your wallet to ${APP_CONFIG.network}.`);
      return;
    }
    setPending(method);
    try {
      const { hash } = await submitContractWrite<string>(
        (window as unknown as { ethereum?: unknown }).ethereum,
        wallet.address,
        method,
        args,
        (event) =>
          setTxStatus(
            `${event.status} · ${(event.elapsedMs / 1000).toFixed(1)}s`,
          ),
      );
      setTxStatus(`accepted · ${hash.slice(0, 10)}…`);
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission failed.");
    } finally {
      setPending(null);
    }
  };

  const submitAppeal = async () => {
    await runAction("appeal", [incident.incident_id, reason], () =>
      demoStore.appeal(incident.incident_id, reason),
    );
    setReason("");
  };

  const timeline: { at: number; title: string; body: string }[] = [
    {
      at: incident.filed_at,
      title: "Incident filed",
      body: `${shortAddress(incident.reporter)} pinned policy v${incident.policy_version} (${shortHash(
        incident.policy_hash,
      )}) and evidence ${shortHash(incident.evidence_hash)}.`,
    },
  ];
  if (incident.response) {
    timeline.push({
      at: incident.response.responded_at,
      title: incident.response.late
        ? "Provider responded (late)"
        : "Provider responded",
      body: `${shortAddress(incident.response.provider)} filed a defense.`,
    });
  } else {
    timeline.push({
      at: incident.response_deadline,
      title: "No provider response filed",
      body: "Silence is a fact, not a verdict. Adjudication proceeds without a defense.",
    });
  }
  if (incident.appeals.length > 0) {
    const first = incident.appeals[0];
    timeline.push({
      at: first.created_at - 1,
      title: `Round ${first.prior_round} verdict: ${first.prior_verdict}`,
      body: "Superseded by an appeal. The original finding is preserved in the record.",
    });
    for (const appeal of incident.appeals) {
      timeline.push({
        at: appeal.created_at,
        title: `Appeal filed for round ${appeal.round}`,
        body: `${shortAddress(appeal.appellant)}: ${appeal.reason}`,
      });
    }
  }
  if (verdict) {
    timeline.push({
      at: verdict.ruled_at,
      title: `Round ${verdict.round} verdict: ${verdict.verdict}`,
      body: `Severity ${verdict.severity}, confidence ${verdict.confidence}.`,
    });
  }
  timeline.sort((a, b) => a.at - b.at);

  return (
    <div
      className={ui.stackLoose}
      data-testid="page-incident"
      data-incident-id={incident.incident_id}
    >
      <div data-testid="incident-header">
        <p className={ui.breadcrumbs}>
          <Link to="/incidents">Incident record</Link> / {incident.incident_id}
        </p>
        <div className={ui.pageHead}>
          <div>
            <div className={ui.row} style={{ marginBottom: 8 }}>
              <SyntheticBadge />
              <span className={ui.chip}>{incident.incident_id}</span>
              <span className={ui.chip}>{statusLabel(incident.status)}</span>
            </div>
            <h1>{incident.system_name}</h1>
            <p className={ui.lede}>
              Filed {formatDate(incident.filed_at)} by{" "}
              {shortAddress(incident.reporter)} · policy v
              {incident.policy_version}
              {verdict ? ` · round ${verdict.round}` : ""}
            </p>
          </div>
          <div
            className={ui.stack}
            style={{ alignItems: "flex-end" }}
            data-testid="incident-actions"
          >
            <VerdictBadge verdict={verdict?.verdict} />
            <SeverityMeter
              severity={verdict?.severity}
              verdict={verdict?.verdict}
            />
            {verdict?.confidence ? (
              <ConfidenceLabel confidence={verdict.confidence} />
            ) : null}
          </div>
        </div>
      </div>

      {!system?.claimed ? (
        <p
          className={`${ui.notice} ${ui.noticeWarn}`}
          data-testid="policy-unverified"
        >
          <strong>Unverified provider.</strong> No provider has claimed this
          system. Confidence is capped and no defense was required. This is not
          a finding about the provider's conduct.
        </p>
      ) : null}
      {drift ? (
        <p className={`${ui.notice} ${ui.noticeError}`}>
          <strong>Policy drift detected.</strong> The live policy text no longer
          matches the hash pinned at filing. The verdict fails closed rather
          than judging a different policy.
        </p>
      ) : null}

      {verdict ? (
        <section className={ui.card} data-testid="verdict-summary">
          <div className={ui.rowBetween}>
            <h2>Verdict</h2>
            <span className={ui.chip}>confidence {verdict.confidence}</span>
          </div>
          <p style={{ marginTop: 10 }}>{verdict.rationale}</p>
          {verdict.confidence === "LOW" ? (
            <p
              className={`${ui.notice} ${ui.noticeWarn}`}
              style={{ marginTop: 12 }}
            >
              Low confidence — evidence was missing, unavailable, or
              contradictory. Read the evidence section before relying on this
              finding.
            </p>
          ) : null}
          {verdict.clauses.length > 0 ? (
            <div
              className={ui.stack}
              style={{ marginTop: 14 }}
              data-testid="cited-clauses"
            >
              {verdict.clauses.map((clauseId) => {
                const clause = policy?.clauses.find(
                  (entry) => entry.id === clauseId,
                );
                if (!clause) {
                  return (
                    <p key={clauseId} className={ui.hint}>
                      Cited clause {clauseId} (policy text unavailable).
                    </p>
                  );
                }
                return (
                  <ClauseCard
                    key={clauseId}
                    clause={clause}
                    cited
                    reasonCode={reasonFor(verdict.verdict)}
                  />
                );
              })}
            </div>
          ) : (
            <p className={ui.hint} style={{ marginTop: 10 }}>
              No clause was cited. The verdict space includes outcomes that do
              not blame a clause.
            </p>
          )}
          <p className={ui.hint} style={{ marginTop: 12 }}>
            Evidence hash {shortHash(verdict.evidence_hash)} · policy hash{" "}
            {shortHash(verdict.policy_hash)} · ruled{" "}
            {formatDateTime(verdict.ruled_at)}
          </p>
          {incident.status === "DECIDED" ? (
            <div style={{ marginTop: 12 }}>
              <Button
                type="button"
                variant="secondary"
                data-testid="finalize-button"
                disabled={pending !== null}
                onClick={() =>
                  void runAction("finalize", [incident.incident_id], () =>
                    demoStore.finalize(incident.incident_id),
                  )
                }
              >
                {pending === "finalize"
                  ? "Finalizing…"
                  : isChainMode()
                    ? "Finalize record"
                    : "Finalize record (demo)"}
              </Button>
              <p className={ui.hint} style={{ marginTop: 8 }}>
                Permissionless. Marks the record final after the appeal window;
                it never changes the verdict.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className={`${ui.notice} ${ui.noticeWarn}`}
          data-testid="incident-verdict"
        >
          <strong>No verdict yet.</strong> {statusLabel(incident.status)}.
          Adjudication is permissionless and runs after the response window. No
          verdict is stored until validators converge.
          <div style={{ marginTop: 12 }}>
            <Button
              type="button"
              data-testid="adjudicate-button"
              disabled={pending !== null}
              onClick={() =>
                void runAction("adjudicate", [incident.incident_id], () =>
                  demoStore.adjudicate(incident.incident_id),
                )
              }
            >
              {pending === "adjudicate"
                ? "Adjudicating…"
                : isChainMode()
                  ? "Run adjudication"
                  : "Run adjudication (demo)"}
            </Button>
            <p className={ui.hint} style={{ marginTop: 8 }}>
              Permissionless. Validators judge the pinned evidence against the
              pinned policy version. No verdict is stored unless they converge.
            </p>
            {txStatus ? (
              <p className={ui.hint} data-testid="tx-status">
                {txStatus}
              </p>
            ) : null}
          </div>
        </section>
      )}

      <div className={ui.grid2} style={{ display: "grid" }}>
        <section>
          <h2>Claim</h2>
          <article
            className={ui.card}
            style={{ marginTop: 10 }}
            data-testid="claim-text"
          >
            <p style={{ whiteSpace: "pre-wrap" }}>{incident.claim}</p>
            <p className={ui.hint} style={{ marginTop: 10 }}>
              This is the reporter's description of the system's behavior. It is
              not authenticated by SafetyNet.
            </p>
          </article>
        </section>

        <section data-testid="provider-response">
          <h2>Provider response</h2>
          {incident.response ? (
            <article className={ui.card} style={{ marginTop: 10 }}>
              <div className={ui.rowBetween}>
                <strong>{shortAddress(incident.response.provider)}</strong>
                {incident.response.late ? (
                  <span className={ui.badge} data-verdict="OUT_OF_SCOPE">
                    late
                  </span>
                ) : null}
              </div>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                {incident.response.defense}
              </p>
              {incident.response.evidence ? (
                <div style={{ marginTop: 12 }}>
                  <h3>Response evidence</h3>
                  <EvidenceList items={incident.response.evidence.items} />
                </div>
              ) : null}
            </article>
          ) : (
            <article className={ui.card} style={{ marginTop: 10 }}>
              <p>No provider response filed.</p>
              <p className={ui.hint} style={{ marginTop: 8 }}>
                The provider did not submit a defense before the deadline.
                Silence is not treated as an admission; it only removes context
                from the adjudication.
              </p>
            </article>
          )}
        </section>
      </div>

      <section data-testid="evidence-section">
        <div className={ui.sectionHead}>
          <h2>Evidence</h2>
          <span
            className={`${ui.hint} ${ui.mono}`}
            title={incident.evidence_hash}
          >
            manifest {shortHash(incident.evidence_hash)}
          </span>
        </div>
        <EvidenceList items={incident.evidence.items} />
      </section>

      <div className={ui.grid2} style={{ display: "grid" }}>
        <section data-testid="policy-section">
          <h2>Policy version</h2>
          {policy ? (
            <article className={ui.card} style={{ marginTop: 10 }}>
              <dl className={ui.kv}>
                <dt>Version</dt>
                <dd>{policy.version}</dd>
                <dt>System</dt>
                <dd>
                  <Link to={`/systems/${policy.system_id}`}>
                    {system?.display_name}
                  </Link>
                </dd>
                <dt>Effective</dt>
                <dd>{formatDate(policy.effective_at)}</dd>
                <dt>Published</dt>
                <dd>{formatDate(policy.published_at)}</dd>
                <dt>Text hash</dt>
                <dd className={ui.mono}>{policy.text_hash}</dd>
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
              </dl>
              <p className={ui.hint} style={{ marginTop: 10 }}>
                Incidents pin the policy version at filing time. A later policy
                never applies retroactively.
              </p>
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  Full policy ({policy.clauses.length} clauses)
                </summary>
                <div className={ui.stack} style={{ marginTop: 10 }}>
                  {policy.clauses.map((clause) => (
                    <ClauseCard
                      key={clause.id}
                      clause={clause}
                      cited={cited.has(clause.id)}
                      reasonCode={reasonFor(verdict?.verdict)}
                    />
                  ))}
                </div>
              </details>
            </article>
          ) : (
            <p className={ui.hint} style={{ marginTop: 10 }}>
              The pinned policy version is unavailable.
            </p>
          )}
        </section>

        <section data-testid="appeal-history">
          <h2>History</h2>
          <ol className={ui.timeline} style={{ marginTop: 10 }}>
            {timeline.map((entry) => (
              <li
                key={`${entry.at}-${entry.title}`}
                className={ui.timelineItem}
              >
                <strong>{entry.title}</strong>
                <p className={ui.hint}>{formatDateTime(entry.at)}</p>
                <p style={{ fontSize: "0.88rem", marginTop: 4 }}>
                  {entry.body}
                </p>
              </li>
            ))}
          </ol>
          {incident.appeals.length > 0 ? (
            <p className={ui.hint} style={{ marginTop: 10 }}>
              {incident.appeals.length} of {MAX_APPEALS} appeal rounds used.
            </p>
          ) : null}
        </section>
      </div>

      <section>
        <h2>Appeal</h2>
        {submitted ? (
          <p
            className={`${ui.notice} ${ui.noticeOk}`}
            style={{ marginTop: 10 }}
          >
            Appeal recorded locally. A new adjudication round is required before
            a new verdict exists.
          </p>
        ) : canAppeal ? (
          <form
            className={ui.card}
            style={{ marginTop: 10 }}
            onSubmit={(event) => {
              event.preventDefault();
              submitAppeal();
            }}
          >
            <p className={ui.hint} style={{ marginBottom: 10 }}>
              Either the reporter or the provider may appeal once within{" "}
              {APPEAL_WINDOW_HOURS} hours of the verdict. About{" "}
              {hoursRemaining((verdict?.ruled_at ?? Date.now()) + windowMs)}{" "}
              hours remain.
            </p>
            <label className={ui.field}>
              <span className={ui.label}>Reason (20–500 characters)</span>
              <textarea
                className={ui.textarea}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
                minLength={20}
              />
            </label>
            <p
              className={`${ui.counter} ${reason.length < 20 ? ui.counterOver : ""}`}
            >
              {reason.length}/500
            </p>
            {error ? (
              <p className={ui.errorText} role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className={ui.button}
              disabled={reason.trim().length < 20}
            >
              File appeal
            </button>
          </form>
        ) : incident.appeals.length >= MAX_APPEALS ? (
          <p className={ui.hint} style={{ marginTop: 10 }}>
            No appeals remaining. The record is final.
          </p>
        ) : !withinWindow ? (
          <p className={ui.hint} style={{ marginTop: 10 }}>
            The {APPEAL_WINDOW_HOURS}-hour appeal window has closed. The verdict
            is final.
          </p>
        ) : !isAppellant ? (
          <p className={ui.hint} style={{ marginTop: 10 }}>
            Only the reporter or the claimed provider can appeal this incident.
          </p>
        ) : (
          <p className={ui.hint} style={{ marginTop: 10 }}>
            This incident is not appealable in its current state.
          </p>
        )}
      </section>

      <p
        className={ui.hint}
        style={{ marginTop: 16, maxWidth: "68ch" }}
        data-testid="legal-disclaimer"
      >
        SafetyNet publishes policy compliance findings produced by independent
        validators against a provider's own published policy. A finding is not a
        legal determination, not an assessment of liability, and not a statement
        that an AI system is safe or unsafe in general. Evidence is supplied by
        reporters and is not independently authenticated. Always consult the
        original sources and the cited policy version.
      </p>

      <section data-testid="raw-record">
        <h2>Raw record</h2>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
            Show the full public record (JSON)
          </summary>
          <pre style={{ marginTop: 10 }}>
            {JSON.stringify(incident, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}
