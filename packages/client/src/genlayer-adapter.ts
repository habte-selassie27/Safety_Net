// The only file allowed to touch genlayer-js (AGENTS.md §4.6).
//
// [VERIFY] The exact genlayer-js surface (`createClient`, `readContract`,
// `writeContract`, receipt shape) is pinned by docs/ground-truth.md. This
// adapter is deliberately defensive: if the SDK is absent or its surface has
// drifted, it fails with an actionable E4001/E5001 error instead of guessing.

import {
  type AdapterTxStatus,
  type ClientAdapter,
  ClientError,
  type ReadArgs,
  type TxStatus,
  type WriteArgs,
} from "./types";

const SDK_SPECIFIER = "genlayer-js";
const CHAINS_SPECIFIER = "genlayer-js/chains";

export interface GenLayerAdapterOptions {
  /** SafetyNet network name; maps to the GenLayer SDK chain descriptors. */
  network?: string;
  endpoint?: string;
  account?: string;
  /** Inject a browser wallet transport. */
  provider?: unknown;
  chainId?: string;
}

type AnyRecord = Record<string, unknown>;

const STATUS_MAP: Record<string, TxStatus> = {
  PENDING: "PENDING",
  PROPOSING: "PROPOSING",
  COMMITTING: "COMMITTING",
  REVEALING: "REVEALING",
  ACCEPTED: "ACCEPTED",
  FINALIZED: "FINALIZED",
  UNDETERMINED: "UNDETERMINED",
  CANCELED: "CANCELED",
  CANCELLED: "CANCELED",
  REVERTED: "REVERTED",
  ERROR: "ERROR",
};

function normalizeStatus(value: unknown): TxStatus {
  const text = String(value ?? "PENDING").toUpperCase();
  return STATUS_MAP[text] ?? "PENDING";
}

class GenLayerJsAdapter implements ClientAdapter {
  private readonly sdk: AnyRecord;
  private readonly chainId: string;

  constructor(sdk: AnyRecord, chainId: string) {
    this.sdk = sdk;
    this.chainId = chainId;
  }

  async read(args: ReadArgs): Promise<unknown> {
    const fn = this.sdk.readContract ?? this.sdk.read;
    if (typeof fn !== "function") {
      throw new ClientError("E4001", "genlayer-js exposes no readContract()");
    }
    return fn.call(this.sdk, {
      address: args.address,
      functionName: args.method,
      args: [...args.args],
      ...(args.sender ? { account: args.sender as `0x${string}` } : {}),
    });
  }

  async submitWrite(args: WriteArgs): Promise<string> {
    const fn = this.sdk.writeContract ?? this.sdk.write;
    if (typeof fn !== "function") {
      throw new ClientError("E4001", "genlayer-js exposes no writeContract()");
    }
    const result = await fn.call(this.sdk, {
      address: args.address,
      functionName: args.method,
      args: [...args.args],
      value: 0n,
      ...(args.sender ? { account: args.sender as `0x${string}` } : {}),
    });
    const hash =
      typeof result === "string"
        ? result
        : ((result as AnyRecord)?.hash ?? (result as AnyRecord)?.txHash);
    if (typeof hash !== "string") {
      throw new ClientError(
        "E5001",
        "genlayer-js write returned no transaction hash",
      );
    }
    return hash;
  }

  async getTxStatus(hash: string): Promise<AdapterTxStatus> {
    const transaction = (await this.transaction(hash)) as AnyRecord;
    const status = normalizeStatus(
      transaction.statusName ?? transaction.status,
    );
    const result: AdapterTxStatus = { status };
    const lastRound = transaction.lastRound as AnyRecord | undefined;
    const round = Number(transaction.numOfRounds ?? lastRound?.round);
    if (Number.isFinite(round) && round > 0) result.round = round;
    if (
      status === "REVERTED" ||
      transaction.txExecutionResultName === "FINISHED_WITH_ERROR"
    ) {
      result.error = "Contract execution finished with an error.";
    }
    return result;
  }

  async getTxResult(hash: string): Promise<unknown> {
    const transaction = (await this.transaction(hash)) as AnyRecord;
    if (transaction.txExecutionResultName === "FINISHED_WITH_ERROR") {
      throw new ClientError("E5002", "GenLayer transaction execution failed.");
    }
    if (transaction.txExecutionResultName === "NOT_VOTED") {
      throw new ClientError(
        "E5001",
        "GenLayer transaction has no completed execution result.",
      );
    }
    const result = transaction.result;
    if (result && typeof result === "object") {
      const resultRecord = result as AnyRecord;
      return (
        resultRecord.returnValue ??
        resultRecord.result ??
        resultRecord.execution_result ??
        result
      );
    }
    return result ?? transaction.returnValue ?? null;
  }

  async getChainId(): Promise<string> {
    return this.chainId;
  }

  private async transaction(hash: string): Promise<unknown> {
    const fn = this.sdk.getTransaction;
    if (typeof fn !== "function") {
      throw new ClientError(
        "E4001",
        "genlayer-js exposes no getTransaction() API",
      );
    }
    return fn.call(this.sdk, { hash });
  }
}

export async function createGenLayerAdapter(
  options: GenLayerAdapterOptions = {},
): Promise<ClientAdapter> {
  let sdk: AnyRecord;
  try {
    // String indirection keeps this dependency confined to this adapter and
    // avoids a hard build-time requirement when the SDK is not installed.
    sdk = (await import(/* @vite-ignore */ SDK_SPECIFIER)) as AnyRecord;
  } catch {
    throw new ClientError(
      "E4001",
      "genlayer-js is not installed. Install it, or pass a FakeAdapter for sim/demo mode.",
    );
  }
  const factory = sdk.createClient;
  if (typeof factory !== "function") {
    throw new ClientError("E4001", "genlayer-js exposes no createClient()");
  }
  const [chains, network] = await Promise.all([
    import(/* @vite-ignore */ CHAINS_SPECIFIER) as Promise<AnyRecord>,
    import("@safetynet/core/ground-truth").then(({ getNetwork }) =>
      getNetwork(options.network ?? "studionet"),
    ),
  ]);
  if (!network) {
    throw new ClientError(
      "E1001",
      `Unknown GenLayer network: ${options.network ?? "studionet"}`,
    );
  }
  const chainKey =
    network.name === "local"
      ? "localnet"
      : network.name === "asimov"
        ? "testnetAsimov"
        : network.name === "bradbury"
          ? "testnetBradbury"
          : "studionet";
  const chain = chains[chainKey];
  if (!chain || typeof chain !== "object") {
    throw new ClientError(
      "E4001",
      `genlayer-js does not provide chain ${chainKey}`,
    );
  }
  const client = factory.call(sdk, {
    chain,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.account ? { account: options.account as `0x${string}` } : {}),
    ...(options.provider ? { provider: options.provider } : {}),
  }) as AnyRecord;
  return new GenLayerJsAdapter(client, options.chainId ?? "");
}
