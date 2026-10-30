import { APP_CONFIG } from "../config";

export function isChainMode(): boolean {
  return APP_CONFIG.mode === "chain";
}

export function chainNetwork(): string {
  return APP_CONFIG.network;
}