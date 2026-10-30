import { APP_CONFIG } from "../config";
import { createClient, createGenLayerAdapter } from "@safetynet/client";
import type { ContractClient } from "@safetynet/client";
import { requireAddress } from "../../generated/addresses";
import {
  SafetyNetDecoders,
  type SafetyNetAPI,
} from "../../generated/SafetyNet";
import type { IncidentView, EvidenceManifestView, ResponseView } from "../../data/types";

export async function getChainClient(): Promise<ContractClient<SafetyNetAPI>> {
  const network = APP_CONFIG.network;
  const adapter = await createGenLayerAdapter({ network });
  const client = createClient({ adapter, network, readCacheMs: 30_000 });
  const address = requireAddress(network, "SafetyNet");
  return client.contract<SafetyNetAPI>(address, { decode: SafetyNetDecoders });
}

function parseManifest(raw: string): EvidenceManifestView {
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number; items?: unknown[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      schemaVersion: 1,
      items: items.map((item, index) => {
        const obj = (item ?? {}) as Record<string, unknown>;
        return {
          id: String(obj.id ?? `e${index + 1}`),
          kind: obj.kind === "url" ? "url" : "inline",
          url: typeof obj.url === "string" ? obj.url : undefined,
          text: typeof obj.text === "string" ? obj.text : undefined,
          retrievedAt: typeof obj.retrievedAt === "string" ? obj.retrievedAt : undefined,
          contentSha256: String(obj.contentSha256 ?? ""),
          maxChars: Number(obj.maxChars ?? 2000),
          note: typeof obj.note === "string" ? obj.note : undefined,
        };
      }),
    };
  } catch {
    return { schemaVersion: 1, items: [] };
  }
}

export async function fetchChainIncident(id: string): Promise<IncidentView | null> {
  const sn = await getChainClient();
  const incident = await sn.read.get_incident([id]);
  if (!incident) return null;

  const [system, response, verdict, appeals] = await Promise.all([
    sn.read.get_system([incident.system_id]),
    sn.read.get_response([id]),
    sn.read.get_verdict([id]),
    sn.read.get_appeals([id]),
  ]);

  const responseView: ResponseView | null = response
    ? {
        ...response,
        evidence: parseManifest(response.evidence_manifest),
        late: response.responded_at > incident.response_deadline,
        response_missing: false,
      }
    : null;

  return {
    incident_id: incident.incident_id,
    system_id: incident.system_id,
    system_name: system?.display_name ?? incident.system_id,
    policy_version: incident.policy_version,
    policy_hash: incident.policy_hash,
    reporter: incident.reporter,
    claim: incident.claim,
    evidence_hash: incident.evidence_hash,
    evidence: parseManifest(incident.evidence_manifest),
    status: incident.status as IncidentView["status"],
    filed_at: Number(incident.filed_at),
    response_deadline: Number(incident.response_deadline),
    response: responseView,
    verdict: verdict ?? null,
    appeals: appeals ?? [],
    synthetic: false,
  };
}
