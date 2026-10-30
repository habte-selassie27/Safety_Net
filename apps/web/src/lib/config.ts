import { DEFAULT_NETWORK, getNetwork } from "@safetynet/core/ground-truth";
import { addresses } from "../generated/addresses";

export type DataMode = "demo" | "chain";

const rawMode = import.meta.env.VITE_DATA_MODE;
const configuredMode = rawMode ?? "demo";
if (configuredMode !== "demo" && configuredMode !== "chain") {
  throw new Error('E1001: VITE_DATA_MODE must be "demo" or "chain".');
}

const rawNetwork = import.meta.env.VITE_SNET_NETWORK ?? DEFAULT_NETWORK;
const network = getNetwork(rawNetwork);
if (!network) {
  throw new Error(`E1001: unknown VITE_SNET_NETWORK "${rawNetwork}".`);
}

const addressOverride = import.meta.env.VITE_SNET_CONTRACT_ADDRESS;
const addressFromRegistry = (
  addresses as Record<string, { SafetyNet?: string }>
)[rawNetwork]?.SafetyNet;
const contractAddress = addressOverride ?? addressFromRegistry;
if (configuredMode === "chain" && !contractAddress) {
  throw new Error(
    `E7002: no SafetyNet address for ${rawNetwork}. Set VITE_SNET_CONTRACT_ADDRESS or regenerate generated/addresses.ts.`,
  );
}
if (contractAddress && !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
  throw new Error(
    "E7002: VITE_SNET_CONTRACT_ADDRESS must be a 20-byte hex address.",
  );
}

export const APP_CONFIG = Object.freeze({
  mode: configuredMode as DataMode,
  network: rawNetwork,
  chainId: network.chainId,
  rpcUrl: network.rpcUrl,
  contractAddress: contractAddress ?? "",
  indexUrl: import.meta.env.VITE_INDEX_URL ?? "/data/incidents.json",
  version: import.meta.env.VITE_SNET_VERSION ?? "0.1.0",
  commit: import.meta.env.VITE_SNET_COMMIT ?? "development",
});

export const IS_DEMO = APP_CONFIG.mode === "demo";
