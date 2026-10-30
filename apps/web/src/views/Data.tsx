import { useState } from "react";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { policyGaps } from "../data/store";
import { emptyRecordState, useRecordIndex } from "../lib/data";
import { buildDataset, downloadText, gapReport } from "../lib/exports";
import { shortHash } from "../lib/format";
import { NETWORK, SAFETYNET_ADDRESS } from "../lib/network";
import { Link } from "../lib/router";

const SNIPPETS: { title: string; code: string }[] = [
  {
    title: "Export with the CLI",
    code: `snet export incidents --format json --out data/incidents.json
snet export verdicts --format json --out data/verdicts.json
snet export policy-gaps --format md --out data/policy-gaps.md`,
  },
  {
    title: "Read one incident",
    code: `import { createClient } from "@safetynet/client";

const client = createClient({ network: "studionet" });
const sn = client.contract(SAFETYNET_ADDRESS);
const incident = await sn.read.get_incident(["inc-000001"]);`,
  },
  {
    title: "Read the latest verdict",
    code: `const verdict = await sn.read.get_verdict(["inc-000001"]);
if (verdict) {
  console.log(verdict.verdict, verdict.severity, verdict.clauses);
}`,
  },
  {
    title: "List a system's incidents",
    code: `const ids = await sn.read.list_incidents_by_system(["synthetic-chatbot-1"]);
for (const id of ids) {
  console.log(id, await sn.read.get_verdict([id]));
}`,
  },
  {
    title: "Check the deployed domain config",
    code: `const config = await sn.read.get_config();
// maxEvidenceItems, maxEvidenceBytes, appealWindowHours, maxAppeals, …`,
  },
];

export function Data() {
  const index = useRecordIndex();
  const state =
    index.status === "ready" ? index.state : emptyRecordState();
  const groups = policyGaps(state);
  const [status, setStatus] = useState<"idle" | "building" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const meta = { network: NETWORK, contract: SAFETYNET_ADDRESS };

  const download = async () => {
    setStatus("building");
    setError(null);
    try {
      const dataset = await buildDataset(state, meta);
      downloadText(
        "safetynet-incidents.json",
        JSON.stringify(dataset, null, 2),
        "application/json",
      );
      setStatus("done");
    } catch (buildError) {
      setStatus("idle");
      setError(
        buildError instanceof Error
          ? buildError.message
          : "Could not build the export.",
      );
    }
  };

  return (
    <div className={ui.stackLoose} data-testid="page-data">
      <div className={ui.pageHead}>
        <div>
          <div className={ui.row} style={{ marginBottom: 6 }}>
            <SyntheticBadge />
          </div>
          <h1>Open data</h1>
          <p className={ui.lede}>
            The chain is the database. This page documents the public export
            shape and lets you download the synthetic demo record. Exports
            contain hashes and verdicts, never claim text or inline evidence.
          </p>
        </div>
        <div className={ui.row}>
          <button
            type="button"
            className={ui.button}
            disabled={status === "building"}
            onClick={() => void download()}
          >
            {status === "building" ? "Building…" : "Download dataset (JSON)"}
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSecondary}`}
            disabled={groups.length === 0}
            onClick={() =>
              downloadText(
                "policy-gaps.md",
                gapReport(groups, meta),
                "text/markdown",
              )
            }
          >
            Policy gaps (Markdown)
          </button>
        </div>
      </div>

      {error ? (
        <p className={ui.errorText} role="alert">
          {error}
        </p>
      ) : null}
      {status === "done" ? (
        <p className={`${ui.notice} ${ui.noticeOk}`}>
          Dataset downloaded. The export is labeled SYNTHETIC and excludes claim
          text and inline evidence.
        </p>
      ) : null}

      <section className={ui.grid3} aria-label="Dataset summary">
        <div className={ui.stat}>
          <div className={ui.statValue}>{state.incidents.length}</div>
          <div className={ui.statLabel}>Incidents</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statValue}>
            {state.incidents.filter((incident) => incident.verdict).length}
          </div>
          <div className={ui.statLabel}>Verdicts</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statValue}>{state.systems.length}</div>
          <div className={ui.statLabel}>Systems</div>
        </div>
        <div className={ui.stat}>
          <div className={ui.statValue}>
            {state.systems.reduce(
              (sum, system) => sum + system.policies.length,
              0,
            )}
          </div>
          <div className={ui.statLabel}>Policy versions</div>
        </div>
      </section>

      <section>
        <div className={ui.sectionHead}>
          <h2>Dataset schema</h2>
          <span className={ui.hint}>schemaVersion 1</span>
        </div>
        <div className={ui.card}>
          <dl className={ui.kv}>
            <dt>generatedAt</dt>
            <dd>ISO 8601 timestamp</dd>
            <dt>network / contract</dt>
            <dd>
              {NETWORK} · <span className={ui.mono}>{SAFETYNET_ADDRESS}</span>
            </dd>
            <dt>synthetic</dt>
            <dd>Always true in this demo build</dd>
            <dt>policies[]</dt>
            <dd>systemId, version, textHash, clauseIds, clauseCount, url</dd>
            <dt>incidents[]</dt>
            <dd>
              incidentId, systemId, policyVersion, policyHash, status, filedAt,
              claimSha256, evidenceHash, evidenceKinds, verdict (or null)
            </dd>
            <dt>Excluded</dt>
            <dd>
              Claim text, inline evidence text, reporter identity beyond the
              on-chain address
            </dd>
          </dl>
        </div>
      </section>

      <section>
        <div className={ui.sectionHead}>
          <h2>Preview</h2>
          <Link to="/incidents">Open the full record →</Link>
        </div>
        {state.incidents.length === 0 ? (
          <EmptyState
            title="No incidents to export"
            action="File an incident"
            actionTo="/report"
          >
            The record is empty.
          </EmptyState>
        ) : (
          <div className={ui.tableWrap}>
            <table>
              <caption>Hashes-only export preview (newest first)</caption>
              <thead>
                <tr>
                  <th scope="col">Incident</th>
                  <th scope="col">System</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Evidence hash</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...state.incidents]
                  .sort((a, b) => b.filed_at - a.filed_at)
                  .map((incident) => (
                    <tr key={incident.incident_id}>
                      <td>
                        <Link
                          className={ui.mono}
                          to={`/incidents/${incident.incident_id}`}
                        >
                          {incident.incident_id}
                        </Link>
                      </td>
                      <td>{incident.system_name}</td>
                      <td>
                        <VerdictBadge verdict={incident.verdict?.verdict} />
                      </td>
                      <td className={ui.mono} title={incident.evidence_hash}>
                        {shortHash(incident.evidence_hash)}
                      </td>
                      <td className={ui.hint}>{incident.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Query snippets</h2>
        <p className={ui.lede} style={{ marginBottom: 12 }}>
          There is no backend in v1. Read the chain through the typed client, or
          consume the static export. The snippets below are copy-pasteable.
        </p>
        <div className={ui.stack}>
          {SNIPPETS.map((snippet) => (
            <Card key={snippet.title}>
              <h3>{snippet.title}</h3>
              <pre style={{ marginTop: 10 }}>{snippet.code}</pre>
            </Card>
          ))}
        </div>
      </section>

      <section className={`${ui.notice} ${ui.noticeWarn}`}>
        <strong>Data licensing.</strong> Code is MIT. Docs and templated verdict
        text are CC-BY-4.0. Incident claims and inline evidence remain the
        reporter's; the public export excludes them by default. Policy documents
        belong to the provider and are linked and hashed, not redistributed.
      </section>
    </div>
  );
}
