// Network configuration. Fails loudly at import time when the selected
// network has no recorded deployment (AGENTS.md §20.10, §23.5).
import { APP_CONFIG } from "./config";

export const NETWORK = APP_CONFIG.network;
export const CHAIN_ID = APP_CONFIG.chainId;
export const RPC_URL = APP_CONFIG.rpcUrl;
export const SAFETYNET_ADDRESS = APP_CONFIG.contractAddress;
