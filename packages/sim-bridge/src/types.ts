// Types mirroring AGENTS.md §17.10 (JSON-RPC bridge) and §16.15 (TxResult).

export interface SimBridgeConfig {
  validators?: number;
  seed?: number;
  majority?: number;
  appeal_growth?: number;
  max_appeals?: number;
  timeout_ms?: number;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: { code?: string; [key: string]: unknown };
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | null;
  result?: T;
  error?: JsonRpcError;
}

export interface SimTxVotes {
  agree: number;
  disagree: number;
  timeout: number;
  abstain: number;
}

export interface SimTxResult {
  hash: string;
  status: string;
  round: number;
  appeals: number;
  leader_index: number;
  votes: SimTxVotes;
  nondet_blocks: number;
  llm_calls: number;
  web_calls: number;
  storage_writes: number;
  validator_work_units: number;
  tampered: boolean;
  return_value: unknown;
  error: string | null;
  trace: unknown;
}

export interface SimBridgeOptions {
  python?: string;
  cwd?: string;
  config?: SimBridgeConfig;
  protocolVersion?: number;
  onStderr?: (line: string) => void;
}
