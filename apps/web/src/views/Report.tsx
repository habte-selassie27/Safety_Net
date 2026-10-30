import { useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_EVIDENCE_ITEMS,
  SHA256_RE,
  canonicalManifest,
  detectPii,
  evidenceHash,
  sha256BytesHex,
  sha256Text,
  validateClaim,
  validateEvidenceManifest,
} from "@safetynet/core/validate";
import {
  type TxEvent,
  TxProgress,
  type TxStatus,
} from "../components/TxProgress";

import { SyntheticBadge } from "../components/SyntheticBadge";
import ui from "../components/ui.module.css";
import { DEMO_ACCOUNT, EVIDENCE_ALLOWLIST } from "../data/seed";
import { demoStore, useDemoState } from "../data/store";
import type { EvidenceItemView, EvidenceManifestView } from "../data/types";
import { APP_CONFIG, IS_DEMO } from "../lib/config";
import { submitContractWrite } from "../lib/data";
import { formatDate, shortHash } from "../lib/format";
import { Link, navigate, useRoute } from "../lib/router";
import { useWallet, walletOnExpectedNetwork } from "../lib/wallet";

const STEPS = [
  "System & policy",
  "Claim",
  "Evidence",
  "Review",
  "Submit",
] as const;

interface DraftEvidence {
  key: string;
  kind: "inline" | "url";
  text: string;
  url: string;
  note: string;
  maxChars: number;
  contentSha256: string;
}

let draftCounter = 0;

function newDraft(kind: DraftEvidence["kind"] = "inline"): DraftEvidence {
  draftCounter += 1;
  return {
    key: `d${draftCounter}`,
    kind,
    text: "",
    url: "",
    note: "",
    maxChars: kind === "url" ? 4000 : 2000,
    contentSha256: "",
  };
}

function charCount(value: string): number {
  return [...value].length;
}

type BuildResult =
  | { ok: true; manifest: EvidenceManifestView; hash: string }
  | { ok: false; message: string };

async function buildManifest(drafts: DraftEvidence[]): Promise<BuildResult> {
  const items: EvidenceItemView[] = [];
  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    if (!draft) continue;
    const id = `e${index + 1}`;
    if (draft.kind === "inline") {
      if (!draft.text.trim())
        return { ok: false, message: `Evidence ${id} needs text.` };
      // Always recompute from the current text so a stale on-blur hash can never
      // be pinned for edited evidence.
      const hash = await sha256Text(draft.text);
      items.push({
        id,
        kind: "inline",
        text: draft.text,
        contentSha256: hash,
        maxChars: draft.maxChars,
        ...(draft.note ? { note: draft.note } : {}),
      });
    } else {
      if (!draft.url.trim())
        return { ok: false, message: `Evidence ${id} needs a URL.` };
      if (!SHA256_RE.test(draft.contentSha256)) {
        return {
          ok: false,
          message: `Evidence ${id} needs the sha256 of the content you saw. Use “Fetch & hash” or paste it.`,
        };
      }
      items.push({
        id,
        kind: "url",
        url: draft.url,
        retrievedAt: new Date().toISOString(),
        contentSha256: draft.contentSha256,
        maxChars: draft.maxChars,
        ...(draft.note ? { note: draft.note } : {}),
      });
    }
  }
  const manifest: EvidenceManifestView = { schemaVersion: 1, items };
  const validation = validateEvidenceManifest(manifest, {
    allowlist: EVIDENCE_ALLOWLIST,
  });
  if (!validation.ok) {
    return {
      ok: false,
      message: validation.issues[0]?.message ?? "Invalid evidence manifest.",
    };
  }
  return { ok: true, manifest, hash: await evidenceHash(manifest) };
}

export function Report() {
  const route = useRoute();
  const state = useDemoState();
  const wallet = useWallet();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);

  const initialSystem = route.params.get("system") ?? "";
  const [step, setStep] = useState(0);
  const [systemId, setSystemId] = useState(
    state.systems.some((entry) => entry.system_id === initialSystem)
      ? initialSystem
      : "",
  );
  const [policyVersion, setPolicyVersion] = useState("");
  const [claim, setClaim] = useState("");
  const [drafts, setDrafts] = useState<DraftEvidence[]>([newDraft()]);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [hashing, setHashing] = useState<string | null>(null);
  const [piiAck, setPiiAck] = useState(false);
  const [permanence, setPermanence] = useState(false);
  const [manifest, setManifest] = useState<EvidenceManifestView | null>(null);
  const [manifestHash, setManifestHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>("PENDING");
  const [txEvents, setTxEvents] = useState<TxEvent[]>([]);
  const [newIncidentId, setNewIncidentId] = useState<string | null>(null);

  const system = state.systems.find((entry) => entry.system_id === systemId);
  const policy = system?.policies.find(
    (entry) => entry.version === policyVersion,
  );
  const piiHits = useMemo(() => detectPii(claim), [claim]);
  const claimLength = charCount(claim);
  const claimCheck = validateClaim(claim);

  useEffect(() => {
    if (step >= 0) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (
      system &&
      !system.policies.some((entry) => entry.version === policyVersion)
    ) {
      setPolicyVersion(system.current_policy);
    }
  }, [system, policyVersion]);

  const updateDraft = (key: string, patch: Partial<DraftEvidence>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const hashInline = async (draft: DraftEvidence) => {
    if (!draft.text.trim()) return;
    setHashing(draft.key);
    try {
      const hash = await sha256Text(draft.text);
      updateDraft(draft.key, { contentSha256: hash });
    } finally {
      setHashing(null);
    }
  };

  const fetchAndHash = async (draft: DraftEvidence) => {
    setHashing(draft.key);
    setEvidenceError(null);
    try {
      const response = await fetch(draft.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 40_000) {
        setEvidenceError(
          "Fetched content is over 40 KB; trim it or inline the relevant excerpt.",
        );
        return;
      }
      const hash = await sha256BytesHex(bytes);
      updateDraft(draft.key, { contentSha256: hash });
    } catch (fetchError) {
      setEvidenceError(
        `Could not fetch that URL from the browser (${fetchError instanceof Error ? fetchError.message : "network error"}). Paste the sha256 of the content you saw instead.`,
      );
    } finally {
      setHashing(null);
    }
  };

  const goNext = async () => {
    setError(null);
    if (step === 0) {
      if (!system) {
        setError("Choose an AI system.");
        return;
      }
      if (!policy) {
        setError("Choose the policy version this incident is judged against.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!claimCheck.ok) {
        setError(claimCheck.issues[0]?.message ?? "Write a claim.");
        return;
      }
      if (piiHits.length > 0 && !piiAck) {
        setError(
          "Confirm that the personal information is necessary, or remove it.",
        );
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const built = await buildManifest(drafts);
      if (!built.ok) {
        setEvidenceError(built.message);
        return;
      }
      setEvidenceError(null);
      setManifest(built.manifest);
      setManifestHash(built.hash);
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!permanence) {
        setError("Acknowledge that the record is permanent and public.");
        return;
      }
      setStep(4);
    }
  };

  const submit = async () => {
    setError(null);
    if (!system || !policy || !manifest) {
      setError("The submission is incomplete.");
      return;
    }
    if (!IS_DEMO && !wallet.address) {
      setError("Connect a wallet before submitting this incident report.");
      return;
    }
    if (!IS_DEMO && !walletOnExpectedNetwork(wallet)) {
      setError(
        `Switch your wallet to ${APP_CONFIG.network} (chain ${APP_CONFIG.chainId}) before submitting.`,
      );
      return;
    }
    setSubmitting(true);
    setTxEvents([]);
    setTxStatus("PENDING");
    try {
      if (IS_DEMO) {
        const result = await demoStore.fileIncident({
          system_id: system.system_id,
          policy_version: policy.version,
          claim,
          evidence: manifest,
        });
        if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
        setNewIncidentId(result.value);
        const stages: { status: TxStatus; at: number }[] = [
          { status: "PENDING", at: 0 },
          { status: "PROPOSING", at: 500 },
          { status: "COMMITTING", at: 1100 },
          { status: "REVEALING", at: 1700 },
          { status: "ACCEPTED", at: 2300 },
          { status: "FINALIZED", at: 3000 },
        ];
        for (const stage of stages) {
          const timer = window.setTimeout(() => {
            setTxStatus(stage.status);
            setTxEvents((events) => [
              ...events,
              { status: stage.status, elapsedMs: stage.at },
            ]);
          }, stage.at);
          timers.current.push(timer);
        }
        const redirect = window.setTimeout(
          () => navigate(`/incidents/${result.value}`),
          4300,
        );
        timers.current.push(redirect);
      } else {
        const manifestText = canonicalManifest(manifest);
        const { result, hash } = await submitContractWrite<string>(
          window.ethereum,
          wallet.address as string,
          "file_incident",
          [system.system_id, policy.version, claim, manifestHash, manifestText],
          (event) => {
            const nextStatus = event.status as TxStatus;
            setTxStatus(nextStatus);
            setTxEvents((events) =>
              events.some((item) => item.status === nextStatus)
                ? events
                : [
                    ...events,
                    { status: nextStatus, elapsedMs: event.elapsedMs },
                  ],
            );
          },
        );
        const incidentId = typeof result === "string" ? result : "";
        if (!incidentId.startsWith("inc-")) {
          throw new Error(
            `Transaction ${hash} was accepted, but the contract did not return an incident id. Check the public record before retrying.`,
          );
        }
        setNewIncidentId(incidentId);
        navigate(`/incidents/${incidentId}`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The transaction failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={ui.stackLoose} data-testid="page-report">
      <div>
        <div className={ui.row} style={{ marginBottom: 6 }}>
          <SyntheticBadge label="Demo submission" />
        </div>
        <h1>Report an incident</h1>
        <p className={ui.lede}>
          File a report against a registered AI system and a specific policy
          version. Evidence is pinned by hash. The record is public and
          permanent.
        </p>
        {IS_DEMO ? (
          <p
            className={`${ui.notice} ${ui.noticeWarn}`}
            style={{ marginTop: 12 }}
          >
            This demo build stores submissions locally in your browser; it does
            not send a transaction. Every record is marked SYNTHETIC.
          </p>
        ) : (
          <p
            className={`${ui.notice} ${ui.noticeWarn}`}
            style={{ marginTop: 12 }}
          >
            This submission writes to the deployed contract on{" "}
            {APP_CONFIG.network}. Your claim and inline evidence become public
            and permanent after the transaction is accepted.
          </p>
        )}
      </div>

      <ol
        className={ui.stepper}
        aria-label="Filing steps"
        data-testid="step-indicator"
      >
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`${ui.step} ${index < step ? ui.stepDone : ""} ${
              index === step ? ui.stepActive : ""
            }`}
            aria-current={index === step ? "step" : undefined}
          >
            <span className={ui.stepDot} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ol>

      <section className={ui.card}>
        <h2 tabIndex={-1} ref={headingRef}>
          {step + 1}. {STEPS[step]}
        </h2>

        {step === 0 ? (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            <label className={ui.field}>
              <span className={ui.label}>AI system</span>
              <select
                className={ui.select}
                value={systemId}
                onChange={(event) => {
                  setSystemId(event.target.value);
                  setPolicyVersion("");
                }}
                required
              >
                <option value="">Choose a system…</option>
                {state.systems.map((entry) => (
                  <option key={entry.system_id} value={entry.system_id}>
                    {entry.display_name} ({entry.system_id})
                  </option>
                ))}
              </select>
            </label>
            {system ? (
              <p className={`${ui.notice} ${ui.noticeWarn}`}>
                {system.claimed
                  ? "Provider claimed. A defense can be filed and shown next to your report."
                  : "Provider not verified. The verdict confidence is capped at MEDIUM and no defense is expected."}
              </p>
            ) : null}
            <label className={ui.field}>
              <span className={ui.label}>Policy version</span>
              <select
                className={ui.select}
                value={policyVersion}
                onChange={(event) => setPolicyVersion(event.target.value)}
                required
                disabled={!system}
              >
                {!system ? (
                  <option value="">Choose a system first</option>
                ) : null}
                {system?.policies.map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    v{entry.version} · effective{" "}
                    {formatDate(entry.effective_at)}
                  </option>
                ))}
              </select>
            </label>
            {policy ? (
              <div className={`${ui.notice}`}>
                <p>
                  <strong>Pinned policy:</strong> v{policy.version} ·{" "}
                  <span className={ui.mono} title={policy.text_hash}>
                    {shortHash(policy.text_hash)}
                  </span>
                </p>
                <p className={ui.hint} style={{ marginTop: 6 }}>
                  {policy.clauses.length} clauses. A later policy version will
                  not apply to this incident.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            <label className={ui.field}>
              <span className={ui.label}>What did the system do?</span>
              <textarea
                className={ui.textarea}
                value={claim}
                onChange={(event) => setClaim(event.target.value)}
                minLength={20}
                maxLength={2000}
                placeholder="Describe the system's behavior and the policy clause it contradicts. This is not a place for personal information."
                required
              />
            </label>
            <p
              className={`${ui.counter} ${claimLength < 20 || claimLength > 2000 ? ui.counterOver : ""}`}
            >
              {claimLength}/2000 · minimum 20
            </p>
            {!claimCheck.ok && claimLength > 0 ? (
              <p className={ui.errorText}>{claimCheck.issues[0]?.message}</p>
            ) : null}
            {piiHits.length > 0 ? (
              <div
                className={`${ui.notice} ${ui.noticeWarn}`}
                aria-live="polite"
              >
                <p>
                  <strong>Possible personal information detected:</strong>{" "}
                  {piiHits
                    .map((hit) => `${hit.kind} “${hit.value}”`)
                    .join(", ")}
                  .
                </p>
                <p className={ui.hint} style={{ marginTop: 6 }}>
                  Remove names, emails, phone numbers, and handles unless they
                  are necessary to explain the system's behavior. On-chain text
                  cannot be deleted.
                </p>
                <label className={ui.checkboxRow} style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={piiAck}
                    onChange={(event) => setPiiAck(event.target.checked)}
                  />
                  <span>
                    This personal information is necessary to describe the
                    system behavior.
                  </span>
                </label>
              </div>
            ) : null}
            <p className={ui.hint}>
              Good example: “The assistant gave a specific prescription dosage
              despite clause C1 forbidding dosage instructions.”
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            <p className={ui.hint}>
              At least one item. URLs must be https and match the evidence
              allowlist: {EVIDENCE_ALLOWLIST.join(", ")}. Inline evidence is
              public and permanent.
            </p>
            {drafts.map((draft, index) => (
              <article
                key={draft.key}
                className={ui.card}
                style={{ boxShadow: "none" }}
              >
                <div className={ui.rowBetween}>
                  <strong>Evidence e{index + 1}</strong>
                  {drafts.length > 1 ? (
                    <button
                      type="button"
                      className={`${ui.button} ${ui.buttonDanger} ${ui.buttonSmall}`}
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter((entry) => entry.key !== draft.key),
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div
                  className={ui.grid2}
                  style={{ display: "grid", marginTop: 10 }}
                >
                  <label className={ui.field}>
                    <span className={ui.label}>Kind</span>
                    <select
                      className={ui.select}
                      value={draft.kind}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          kind: event.target.value as DraftEvidence["kind"],
                          contentSha256: "",
                          maxChars: event.target.value === "url" ? 4000 : 2000,
                        })
                      }
                    >
                      <option value="inline">Inline text</option>
                      <option value="url">Public URL</option>
                    </select>
                  </label>
                  <label className={ui.field}>
                    <span className={ui.label}>Max characters to read</span>
                    <input
                      className={ui.input}
                      type="number"
                      min={200}
                      max={8000}
                      value={draft.maxChars}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          maxChars: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                {draft.kind === "inline" ? (
                  <label className={ui.field}>
                    <span className={ui.label}>Verbatim text</span>
                    <textarea
                      className={ui.textarea}
                      value={draft.text}
                      maxLength={2000}
                      onChange={(event) =>
                        updateDraft(draft.key, {
                          text: event.target.value,
                          contentSha256: "",
                        })
                      }
                      onBlur={() => void hashInline(draft)}
                    />
                  </label>
                ) : (
                  <>
                    <label className={ui.field}>
                      <span className={ui.label}>https URL</span>
                      <input
                        className={ui.input}
                        type="url"
                        placeholder="https://example.com/transcript"
                        value={draft.url}
                        onChange={(event) =>
                          updateDraft(draft.key, {
                            url: event.target.value,
                            contentSha256: "",
                          })
                        }
                      />
                    </label>
                    <label className={ui.field}>
                      <span className={ui.label}>Content sha256</span>
                      <input
                        className={`${ui.input} ${ui.mono}`}
                        placeholder="sha256:<64 hex>"
                        value={draft.contentSha256}
                        onChange={(event) =>
                          updateDraft(draft.key, {
                            contentSha256: event.target.value.trim(),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={`${ui.button} ${ui.buttonSecondary} ${ui.buttonSmall}`}
                      disabled={!draft.url || hashing === draft.key}
                      onClick={() => void fetchAndHash(draft)}
                    >
                      {hashing === draft.key ? "Hashing…" : "Fetch & hash"}
                    </button>
                  </>
                )}
                <label className={ui.field} style={{ marginTop: 10 }}>
                  <span className={ui.label}>
                    Note (optional, for humans; never adjudicated)
                  </span>
                  <input
                    className={ui.input}
                    value={draft.note}
                    maxLength={300}
                    onChange={(event) =>
                      updateDraft(draft.key, { note: event.target.value })
                    }
                  />
                </label>
                <p className={`${ui.hint} ${ui.mono}`}>
                  {draft.contentSha256
                    ? `pinned ${shortHash(draft.contentSha256)}`
                    : draft.kind === "inline"
                      ? "hash is computed when you leave the text field"
                      : "fetch & hash, or paste the hash of what you saw"}
                </p>
              </article>
            ))}
            <div className={ui.row}>
              <button
                type="button"
                className={`${ui.button} ${ui.buttonSecondary}`}
                disabled={drafts.length >= MAX_EVIDENCE_ITEMS}
                onClick={() => setDrafts((current) => [...current, newDraft()])}
              >
                Add inline item
              </button>
              <button
                type="button"
                className={`${ui.button} ${ui.buttonSecondary}`}
                disabled={drafts.length >= MAX_EVIDENCE_ITEMS}
                onClick={() =>
                  setDrafts((current) => [...current, newDraft("url")])
                }
              >
                Add URL item
              </button>
            </div>
            {evidenceError ? (
              <p className={ui.errorText} role="alert">
                {evidenceError}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 && manifest ? (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            <dl className={ui.kv}>
              <dt>System</dt>
              <dd>{system?.display_name}</dd>
              <dt>Policy</dt>
              <dd>
                v{policy?.version} ·{" "}
                <span className={ui.mono}>
                  {shortHash(policy?.text_hash ?? "")}
                </span>
              </dd>
              <dt>Claim</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{claim}</dd>
              <dt>Evidence hash</dt>
              <dd className={ui.mono} title={manifestHash}>
                {manifestHash}
              </dd>
              <dt>Evidence items</dt>
              <dd>{manifest.items.length}</dd>
            </dl>
            <div>
              <h3>Canonical evidence manifest</h3>
              <p className={ui.hint} style={{ marginBottom: 6 }}>
                This exact serialization is hashed and pinned by the contract.
              </p>
              <pre>{canonicalManifest(manifest)}</pre>
            </div>
            <label className={ui.checkboxRow}>
              <input
                type="checkbox"
                checked={permanence}
                onChange={(event) => setPermanence(event.target.checked)}
              />
              <span>
                I understand this incident is permanent and public. Inline
                evidence and my claim cannot be deleted, and the provider cannot
                remove the record.
              </span>
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className={ui.stack} style={{ marginTop: 14 }}>
            <dl className={ui.kv}>
              <dt>Network</dt>
              <dd>
                {IS_DEMO
                  ? "local demo (no transaction)"
                  : `${APP_CONFIG.network} · ${APP_CONFIG.contractAddress}`}
              </dd>
              <dt>Reporter</dt>
              <dd className={ui.mono}>
                {IS_DEMO
                  ? DEMO_ACCOUNT
                  : (wallet.address ?? "Connect wallet to continue")}
              </dd>
              <dt>Evidence hash</dt>
              <dd className={ui.mono}>{shortHash(manifestHash)}</dd>
            </dl>
            {!IS_DEMO && !wallet.address ? (
              <div className={ui.stack}>
                <p className={ui.notice}>
                  Connect a wallet to sign this report. Your form remains in
                  this page.
                </p>
                <button
                  type="button"
                  className={ui.button}
                  onClick={() => void wallet.connect()}
                  disabled={wallet.connecting}
                >
                  {wallet.connecting ? "Connecting…" : "Connect wallet"}
                </button>
              </div>
            ) : !newIncidentId ? (
              <div className={ui.stack}>
                <button
                  type="button"
                  className={ui.button}
                  disabled={
                    submitting ||
                    !permanence ||
                    (!IS_DEMO && !walletOnExpectedNetwork(wallet))
                  }
                  onClick={() => void submit()}
                >
                  {submitting
                    ? "Submitting…"
                    : IS_DEMO
                      ? "Submit incident (demo)"
                      : "Submit incident report"}
                </button>
                {!permanence ? (
                  <p className={ui.hint} role="note">
                    Check the permanence acknowledgement to enable submission.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <TxProgress status={txStatus} events={txEvents} />
                <p className={ui.hint}>
                  {IS_DEMO
                    ? "Demo lifecycle only. No transaction was sent."
                    : "Transaction lifecycle from the GenLayer network. Validators produce any verdict; the reporter does not decide it."}
                </p>
                {newIncidentId ? (
                  <p>
                    <Link
                      className={ui.button}
                      to={`/incidents/${newIncidentId}`}
                    >
                      Open {newIncidentId}
                    </Link>
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <p className={ui.errorText} role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}

        <div className={ui.row} style={{ marginTop: 20 }}>
          {step > 0 && !newIncidentId ? (
            <button
              type="button"
              className={`${ui.button} ${ui.buttonSecondary}`}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Back
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              className={ui.button}
              onClick={() => void goNext()}
            >
              Continue
            </button>
          ) : null}
          {step === 3 ? (
            <button
              type="button"
              className={ui.button}
              onClick={() => void goNext()}
            >
              Continue to submit
            </button>
          ) : null}
        </div>
      </section>

      <p className={ui.hint}>
        Filing does not decide legality. The verdict is a policy compliance
        finding against the provider's own published policy.
      </p>
    </div>
  );
}
