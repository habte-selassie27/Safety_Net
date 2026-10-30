// FakeAdapter — scripted adapter for tests, the web sim mode, and demos.
// Implements the same ClientAdapter interface as the production adapter.

import type {
  AdapterTxStatus,
  ClientAdapter,
  ReadArgs,
  TxStatus,
  WriteArgs,
} from "./types";

type ReadHandler = (args: ReadArgs) => unknown | Promise<unknown>;

export interface QueuedWrite {
  statuses: AdapterTxStatus[];
  result?: unknown;
}

export class FakeAdapter implements ClientAdapter {
  readonly reads = new Map<string, ReadHandler>();
  readonly writes: QueuedWrite[] = [];
  readonly submitted: WriteArgs[] = [];
  readonly statusCalls: string[] = [];
  private counter = 0;
  private readonly writeHashes: string[] = [];
  private nextStatuses: AdapterTxStatus[] = [];
  private nextResult: unknown = null;
  private chainId = "61999";

  onRead(method: string, handler: ReadHandler | unknown): this {
    this.reads.set(
      method,
      typeof handler === "function" ? (handler as ReadHandler) : () => handler,
    );
    return this;
  }

  /** Queue statuses and a return value for the next submitted write. */
  queueWrite(statuses: TxStatus[] | AdapterTxStatus[], result?: unknown): this {
    this.nextStatuses = statuses.map((status) =>
      typeof status === "string" ? { status } : status,
    );
    this.nextResult = result ?? null;
    return this;
  }

  setChainId(chainId: string): this {
    this.chainId = chainId;
    return this;
  }

  async read(args: ReadArgs): Promise<unknown> {
    const handler = this.reads.get(args.method);
    if (!handler) {
      return null;
    }
    return handler(args);
  }

  async submitWrite(args: WriteArgs): Promise<string> {
    this.counter += 1;
    const hash = `0x${this.counter.toString(16).padStart(64, "0")}`;
    this.submitted.push(args);
    this.writeHashes.push(hash);
    this.writes.push({
      statuses: this.nextStatuses.length
        ? [...this.nextStatuses]
        : [{ status: "ACCEPTED" }],
      result: this.nextResult ?? null,
    });
    this.nextStatuses = [];
    this.nextResult = null;
    return hash;
  }

  async getTxStatus(hash: string): Promise<AdapterTxStatus> {
    this.statusCalls.push(hash);
    const index = this.writeHashes.indexOf(hash);
    if (index === -1) {
      return { status: "ERROR", error: "unknown transaction" };
    }
    const queued = this.writes[index];
    if (!queued || queued.statuses.length === 0) {
      return { status: "ACCEPTED" };
    }
    const status =
      queued.statuses.length > 1 ? queued.statuses.shift() : queued.statuses[0];
    return status ?? { status: "ACCEPTED" };
  }

  async getTxResult(hash: string): Promise<unknown> {
    const index = this.writeHashes.indexOf(hash);
    return index === -1 ? null : (this.writes[index]?.result ?? null);
  }

  async getChainId(): Promise<string> {
    return this.chainId;
  }
}
