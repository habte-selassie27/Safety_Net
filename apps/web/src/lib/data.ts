import { useEffect, useState } from "react";
import {
  type ClientAdapter,
  type TrackedTx,
  createClient,
} from "@safetynet/client";
import { createGenLayerAdapter } from "@safetynet/client";
import { DEMO_ACCOUNT, EVIDENCE_ALLOWLIST } from "../data/seed";
import { demoStore, useDemoState } from "../data/store";
import type {
  DemoState,
  EvidenceManifestView,
  IncidentView,
  PolicyView,
  ResponseView,
  SafetyNetVerdict,
  SystemView,
} from "../data/types";
import { type SafetyNetAPI, SafetyNetDecoders } from "../generated/SafetyNet";
import { APP_CONFIG, IS_DEMO } from "./config";
import { SAFETYNET_ADDRESS } from "./network";

type RecordValue = Record<string, unknown>;

function object(value: unknown): RecordValue {
  if (typeof value === "string") {
    try {
      return object(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as RecordValue) : {};
}

function numeric(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizePolicy(raw: unknown): PolicyView {
  const value = object(raw);
  const ids = stringList(value.clause_ids);
  return {
    system_id: text(value.system_id),
    version: text(value.version),
    text_hash: text(value.text_hash),
    clause_ids: ids,
    published_at:
      numeric(value.published_at) *
      (numeric(value.published_at) < 10_000_000_000 ? 1000 : 1),
    effective_at:
      numeric(value.effective_at) *
      (numeric(value.effective_at) < 10_000_000_000 ? 1000 : 1),
    url: text(value.url),
    supersedes: text(value.supersedes),
    // Policy text is not included in the on-chain view; it remains unavailable
    // until the fetched document can be verified against text_hash.
    clauses: [],
  };
}

function normalizeSystem(
  raw: unknown,
  policies: PolicyView[] = [],
): SystemView {
  const value = object(raw);
  const policyKey = text(value.policy_key);
  const currentPolicy = policyKey.split("@").slice(1).join("@");
  const claimedBy = text(value.claimed_by);
  return {
    system_id: text(value.system_id),
    display_name: text(value.display_name),
    provider_id: text(value.provider_id),
    policy_key: policyKey,
    claimed_by: claimedBy,
    created_at:
      numeric(value.created_at) *
      (numeric(value.created_at) < 10_000_000_000 ? 1000 : 1),
    claimed: Boolean(claimedBy),
    policies,
    current_policy: currentPolicy,
  };
}

function parseEvidence(raw: unknown): EvidenceManifestView {
  const value = object(raw);
  const items = Array.isArray(value.items) ? value.items : [];
  return {
    schemaVersion: 1,
    items: items.flatMap((rawItem, index) => {
      const item = object(rawItem);
      if (item.kind !== "inline" && item.kind !== "url") return [];
      const normalized = {
        id: text(item.id) || `e${index + 1}`,
        kind: item.kind,
        contentSha256: text(item.contentSha256 ?? item.content_sha256),
        maxChars: numeric(item.maxChars ?? item.max_chars) || 2000,
        ...(typeof item.note === "string" ? { note: item.note } : {}),
        ...(typeof item.text === "string" ? { text: item.text } : {}),
        ...(typeof item.url === "string" ? { url: item.url } : {}),
        ...(typeof item.retrievedAt === "string"
          ? { retrievedAt: item.retrievedAt }
          : {}),
      } as EvidenceManifestView["items"][number];
      return [normalized];
    }),
  };
}

export interface PublicIndex {
  schemaVersion: 1;
  generatedAt: string;
  network: string;
  contract: string;
  systems: SystemView[];
  incidents: IncidentView[];
}

function parseIndexPayload(raw: unknown): PublicIndex {
  const value = object(raw);
  if (value.schemaVersion !== 1)
    throw new Error("Published index has an unsupported schemaVersion.");
  if (!Array.isArray(value.incidents) || !Array.isArray(value.systems)) {
    throw new Error("Published index is missing systems or incidents arrays.");
  }
  const systems = value.systems.map((rawSystem) => {
    const item = object(rawSystem);
    const policies = Array.isArray(item.policies)
      ? item.policies.map(normalizePolicy)
      : [];
    return normalizeSystem(item, policies);
  });
  const systemsById = new Map(
    systems.map((system) => [system.system_id, system]),
  );
  const incidents = value.incidents.map((rawIncident) => {
    const item = object(rawIncident);
    const systemId = text(item.system_id ?? item.systemId);
    const system = systemsById.get(systemId);
    const rawVerdict = object(item.verdict);
    const hasVerdict = Boolean(rawVerdict.verdict);
    const timestamp = (v: unknown) =>
      numeric(v) * (numeric(v) < 10_000_000_000 ? 1000 : 1);
    return {
      incident_id: text(item.incident_id ?? item.incidentId),
      system_id: systemId,
      system_name: system?.display_name ?? systemId,
      policy_version: text(item.policy_version ?? item.policyVersion),
      policy_hash: text(item.policy_hash ?? item.policyHash),
      reporter: text(item.reporter),
      claim: text(item.claim),
      evidence_hash: text(item.evidence_hash ?? item.evidenceHash),
      evidence: parseEvidence(
        item.evidence ?? item.evidence_manifest ?? item.evidenceManifest,
      ),
      status: text(item.status) as IncidentView["status"],
      filed_at: timestamp(item.filed_at ?? item.filedAt),
      response_deadline: timestamp(
        item.response_deadline ?? item.responseDeadline,
      ),
      response: null,
      verdict: hasVerdict
        ? {
            incident_id: text(item.incident_id ?? item.incidentId),
            verdict: text(rawVerdict.verdict) as SafetyNetVerdict,
            severity: text(rawVerdict.severity) as NonNullable<
              IncidentView["verdict"]
            >["severity"],
            confidence: text(rawVerdict.confidence) as NonNullable<
              IncidentView["verdict"]
            >["confidence"],
            clauses: stringList(rawVerdict.clauses),
            rationale: text(rawVerdict.rationale),
            evidence_hash: text(
              rawVerdict.evidence_hash ??
                rawVerdict.evidenceHash ??
                item.evidence_hash ??
                item.evidenceHash,
            ),
            policy_hash: text(
              rawVerdict.policy_hash ??
                rawVerdict.policyHash ??
                item.policy_hash ??
                item.policyHash,
            ),
            ruled_at: timestamp(rawVerdict.ruled_at ?? rawVerdict.ruledAt),
            round: numeric(rawVerdict.round),
            appeals: numeric(rawVerdict.appeals),
          }
        : null,
      appeals: Array.isArray(item.appeals)
        ? (item.appeals as IncidentView["appeals"])
        : [],
      synthetic: Boolean(item.synthetic),
    } satisfies IncidentView;
  });
  return {
    schemaVersion: 1,
    generatedAt: text(value.generatedAt) || "",
    network: text(value.network),
    contract: text(value.contract),
    systems,
    incidents,
  };
}

const DEMO_INDEX: PublicIndex = {
  schemaVersion: 1,
  generatedAt: "",
  network: "demo",
  contract: "local synthetic store",
  systems: [],
  incidents: [],
};

let indexPromise: Promise<PublicIndex> | null = null;
export function loadPublishedIndex(signal?: AbortSignal): Promise<PublicIndex> {
  if (IS_DEMO) {
    const snapshot = demoStore.getSnapshot();
    return Promise.resolve({
      ...DEMO_INDEX,
      systems: snapshot.systems,
      incidents: snapshot.incidents,
    });
  }
  if (!indexPromise) {
    indexPromise = fetch(APP_CONFIG.indexUrl, { signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            `Published index request failed (${response.status}).`,
          );
        return parseIndexPayload((await response.json()) as unknown);
      })
      .catch((error: unknown) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

let adapterPromise: Promise<ClientAdapter> | null = null;
export function getChainAdapter(): Promise<ClientAdapter> {
  if (!adapterPromise) {
    adapterPromise = createGenLayerAdapter({
      network: APP_CONFIG.network,
      endpoint: APP_CONFIG.rpcUrl,
      chainId: APP_CONFIG.chainId,
    }).catch((error: unknown) => {
      adapterPromise = null;
      throw error;
    });
  }
  return adapterPromise;
}

export async function createWalletContract(
  address: string,
  provider: unknown,
  account: string,
) {
  const adapter = await createGenLayerAdapter({
    network: APP_CONFIG.network,
    endpoint: APP_CONFIG.rpcUrl,
    chainId: APP_CONFIG.chainId,
    account,
    provider,
  });
  const client = createClient({
    adapter,
    network: APP_CONFIG.network,
    account,
    readCacheMs: 30_000,
  });
  return client.contract<SafetyNetAPI>(address, { decode: SafetyNetDecoders });
}

async function readContract() {
  const adapter = await getChainAdapter();
  return createClient({
    adapter,
    network: APP_CONFIG.network,
    readCacheMs: 30_000,
  }).contract<SafetyNetAPI>(SAFETYNET_ADDRESS, { decode: SafetyNetDecoders });
}

export async function readIncidentBundle(id: string) {
  const sn = await readContract();
  const incident = await sn.read.get_incident([id]);
  if (!incident) return null;
  const [systemRaw, policyRaw, response, verdict, appeals, history] =
    await Promise.all([
      sn.read.get_system([incident.system_id]),
      sn.read.get_policy([incident.system_id, incident.policy_version]),
      sn.read.get_response([id]),
      sn.read.get_verdict([id]),
      sn.read.get_appeals([id]),
      sn.read.get_verdict_history([id]),
    ]);
  const system = normalizeSystem(
    systemRaw,
    policyRaw ? [normalizePolicy(policyRaw)] : [],
  );
  const policy = policyRaw ? normalizePolicy(policyRaw) : null;
  const evidence = parseEvidence(incident.evidence_manifest);
  const timestamp = (v: number) => v * (v < 10_000_000_000 ? 1000 : 1);
  const normalized: IncidentView = {
    incident_id: incident.incident_id,
    system_id: incident.system_id,
    system_name: system.display_name || incident.system_id,
    policy_version: incident.policy_version,
    policy_hash: incident.policy_hash,
    reporter: incident.reporter,
    claim: incident.claim,
    evidence_hash: incident.evidence_hash,
    evidence,
    status: incident.status,
    filed_at: timestamp(incident.filed_at),
    response_deadline: timestamp(incident.response_deadline),
    response: response
      ? ({
          ...response,
          responded_at: timestamp(response.responded_at),
          late: false,
          response_missing: false,
          evidence: parseEvidence(response.evidence_manifest),
        } as ResponseView)
      : null,
    verdict: verdict
      ? { ...verdict, ruled_at: timestamp(verdict.ruled_at) }
      : null,
    appeals: appeals.map((appeal) => ({
      ...appeal,
      created_at: timestamp(appeal.created_at),
    })),
    synthetic: false as true,
  };
  return { incident: normalized, system, policy, history };
}

export async function submitContractWrite<T>(
  provider: unknown,
  account: string,
  method: string,
  args: readonly unknown[],
  onStatus: (event: {
    status: string;
    hash: string;
    elapsedMs: number;
  }) => void,
): Promise<{ result: T; hash: string }> {
  const sn = await createWalletContract(SAFETYNET_ADDRESS, provider, account);
  const writer = (
    sn.write as unknown as Record<string, (params: unknown[]) => TrackedTx<T>>
  )[method];
  if (!writer) throw new Error(`Contract action ${method} is not available.`);
  const tx = writer([...args]);
  const unsubscribe = tx.on("status", onStatus);
  try {
    const [hash, result] = await Promise.all([tx.hash, tx.result]);
    return { result, hash };
  } finally {
    unsubscribe();
  }
}

const EMPTY_STATE: DemoState = { incidents: [], systems: [], nextIncident: 0 };

export type RecordIndexState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "ready";
      state: DemoState;
      generatedAt: string;
      isDemo: boolean;
    };

/**
 * One read path for every list surface (feed, systems, policy gaps, embeds).
 * Demo mode returns the local synthetic store; chain mode returns the published
 * static index, which is the only list source a browser can trust without
 * trusting a single RPC. A missing index is an error, never an empty record.
 */
export function useRecordIndex(): RecordIndexState {
  const demo = useDemoState();
  const [state, setState] = useState<RecordIndexState>(() =>
    IS_DEMO
      ? { status: "ready", state: demo, generatedAt: "", isDemo: true }
      : { status: "loading" },
  );

  useEffect(() => {
    if (IS_DEMO) {
      setState({ status: "ready", state: demo, generatedAt: "", isDemo: true });
      return;
    }
    let cancelled = false;
    loadPublishedIndex()
      .then((index) => {
        if (cancelled) return;
        setState({
          status: "ready",
          state: {
            incidents: index.incidents,
            systems: index.systems,
            nextIncident: index.incidents.length + 1,
          },
          generatedAt: index.generatedAt,
          isDemo: false,
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error:
            cause instanceof Error
              ? cause.message
              : "Could not load the published index.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [demo]);

  return state;
}

/** Empty-but-typed state for surfaces that render before data arrives. */
export function emptyRecordState(): DemoState {
  return EMPTY_STATE;
}

export {
  demoStore,
  EVIDENCE_ALLOWLIST,
  DEMO_ACCOUNT,
  parseIndexPayload,
  normalizePolicy,
  normalizeSystem,
};
