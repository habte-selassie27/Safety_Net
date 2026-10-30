import { useEffect, useState } from "react";

import {
  sha256Text,
  validateDefense,
  canonicalManifest,
  policyTextHash,
} from "@safetynet/core/validate";
import { EmptyState } from "../components/EmptyState";
import { SeverityChips } from "../components/SeverityChips";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { APPEAL_WINDOW_HOURS, DEMO_ACCOUNT, MAX_APPEALS } from "../data/seed";
import { demoStore, useDemoState } from "../data/store";
import type {
  EvidenceManifestView,
  IncidentView,
  PolicyView,
  SystemView,
} from "../data/types";
import {
  formatDate,
  formatDateTime,
  hoursRemaining,
  shortAddress,
} from "../lib/format";
import { APP_CONFIG, IS_DEMO } from "../lib/config";
import { submitContractWrite } from "../lib/data";
import { useWallet, walletOnExpectedNetwork } from "../lib/wallet";
import { Link, useRoute } from "../lib/router";

interface EditableClause {
  id: string;
  title: string;
  text: string;
  mandatory: boolean;
}

function clausesFromPolicy(policy: PolicyView | undefined): EditableClause[] {
  if (!policy) {
    return [{ id: "C1", title: "", text: "", mandatory: false }];
  }
  return policy.clauses.map((clause) => ({ ...clause }));
}

function parseClauseDrafts(text: string): EditableClause[] {
  const heading = /^##\s+(C\d+)\s*[—–-]\s*(.+)$/gm;
  const matches = [...text.matchAll(heading)];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1]?.index ?? text.length)
        : text.length;
    return {
      id: match[1] ?? `C${index + 1}`,
      title: (match[2] ?? "").trim(),
      text: text.slice(start, end).trim(),
      mandatory: false,
    };
  });
}

const POLICY_TEMPLATE = `## C1 — Medical boundaries
The system must not provide specific prescription dosages.

## C2 — Uncertainty disclosure
The system must disclose uncertainty when it lacks information.
`;

function RegisterSystemForm({ actor }: { actor: string }) {
  const [systemId, setSystemId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [policyUrl, setPolicyUrl] = useState("https://example.com/policy");
  const [policyText, setPolicyText] = useState(POLICY_TEMPLATE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const register = async () => {
    setError(null);
    setNotice(null);
    const clauses = parseClauseDrafts(policyText);
    if (clauses.length === 0) {
      setError("The policy needs at least one '## C1 — Title' clause heading.");
      return;
    }
    const clauseIds = clauses.map((clause) => clause.id);
    const hash = await sha256Text(policyText);

    if (!IS_DEMO) {
      if (!actor) {
        setError("Connect a wallet to register a system.");
        return;
      }
      setBusy(true);
      try {
        const { hash: txHash } = await submitContractWrite<string>(
          (window as unknown as { ethereum?: unknown }).ethereum,
          actor,
          "register_system",
          [
            systemId.trim(),
            displayName.trim(),
            providerId.trim(),
            version.trim(),
            hash,
            clauseIds,
            policyUrl.trim(),
          ],
          () => {},
        );
        setNotice(`System registered (tx ${txHash.slice(0, 10)}…).`);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Registration failed.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    const result = demoStore.registerSystem({
      system_id: systemId.trim(),
      display_name: displayName.trim() || systemId.trim(),
      provider_id: providerId.trim() || "unclaimed-provider",
      policy_version: version.trim(),
      policy_text_hash: hash,
      clause_ids: clauseIds,
      policy_url: policyUrl.trim(),
      clauses,
      ...(actor ? { actor } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(`${result.code}: ${result.message}`);
      return;
    }
    setNotice(`Registered ${result.value} with policy v${version.trim()}.`);
    setSystemId("");
    setDisplayName("");
    setProviderId("");
  };

  return (
    <section className={ui.card} data-testid="register-system">
      <h2>Register a system</h2>
      <p className={ui.hint} style={{ marginBottom: 10 }}>
        A system needs a published policy version before an incident can pin it.
        The policy hash is what validators later judge against.
      </p>
      <label className={ui.field}>
        <span className={ui.label}>System id (lowercase, 3–48)</span>
        <input
          className={ui.input}
          value={systemId}
          onChange={(event) => setSystemId(event.target.value)}
          placeholder="acme-assistant"
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>Display name</span>
        <input
          className={ui.input}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Acme Assistant"
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>Provider id</span>
        <input
          className={ui.input}
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          placeholder="acme"
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>Policy version</span>
        <input
          className={ui.input}
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          placeholder="1.0.0"
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>Policy URL</span>
        <input
          className={ui.input}
          value={policyUrl}
          onChange={(event) => setPolicyUrl(event.target.value)}
        />
      </label>
      <label className={ui.field}>
        <span className={ui.label}>Policy text (## C1 — Title)</span>
        <textarea
          className={ui.textarea}
          value={policyText}
          onChange={(event) => setPolicyText(event.target.value)}
          rows={8}
        />
      </label>
      {error ? (
        <p className={ui.errorText} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={`${ui.notice} ${ui.noticeOk}`}>{notice}</p>
      ) : null}
      <button
        type="button"
        className={ui.button}
        disabled={busy}
        onClick={() => void register()}
      >
        {busy ? "Registering…" : "Register system"}
      </button>
    </section>
  );
}

function PolicyForm({ system, actor }: { system: SystemView; actor: string }) {
  const current = system.policies.find(
    (policy) => policy.version === system.current_policy,
  );
  const [version, setVersion] = useState("");
  const [url, setUrl] = useState(current?.url ?? "");
  const [supersedes, setSupersedes] = useState(system.current_policy);
  const [clauses, setClauses] = useState<EditableClause[]>(() =>
    clausesFromPolicy(current),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateClause = (index: number, patch: Partial<EditableClause>) => {
    setClauses((entries) =>
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!IS_DEMO) {
      if (!actor) {
        setError("Connect a wallet to publish a policy.");
        return;
      }
      setBusy(true);
      try {
        const clauseIds = clauses.map((_, i) => `C${i + 1}`);
        const policyText = [
          "---",
          `Policy-Version: ${version.trim()}`,
          `Provider: ${system.provider_id}`,
          `Effective-Date: ${new Date().toISOString().slice(0, 10)}`,
          `Policy-URL: ${url.trim()}`,
          `Clause-Count: ${clauses.length}`,
          "---",
          "",
          ...clauses.map(
            (c, i) =>
              `## C${i + 1} — ${c.title.trim()}\n\n${c.text.trim()}\n`,
          ),
        ].join("\n");
        const hash = await policyTextHash(policyText);
        const { hash: txHash } = await submitContractWrite<string>(
          (window as unknown as { ethereum?: unknown }).ethereum,
          actor,
          "publish_policy",
          [system.system_id, version.trim(), hash, clauseIds, url.trim()],
          () => {},
        );
        setNotice(`Policy v${version.trim()} published (tx ${txHash.slice(0, 10)}…).`);
        setVersion("");
        setSupersedes(version.trim());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Publish failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    const result = await demoStore.publishPolicy(
      system.system_id,
      version.trim(),
      url.trim(),
      clauses.map((clause, index) => ({
        id: `C${index + 1}`,
        title: clause.title.trim(),
        text: clause.text.trim(),
        mandatory: clause.mandatory,
      })),
      supersedes.trim(),
      actor,
    );
    setBusy(false);
    if (!result.ok) {
      setError(`${result.code}: ${result.message}`);
      return;
    }
    setNotice(
      `Policy v${version.trim()} published locally. Published versions are immutable.`,
    );
    setVersion("");
    setSupersedes(version.trim());
  };

  return (
    <form
      className={ui.card}
      data-testid="publish-policy-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={ui.grid2}>
        <label className={ui.field}>
          <span className={ui.label}>New version</span>
          <input
            className={ui.input}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="1.1.0"
            required
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Supersedes</span>
          <input
            className={ui.input}
            value={supersedes}
            onChange={(event) => setSupersedes(event.target.value)}
            placeholder={system.current_policy}
          />
        </label>
      </div>
      <label className={ui.field}>
        <span className={ui.label}>Public https URL for the policy text</span>
        <input
          className={ui.input}
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/safety-policy-1.1.0"
          required
        />
      </label>
      <p className={ui.hint}>
        The contract stores the text hash, clause ids, and URL. The full text
        stays at the URL and is fetched by validators. Versions cannot be edited
        after publishing.
      </p>

      <div className={ui.stack} style={{ marginTop: 14 }}>
        {clauses.map((clause, index) => (
          <article key={`${clause.id}-${index}`} className={ui.clause}>
            <div className={ui.rowBetween}>
              <strong>C{index + 1}</strong>
              {clauses.length > 1 ? (
                <button
                  type="button"
                  className={`${ui.button} ${ui.buttonDanger} ${ui.buttonSmall}`}
                  onClick={() =>
                    setClauses((entries) =>
                      entries.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className={ui.field} style={{ marginTop: 8 }}>
              <span className={ui.label}>Short title</span>
              <input
                className={ui.input}
                value={clause.title}
                onChange={(event) =>
                  updateClause(index, { title: event.target.value })
                }
                maxLength={80}
                required
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>
                Clause text (50–2,000 characters, independently checkable)
              </span>
              <textarea
                className={ui.textarea}
                value={clause.text}
                onChange={(event) =>
                  updateClause(index, { text: event.target.value })
                }
                minLength={50}
                maxLength={2000}
                required
              />
            </label>
            <label className={ui.checkboxRow} style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={clause.mandatory}
                onChange={(event) =>
                  updateClause(index, { mandatory: event.target.checked })
                }
              />
              <span>
                Mandatory: a single violation can support a POLICY_VIOLATION
                verdict.
              </span>
            </label>
          </article>
        ))}
      </div>

      <div className={ui.row} style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`${ui.button} ${ui.buttonSecondary}`}
          disabled={clauses.length >= 24}
          onClick={() =>
            setClauses((entries) => [
              ...entries,
              {
                id: `C${entries.length + 1}`,
                title: "",
                text: "",
                mandatory: false,
              },
            ])
          }
        >
          Add clause
        </button>
        <button type="submit" className={ui.button} disabled={busy}>
          {busy ? "Publishing…" : "Publish policy version"}
        </button>
      </div>
      {notice ? (
        <p className={`${ui.notice} ${ui.noticeOk}`} style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={ui.errorText} role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

function RespondForm({
  incident,
  actor,
}: { incident: IncidentView; actor: string }) {
  const [defense, setDefense] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const defenseCheck = validateDefense(defense);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!defenseCheck.ok) {
      setError(defenseCheck.issues[0]?.message ?? "Invalid defense.");
      return;
    }
    setBusy(true);
    let manifest: EvidenceManifestView | undefined;
    if (evidence.trim()) {
      const hash = await sha256Text(evidence);
      manifest = {
        schemaVersion: 1 as const,
        items: [
          {
            id: "e1",
            kind: "inline" as const,
            text: evidence,
            contentSha256: hash,
            maxChars: 2000,
            note: "Provider response evidence",
          },
        ],
      };
    }
    if (!IS_DEMO) {
      if (!actor) {
        setError("Connect a wallet to respond.");
        setBusy(false);
        return;
      }
      const manifestText = manifest ? canonicalManifest(manifest) : "";
      const evidenceHash = manifest
        ? `sha256:${await sha256Text(canonicalManifest(manifest))}`
        : "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      try {
        const { hash } = await submitContractWrite<string>(
          (window as unknown as { ethereum?: unknown }).ethereum,
          actor,
          "provider_respond",
          [incident.incident_id, defense, evidenceHash, manifestText],
          () => {},
        );
        setNotice(`Response submitted (tx ${hash.slice(0, 10)}…).`);
        setDefense("");
        setEvidence("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Response failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const result = await demoStore.respond(
      incident.incident_id,
      defense,
      manifest,
      actor,
    );
    setBusy(false);
    if (!result.ok) {
      setError(`${result.code}: ${result.message}`);
      return;
    }
    setNotice("Response recorded locally. It will be shown next to the claim.");
    setDefense("");
    setEvidence("");
  };

  return (
    <form
      className={ui.stack}
      style={{ marginTop: 12 }}
      data-testid="respond-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className={ui.field} style={{ marginBottom: 0 }}>
        <span className={ui.label}>Defense (20–4,000 characters)</span>
        <textarea
          className={ui.textarea}
          value={defense}
          onChange={(event) => setDefense(event.target.value)}
          minLength={20}
          maxLength={4000}
          placeholder="Address the cited clause directly. Do not repeat personal information."
          required
        />
      </label>
      <p
        className={`${ui.counter} ${defense.length < 20 ? ui.counterOver : ""}`}
      >
        {defense.length}/4000
      </p>
      <label className={ui.field} style={{ marginBottom: 0 }}>
        <span className={ui.label}>
          Response evidence (inline, optional in this demo)
        </span>
        <textarea
          className={ui.textarea}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          maxLength={2000}
          placeholder="A log line, model card excerpt, or retention record. It will be public."
        />
      </label>
      <p className={ui.hint}>
        Evidence from the provider is public and pinned by hash. On-chain, a
        response requires a bounded evidence manifest.
      </p>
      <div className={ui.row}>
        <button
          type="submit"
          className={ui.button}
          disabled={busy || !defenseCheck.ok}
        >
          {busy ? "Submitting…" : "Submit defense"}
        </button>
      </div>
      {notice ? (
        <p className={`${ui.notice} ${ui.noticeOk}`}>{notice}</p>
      ) : null}
      {error ? (
        <p className={ui.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function AppealForm({
  incident,
  actor,
}: { incident: IncidentView; actor: string }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!IS_DEMO) {
      // Chain mode: actor is the wallet; pass a dummy for demo parity.
      try {
        const { hash } = await submitContractWrite<string>(
          (window as unknown as { ethereum?: unknown }).ethereum,
          actor,
          "appeal",
          [incident.incident_id, reason],
          () => {},
        );
        setNotice(`Appeal submitted (tx ${hash.slice(0, 10)}…).`);
        setReason("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Appeal failed.");
      }
      return;
    }
    const result = demoStore.appeal(incident.incident_id, reason, actor);
    if (!result.ok) {
      setError(`${result.code}: ${result.message}`);
      return;
    }
    setNotice(
      "Appeal recorded locally. A new adjudication round is required before a new verdict.",
    );
    setReason("");
  };

  return (
    <form
      style={{ marginTop: 10 }}
      data-testid="appeal-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className={ui.field}>
        <span className={ui.label}>Appeal reason (20–500 characters)</span>
        <textarea
          className={ui.textarea}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={20}
          maxLength={500}
          required
        />
      </label>
      <p
        className={`${ui.counter} ${reason.length < 20 ? ui.counterOver : ""}`}
      >
        {reason.length}/500
      </p>
      <button
        type="submit"
        className={`${ui.button} ${ui.buttonSmall}`}
        disabled={reason.trim().length < 20}
      >
        File appeal
      </button>
      {notice ? (
        <p className={`${ui.notice} ${ui.noticeOk}`} style={{ marginTop: 10 }}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={ui.errorText} role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function Provider() {
  const route = useRoute();
  const state = useDemoState();
  const wallet = useWallet();
  const initial = route.params.get("system");
  const [systemId, setSystemId] = useState(
    state.systems.some((system) => system.system_id === initial)
      ? (initial as string)
      : (state.systems[0]?.system_id ?? ""),
  );
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [openRespond, setOpenRespond] = useState<string | null>(null);
  const [openAppeal, setOpenAppeal] = useState<string | null>(null);

  const system = state.systems.find((entry) => entry.system_id === systemId);
  const actor = IS_DEMO
    ? system?.claimed
      ? system.claimed_by
      : DEMO_ACCOUNT
    : (wallet.address ?? "");

  useEffect(() => {
    if (!state.systems.some((entry) => entry.system_id === systemId)) {
      setSystemId(state.systems[0]?.system_id ?? "");
    }
  }, [state.systems, systemId]);

  const openIncidents = system
    ? state.incidents
        .filter(
          (incident) =>
            incident.system_id === system.system_id &&
            (incident.status === "OPEN" || incident.status === "RESPONDED"),
        )
        .sort((a, b) => a.response_deadline - b.response_deadline)
    : [];

  const decided = system
    ? state.incidents
        .filter(
          (incident) =>
            incident.system_id === system.system_id &&
            incident.verdict &&
            (incident.status === "DECIDED" || incident.status === "APPEALED"),
        )
        .sort((a, b) => (b.verdict?.ruled_at ?? 0) - (a.verdict?.ruled_at ?? 0))
    : [];

  const windowMs = APPEAL_WINDOW_HOURS * 3600 * 1000;

  const claim = async () => {
    if (!system) return;
    setClaimError(null);
    setClaimNotice(null);
    if (!IS_DEMO) {
      if (!wallet.address) {
        setClaimError("Connect a wallet to claim this system.");
        return;
      }
      if (!walletOnExpectedNetwork(wallet)) {
        setClaimError(`Switch your wallet to ${APP_CONFIG.network}.`);
        return;
      }
      try {
        const { hash } = await submitContractWrite<string>(
          (window as unknown as { ethereum?: unknown }).ethereum,
          wallet.address,
          "claim_system",
          [system.system_id],
          () => {},
        );
        setClaimNotice(`Claim submitted (tx ${hash.slice(0, 10)}…).`);
      } catch (cause) {
        setClaimError(cause instanceof Error ? cause.message : "Claim failed.");
      }
      return;
    }
    const result = demoStore.claimSystem(system.system_id);
    if (!result.ok) {
      setClaimError(`${result.code}: ${result.message}`);
      return;
    }
    setClaimNotice(
      "System claimed locally by the demo account. In v1 claiming is first-come and unverified.",
    );
  };

  if (!system) {
    return (
      <div className={ui.stackLoose} data-testid="page-provider">
        <div className={ui.pageHead}>
          <div>
            <div className={ui.row} style={{ marginBottom: 6 }}>
              <SyntheticBadge label="Local demo console" />
            </div>
            <h1>Provider console</h1>
            <p className={ui.lede}>
              Nothing is registered yet. Register a system and publish its first
              policy version; incidents can then pin that exact version.
            </p>
          </div>
        </div>
        <EmptyState title="No systems registered" action="Back home" actionTo="/">
          A system needs a published policy version before an incident can be
          filed against it.
        </EmptyState>
        <RegisterSystemForm actor={actor} />
      </div>
    );
  }

  return (
    <div className={ui.stackLoose} data-testid="page-provider">
      <div className={ui.pageHead}>
        <div>
          <div className={ui.row} style={{ marginBottom: 6 }}>
            <SyntheticBadge label="Local demo console" />
          </div>
          <h1>Provider console</h1>
          <p className={ui.lede}>
            Claim a system, answer open incidents, appeal a verdict, and publish
            policy versions. This demo build acts locally; no wallet signature
            is requested.
          </p>
        </div>
        <Link className={`${ui.button} ${ui.buttonSecondary}`} to="/incidents">
          Public record
        </Link>
      </div>

      {!IS_DEMO ? (
        <section className={ui.card} data-testid="wallet-connect">
          <p className={ui.hint} style={{ marginBottom: 8 }}>
            Connect the claimed provider wallet to sign claim, response, appeal,
            and policy actions.
          </p>
          {!wallet.address ? (
            <button
              type="button"
              className={ui.button}
              onClick={() => void wallet.connect()}
              disabled={wallet.connecting}
            >
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <p className={ui.hint}>
              Connected: {wallet.address}
              {!walletOnExpectedNetwork(wallet)
                ? " — switch to the expected network."
                : ""}
            </p>
          )}
        </section>
      ) : null}

      <section className={ui.card} data-testid="provider-systems">
        <label className={ui.field}>
          <span className={ui.label}>System</span>
          <select
            className={ui.select}
            value={systemId}
            onChange={(event) => {
              setSystemId(event.target.value);
              setOpenRespond(null);
              setOpenAppeal(null);
              setClaimNotice(null);
              setClaimError(null);
            }}
          >
            {state.systems.map((entry) => (
              <option key={entry.system_id} value={entry.system_id}>
                {entry.display_name} ({entry.system_id})
              </option>
            ))}
          </select>
        </label>

        {system.claimed ? (
          <p className={ui.notice}>
            <strong>Provider of record:</strong>{" "}
            {shortAddress(system.claimed_by)}{" "}
            <span className={`${ui.mono} ${ui.hint}`}>{system.claimed_by}</span>
            <br />
            {system.claimed_by.toLowerCase() === DEMO_ACCOUNT.toLowerCase()
              ? "Acting as the demo account that claimed this system."
              : "Demo mode acts as this provider so the response and appeal flows can be exercised. A production build requires a wallet signature from the claimed address."}
          </p>
        ) : (
          <div className={ui.stack}>
            <p className={`${ui.notice} ${ui.noticeWarn}`}>
              <strong>Unclaimed system.</strong> Incidents can still be filed.
              Confidence is capped at MEDIUM until a provider claims the system
              and responds.
            </p>
            <button type="button" className={ui.button} onClick={claim}>
              Claim this system as the demo account
            </button>
            {claimNotice ? (
              <p className={`${ui.notice} ${ui.noticeOk}`}>{claimNotice}</p>
            ) : null}
            {claimError ? (
              <p className={ui.errorText} role="alert">
                {claimError}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section
        id="open"
        aria-labelledby="open-heading"
        data-testid="provider-open-incidents"
      >
        <div className={ui.sectionHead}>
          <h2 id="open-heading">Open & responded incidents</h2>
          <span className={ui.hint}>
            Response window from the chain timestamp
          </span>
        </div>
        {openIncidents.length === 0 ? (
          <EmptyState
            title="No open incidents for this system"
            action="File a synthetic test incident"
            actionTo={`/report?system=${system.system_id}`}
          >
            Open incidents appear here until a defense is filed or the response
            window closes.
          </EmptyState>
        ) : (
          <div className={ui.stack}>
            {openIncidents.map((incident) => {
              const remaining = hoursRemaining(incident.response_deadline);
              const late = Date.now() > incident.response_deadline;
              return (
                <article
                  key={incident.incident_id}
                  className={ui.card}
                  data-testid="provider-incident-row"
                >
                  <div className={ui.rowBetween}>
                    <div>
                      <strong>
                        <Link
                          className={ui.mono}
                          to={`/incidents/${incident.incident_id}`}
                        >
                          {incident.incident_id}
                        </Link>
                      </strong>
                      <p className={ui.hint} style={{ marginTop: 4 }}>
                        Filed {formatDate(incident.filed_at)} · policy v
                        {incident.policy_version}
                      </p>
                    </div>
                    <span className={ui.badge} data-verdict={incident.status}>
                      {incident.status === "RESPONDED"
                        ? "Responded"
                        : late
                          ? "Response window closed"
                          : `${remaining}h to respond`}
                    </span>
                  </div>
                  <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                    {incident.claim}
                  </p>
                  <p
                    className={`${ui.hint} ${ui.mono}`}
                    style={{ marginTop: 8 }}
                  >
                    evidence {incident.evidence_hash.slice(0, 18)}… · deadline{" "}
                    {formatDateTime(incident.response_deadline)}
                  </p>
                  {incident.status === "RESPONDED" ? (
                    <div
                      className={`${ui.notice} ${ui.noticeOk}`}
                      style={{ marginTop: 10 }}
                    >
                      <strong>Response recorded.</strong> Awaiting adjudication
                      by validators.
                      {incident.response ? (
                        <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                          {incident.response.defense}
                        </p>
                      ) : null}
                    </div>
                  ) : !system.claimed ? (
                    <p
                      className={`${ui.notice} ${ui.noticeWarn}`}
                      style={{ marginTop: 10 }}
                    >
                      Claim this system to submit a defense.
                    </p>
                  ) : openRespond === incident.incident_id ? (
                    <RespondForm
                      key={incident.incident_id}
                      incident={incident}
                      actor={actor}
                    />
                  ) : (
                    <div className={ui.row} style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className={ui.button}
                        onClick={() => setOpenRespond(incident.incident_id)}
                      >
                        Respond
                      </button>
                      <button
                        type="button"
                        className={`${ui.button} ${ui.buttonSecondary}`}
                        onClick={() => setOpenRespond(null)}
                      >
                        Not now
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="appeal-heading">
        <div className={ui.sectionHead}>
          <h2 id="appeal-heading">Decided incidents</h2>
          <span className={ui.hint}>
            {MAX_APPEALS} appeal round per incident in v1
          </span>
        </div>
        {decided.length === 0 ? (
          <EmptyState title="No decided incidents for this system">
            A verdict appears here once validators converge. Appeals are
            time-boxed.
          </EmptyState>
        ) : (
          <div className={ui.stack}>
            {decided.map((incident) => {
              const verdict = incident.verdict;
              if (!verdict) return null;
              const remaining = hoursRemaining(verdict.ruled_at + windowMs);
              const eligible =
                incident.status !== "FINAL" &&
                incident.appeals.length < MAX_APPEALS &&
                remaining > 0;
              return (
                <article key={incident.incident_id} className={ui.card}>
                  <div className={ui.rowBetween}>
                    <div>
                      <strong>
                        <Link
                          className={ui.mono}
                          to={`/incidents/${incident.incident_id}`}
                        >
                          {incident.incident_id}
                        </Link>
                      </strong>
                      <p className={ui.hint} style={{ marginTop: 4 }}>
                        Ruled {formatDateTime(verdict.ruled_at)} · round{" "}
                        {verdict.round}
                      </p>
                    </div>
                    <div className={ui.row}>
                      <VerdictBadge verdict={verdict.verdict} />
                      <SeverityChips severity={verdict.severity} />
                    </div>
                  </div>
                  <p style={{ marginTop: 10 }}>{verdict.rationale}</p>
                  <p className={ui.hint} style={{ marginTop: 8 }}>
                    {incident.status === "FINAL"
                      ? "Final — no further appeals."
                      : incident.status === "APPEALED"
                        ? "Appeal recorded. Awaiting re-adjudication."
                        : incident.appeals.length >= MAX_APPEALS
                          ? "No appeals remaining."
                          : remaining > 0
                            ? `${remaining}h left in the appeal window.`
                            : "Appeal window closed."}
                  </p>
                  {eligible ? (
                    openAppeal === incident.incident_id ? (
                      <AppealForm
                        key={incident.incident_id}
                        incident={incident}
                        actor={actor}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${ui.button} ${ui.buttonSecondary} ${ui.buttonSmall}`}
                        style={{ marginTop: 10 }}
                        onClick={() => setOpenAppeal(incident.incident_id)}
                      >
                        Appeal this verdict
                      </button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <details className={ui.card} data-testid="register-system-disclosure">
        <summary style={{ cursor: "pointer" }}>
          Register another system and policy version
        </summary>
        <div style={{ marginTop: 12 }}>
          <RegisterSystemForm actor={actor} />
        </div>
      </details>

      <section aria-labelledby="policy-heading">
        <div className={ui.sectionHead}>
          <h2 id="policy-heading">Publish a policy version</h2>
          <span className={ui.hint}>Current v{system.current_policy}</span>
        </div>
        {system.claimed ? (
          <PolicyForm key={system.system_id} system={system} actor={actor} />
        ) : (
          <p className={`${ui.notice} ${ui.noticeWarn}`}>
            Claim the system before publishing a policy version.
          </p>
        )}
      </section>

      <p className={ui.hint}>
        The provider cannot delete or edit an incident. Claiming a system is
        first-come in v1 and does not prove ownership beyond the recorded
        address.
      </p>
    </div>
  );
}
