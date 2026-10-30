// TrackedTx: the full transaction lifecycle as a first-class helper.
// Polling is adaptive (500ms -> 3s), pauses while the page is hidden, and
// emits every distinct status exactly once (AGENTS.md §22.3).

import {
  type AdapterTxStatus,
  type ClientAdapter,
  type PollOptions,
  SUCCESS_STATUSES,
  TERMINAL_STATUSES,
  type TrackedTx,
  TxFailedError,
  type TxStatus,
  type TxStatusEvent,
  type TxStatusListener,
  TxTimeoutError,
} from "./types";

const DEFAULTS = {
  initialMs: 500,
  maxMs: 3000,
  factor: 1.5,
  timeoutMs: 180_000,
};

interface Visibility {
  isHidden: () => boolean;
  onVisible: (callback: () => void) => () => void;
}

function defaultVisibility(): Visibility {
  return {
    isHidden: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden",
    onVisible: (callback) => {
      if (typeof document === "undefined") return () => {};
      const handler = () => {
        if (document.visibilityState === "visible") callback();
      };
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    },
  };
}

export interface TrackedTxOptions<T> {
  adapter: ClientAdapter;
  submit: () => Promise<string>;
  poll?: PollOptions;
  /** Optional transform from the adapter's raw result to the typed value. */
  mapResult?: (raw: unknown) => T;
}

export class TrackedTxImpl<T> implements TrackedTx<T> {
  readonly hash: Promise<string>;
  readonly result: Promise<T>;

  private readonly listeners = new Set<TxStatusListener>();
  private readonly adapter: ClientAdapter;
  private readonly poll: Required<
    Pick<PollOptions, "initialMs" | "maxMs" | "factor" | "timeoutMs">
  >;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly visibility: Visibility;
  private readonly mapResult: (raw: unknown) => T;
  private cancelled = false;
  private lastStatus: TxStatus | null = null;

  constructor(options: TrackedTxOptions<T>) {
    this.adapter = options.adapter;
    this.poll = {
      initialMs: options.poll?.initialMs ?? DEFAULTS.initialMs,
      maxMs: options.poll?.maxMs ?? DEFAULTS.maxMs,
      factor: options.poll?.factor ?? DEFAULTS.factor,
      timeoutMs: options.poll?.timeoutMs ?? DEFAULTS.timeoutMs,
    };
    this.sleep =
      options.poll?.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.poll?.now ?? (() => Date.now());
    this.visibility = {
      isHidden: options.poll?.isHidden ?? defaultVisibility().isHidden,
      onVisible: options.poll?.onVisible ?? defaultVisibility().onVisible,
    };
    this.mapResult = options.mapResult ?? ((raw) => raw as T);

    this.hash = options.submit();
    this.result = this.hash.then((hash) => this.run(hash));
  }

  on(event: "status", listener: TxStatusListener): () => void {
    if (event !== "status") return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  cancelPolling(): void {
    this.cancelled = true;
  }

  private async run(hash: string): Promise<T> {
    const startedAt = this.now();
    let interval = this.poll.initialMs;

    while (!this.cancelled) {
      if (this.visibility.isHidden()) {
        await this.waitWhileHidden();
        continue;
      }

      const status = await this.adapter.getTxStatus(hash);
      this.emit(hash, status, startedAt);

      if (TERMINAL_STATUSES.has(status.status)) {
        if (!SUCCESS_STATUSES.has(status.status)) {
          throw new TxFailedError(hash, status.status, status.error);
        }
        const raw = await this.adapter.getTxResult(hash);
        return this.mapResult(raw);
      }

      if (this.now() - startedAt > this.poll.timeoutMs) {
        throw new TxTimeoutError(hash, this.poll.timeoutMs);
      }

      await this.sleep(interval);
      interval = Math.min(
        Math.round(interval * this.poll.factor),
        this.poll.maxMs,
      );
    }

    throw new TxFailedError(hash, "CANCELED", "polling cancelled");
  }

  private async waitWhileHidden(): Promise<void> {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve();
      };
      const unsubscribe = this.visibility.onVisible(finish);
      // Fallback: re-check after one interval in case the event never fires.
      void this.sleep(this.poll.initialMs).then(finish);
    });
  }

  private emit(hash: string, status: AdapterTxStatus, startedAt: number): void {
    if (status.status === this.lastStatus) return;
    this.lastStatus = status.status;
    const event: TxStatusEvent = {
      hash,
      status: status.status,
      elapsedMs: this.now() - startedAt,
    };
    if (status.round !== undefined) event.round = status.round;
    if (status.votes !== undefined) event.votes = status.votes;
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function trackedTx<T>(
  adapter: ClientAdapter,
  submit: () => Promise<string>,
  poll?: PollOptions,
): TrackedTx<T> {
  return new TrackedTxImpl<T>({
    adapter,
    submit,
    ...(poll !== undefined ? { poll } : {}),
  });
}
