import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { APP_CONFIG } from "./config";

export interface Eip1193Provider {
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: Eip1193Provider };
  return w.ethereum ?? null;
}

export async function connectWallet(): Promise<string | null> {
  const p = getInjectedProvider();
  if (!p) return null;
  const accounts = (await p.request({
    method: "eth_requestAccounts",
  })) as string[];
  return accounts?.[0] ?? null;
}

export async function getChainId(): Promise<string | null> {
  const p = getInjectedProvider();
  if (!p) return null;
  const result = (await p.request({ method: "eth_chainId" })) as string;
  return result ?? null;
}

export async function switchChain(chainId: string): Promise<boolean> {
  const p = getInjectedProvider();
  if (!p) return false;
  try {
    await p.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return true;
  } catch {
    return false;
  }
}

interface WalletState {
  address: string | null;
  chainId: string | null;
  available: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

function asAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? value
    : null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = typeof window === "undefined" ? undefined : window.ethereum;

  const syncWallet = useCallback(async () => {
    if (!provider) return;
    try {
      const [accounts, currentChain] = await Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ]);
      const list = Array.isArray(accounts) ? accounts : [];
      setAddress(asAddress(list[0]));
      const numeric =
        typeof currentChain === "string"
          ? Number.parseInt(currentChain, 16)
          : Number.NaN;
      setChainId(Number.isFinite(numeric) ? String(numeric) : null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read wallet state.",
      );
    }
  }, [provider]);

  useEffect(() => {
    void syncWallet();
    if (!provider?.on) return;
    const accountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      setAddress(asAddress(list[0]));
    };
    const chainChanged = (value: unknown) => {
      const numeric =
        typeof value === "string" ? Number.parseInt(value, 16) : Number.NaN;
      setChainId(Number.isFinite(numeric) ? String(numeric) : null);
    };
    provider.on("accountsChanged", accountsChanged);
    provider.on("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [provider, syncWallet]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError(
        "No browser wallet was found. Install an EIP-1193 wallet and try again.",
      );
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const list = Array.isArray(accounts) ? accounts : [];
      const nextAddress = asAddress(list[0]);
      if (!nextAddress)
        throw new Error("The wallet returned no valid account.");
      setAddress(nextAddress);
      const currentChain = await provider.request({ method: "eth_chainId" });
      const numeric =
        typeof currentChain === "string"
          ? Number.parseInt(currentChain, 16)
          : Number.NaN;
      setChainId(Number.isFinite(numeric) ? String(numeric) : null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Wallet connection was rejected.",
      );
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(() => setAddress(null), []);
  const state = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      available: Boolean(provider),
      connecting,
      error,
      connect,
      disconnect,
    }),
    [address, chainId, provider, connecting, error, connect, disconnect],
  );
  return (
    <WalletContext.Provider value={state}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context)
    throw new Error("useWallet must be used inside WalletProvider.");
  return context;
}

export function walletOnExpectedNetwork(wallet: WalletState): boolean {
  return wallet.chainId === APP_CONFIG.chainId;
}
