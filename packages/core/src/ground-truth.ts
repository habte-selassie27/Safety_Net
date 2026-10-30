// Ground-truth constants shared by the CLI, web app, and tooling.
//
// Single source of truth for network descriptors (AGENTS.md §4.6). Anything
// that depends on a GenLayer network fact must import from here instead of
// re-typing an RPC URL or chain id.
//
// Snapshot date: 2026-10-27 (docs/ground-truth.md). Values marked [VERIFY]
// require a docs refresh when the SDK/network changes.

export interface NetworkDescriptor {
  /** SafetyNet network name, also used in deployments/<network>.json. */
  readonly name: string;
  /** EVM chain id as a decimal string (kept as a string for display). */
  readonly chainId: string;
  /** JSON-RPC endpoint used for reads and verification. */
  readonly rpcUrl: string;
}

/** [VERIFY] Confirmed against docs/ground-truth.md on 2026-10-27. */
export const NETWORKS = {
  local: {
    name: "local",
    chainId: "local",
    rpcUrl: "http://localhost:4000/api",
  },
  studionet: {
    name: "studionet",
    chainId: "61999",
    rpcUrl: "https://studio.genlayer.com/api",
  },
  asimov: {
    name: "asimov",
    chainId: "4221",
    rpcUrl: "https://rpc-asimov.genlayer.com",
  },
  bradbury: {
    name: "bradbury",
    chainId: "4221",
    rpcUrl: "https://rpc-bradbury.genlayer.com",
  },
} as const satisfies Record<string, NetworkDescriptor>;

export type KnownNetwork = keyof typeof NETWORKS;

export const DEFAULT_NETWORK: KnownNetwork = "studionet";

/** Current contract dependency header (pinned, never floating). */
export const CONTRACT_HEADER =
  '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }';

/** Return a known network descriptor or undefined for an unknown name. */
export function getNetwork(name: string): NetworkDescriptor | undefined {
  return (NETWORKS as Record<string, NetworkDescriptor>)[name];
}
