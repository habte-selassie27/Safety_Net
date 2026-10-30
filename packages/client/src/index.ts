// @safetynet/client — public entry point.

export {
  type ContractAPI,
  type ContractClient,
  type ContractOptions,
  type CreateClientOptions,
  createClient,
  SafetyNetClient,
  type WriteOpts,
} from "./client";
export { ReadController, WriteController } from "./controllers";
export type { ReadState, WriteState } from "./controllers";
export { FakeAdapter } from "./fake-adapter";
export { TrackedTxImpl, trackedTx } from "./tracked-tx";
export {
  type AdapterTxStatus,
  type ClientAdapter,
  ClientError,
  type PollOptions,
  type ReadArgs,
  SUCCESS_STATUSES,
  TERMINAL_STATUSES,
  type TrackedTx,
  TxFailedError,
  type TxStatus,
  type TxStatusEvent,
  TxTimeoutError,
  type TxVotes,
  type WriteArgs,
} from "./types";

export { createGenLayerAdapter } from "./genlayer-adapter";
