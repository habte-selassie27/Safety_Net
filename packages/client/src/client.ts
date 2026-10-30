// @safetynet/client — typed chain access with a first-class tx lifecycle.

import type { TrackedTxImpl } from "./tracked-tx";
import { TrackedTxImpl as TrackedTxClass } from "./tracked-tx";
import {
  type ClientAdapter,
  ClientError,
  type PollOptions,
  type TrackedTx,
} from "./types";

export type ReadMethod = (...args: never[]) => Promise<unknown>;

export type WriteMethod = (
  args: readonly unknown[],
  opts?: WriteOpts,
) => TrackedTx<unknown>;

export interface ContractAPI {
  read: object;
  write: object;
}

export interface WriteOpts {
  sender?: string;
  wait?: "ACCEPTED" | "FINALIZED";
  poll?: PollOptions;
}

export type ContractClient<API extends ContractAPI> = {
  readonly address: string;
  readonly read: { [K in keyof API["read"]]: API["read"][K] };
  readonly write: { [K in keyof API["write"]]: API["write"][K] };
};

export interface CreateClientOptions {
  adapter: ClientAdapter;
  network?: string;
  account?: string;
  poll?: PollOptions;
  /** Cache reads for this many ms. The web app uses 30_000 (§23.5). */
  readCacheMs?: number;
  now?: () => number;
}

export interface ContractOptions {
  /**
   * Per-method decoders. The contract's views return JSON strings, so typed
   * clients pass `SafetyNetDecoders` from the generated module here.
   */
  decode?: Record<string, (raw: unknown) => unknown>;
}

export interface ReadDecoders {
  readonly [method: string]: (raw: unknown) => unknown;
}

interface CacheEntry {
  value: Promise<unknown>;
  at: number;
}

export class SafetyNetClient {
  readonly adapter: ClientAdapter;
  readonly network: string;
  readonly account: string | undefined;
  private readonly poll: PollOptions | undefined;
  private readonly readCacheMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: CreateClientOptions) {
    if (!options.adapter) {
      throw new ClientError(
        "E4001",
        "createClient requires an adapter. Use createGenLayerAdapter() or a FakeAdapter in tests.",
      );
    }
    this.adapter = options.adapter;
    this.network = options.network ?? "studionet";
    this.account = options.account;
    this.poll = options.poll;
    this.readCacheMs = options.readCacheMs ?? 0;
    this.now = options.now ?? (() => Date.now());
  }

  contract<API extends ContractAPI>(
    address: string,
    options: ContractOptions = {},
  ): ContractClient<API> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new ClientError("E2002", `invalid contract address: ${address}`);
    }

    const read = new Proxy(
      {},
      {
        get: (_target, method: string) => {
          return async (args: readonly unknown[] = []) => {
            const raw = await this.read(address, method, args);
            const decode = options.decode?.[method];
            return decode ? decode(raw) : raw;
          };
        },
      },
    ) as ContractClient<API>["read"];

    const write = new Proxy(
      {},
      {
        get: (_target, method: string) => {
          return (args: readonly unknown[] = [], opts: WriteOpts = {}) =>
            this.write(address, method, args, opts);
        },
      },
    ) as ContractClient<API>["write"];

    return { address, read, write };
  }

  async read(
    address: string,
    method: string,
    args: readonly unknown[],
    sender?: string,
  ): Promise<unknown> {
    const key = `${address}:${method}:${stableKey(args)}:${sender ?? this.account ?? ""}`;
    if (this.readCacheMs > 0) {
      const hit = this.cache.get(key);
      if (hit && this.now() - hit.at < this.readCacheMs) {
        return hit.value;
      }
    }
    const payload = {
      address,
      method,
      args,
      network: this.network,
    } as {
      address: string;
      method: string;
      args: readonly unknown[];
      network: string;
      sender?: string;
    };
    const resolvedSender = sender ?? this.account;
    if (resolvedSender !== undefined) payload.sender = resolvedSender;
    const value = this.adapter.read(payload);
    if (this.readCacheMs > 0) {
      this.cache.set(key, { value, at: this.now() });
      // Never cache a rejection.
      value.catch(() => this.cache.delete(key));
    }
    return value;
  }

  write(
    address: string,
    method: string,
    args: readonly unknown[],
    opts: WriteOpts = {},
  ): TrackedTxImpl<unknown> {
    const pollOptions = opts.poll ?? this.poll;
    const tx = new TrackedTxClass<unknown>({
      adapter: this.adapter,
      ...(pollOptions !== undefined ? { poll: pollOptions } : {}),
      submit: () => {
        const payload = {
          address,
          method,
          args,
          network: this.network,
        } as {
          address: string;
          method: string;
          args: readonly unknown[];
          network: string;
          sender?: string;
        };
        const resolvedSender = opts.sender ?? this.account;
        if (resolvedSender !== undefined) payload.sender = resolvedSender;
        return this.adapter.submitWrite(payload);
      },
    });
    return tx;
  }

  invalidateReads(): void {
    this.cache.clear();
  }

  getChainId(): Promise<string> {
    return this.adapter.getChainId();
  }
}

export function createClient(options: CreateClientOptions): SafetyNetClient {
  return new SafetyNetClient(options);
}

function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type { TrackedTx } from "./types";
