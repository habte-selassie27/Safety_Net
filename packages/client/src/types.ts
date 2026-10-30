// Shared client types. No network imports here: the adapter owns the SDK.

export type TxStatus =
  | "PENDING"
  | "PROPOSING"
  | "COMMITTING"
  | "REVEALING"
  | "ACCEPTED"
  | "FINALIZED"
  | "UNDETERMINED"
  | "CANCELED"
  | "REVERTED"
  | "ERROR";

export const TERMINAL_STATUSES: ReadonlySet<TxStatus> = new Set<TxStatus>([
  "ACCEPTED",
  "FINALIZED",
  "UNDETERMINED",
  "CANCELED",
  "REVERTED",
  "ERROR",
]);

export const SUCCESS_STATUSES: ReadonlySet<TxStatus> = new Set<TxStatus>([
  "ACCEPTED",
  "FINALIZED",
]);

export interface TxVotes {
  agree: number;
  disagree: number;
  timeout: number;
  abstain?: number;
}

export interface AdapterTxStatus {
  status: TxStatus;
  round?: number;
  votes?: TxVotes;
  error?: string;
}

export interface TxStatusEvent {
  hash: string;
  status: TxStatus;
  elapsedMs: number;
  round?: number;
  votes?: TxVotes;
}

export type TxStatusListener = (event: TxStatusEvent) => void;

export interface TrackedTx<T> {
  readonly hash: Promise<string>;
  readonly result: Promise<T>;
  on(event: "status", listener: TxStatusListener): () => void;
  cancelPolling(): void;
}

export interface ReadArgs {
  address: string;
  method: string;
  args: readonly unknown[];
  sender?: string;
  network?: string;
}

export interface WriteArgs {
  address: string;
  method: string;
  args: readonly unknown[];
  sender?: string;
  network?: string;
}

export interface ClientAdapter {
  read(args: ReadArgs): Promise<unknown>;
  submitWrite(args: WriteArgs): Promise<string>;
  getTxStatus(hash: string): Promise<AdapterTxStatus>;
  getTxResult(hash: string): Promise<unknown>;
  getChainId(): Promise<string>;
}

export interface PollOptions {
  initialMs?: number;
  maxMs?: number;
  factor?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  isHidden?: () => boolean;
  onVisible?: (callback: () => void) => () => void;
}

export class ClientError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ClientError";
    this.code = code;
  }
}

export class TxTimeoutError extends ClientError {
  readonly hash: string;
  constructor(hash: string, timeoutMs: number) {
    super("E5003", `transaction ${hash} timed out after ${timeoutMs}ms`);
    this.name = "TxTimeoutError";
    this.hash = hash;
  }
}

export class TxFailedError extends ClientError {
  readonly hash: string;
  readonly status: TxStatus;
  constructor(hash: string, status: TxStatus, detail?: string) {
    super(
      "E5002",
      `transaction ${hash} ended ${status}${detail ? `: ${detail}` : ""}`,
    );
    this.name = "TxFailedError";
    this.hash = hash;
    this.status = status;
  }
}
