import { useCallback, useEffect, useState } from "react";

import {
  connectWallet,
  getChainId,
  getInjectedProvider,
  switchChain,
} from "../lib/wallet";

export type WalletStatus =
  | "none"
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong-network";

export interface WalletInfo {
  status: WalletStatus;
  address: string | null;
  chainId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchTo: (chainId: string) => Promise<boolean>;
}

export function useWallet(expectedChainId: string): WalletInfo {
  const [status, setStatus] = useState<WalletStatus>(() =>
    getInjectedProvider() ? "disconnected" : "none",
  );
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const p = getInjectedProvider();
    if (!p) {
      setStatus("none");
      return;
    }
    try {
      const accounts = (await p.request({
        method: "eth_accounts",
      })) as string[];
      const cid = await getChainId();
      setChainId(cid);
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setStatus(cid === expectedChainId ? "connected" : "wrong-network");
      } else {
        setAddress(null);
        setStatus("disconnected");
      }
    } catch {
      setStatus("disconnected");
    }
  }, [expectedChainId]);

  useEffect(() => {
    refresh();
    const p = getInjectedProvider();
    if (!p?.on) return;
    const handler = () => refresh();
    p.on("accountsChanged", handler);
    p.on("chainChanged", handler);
    return () => {
      p.removeListener?.("accountsChanged", handler);
      p.removeListener?.("chainChanged", handler);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const addr = await connectWallet();
      if (addr) {
        setAddress(addr);
        const cid = await getChainId();
        setChainId(cid);
        setStatus(cid === expectedChainId ? "connected" : "wrong-network");
      } else {
        setStatus("disconnected");
      }
    } catch {
      setStatus("disconnected");
    }
  }, [expectedChainId]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
  }, []);

  const switchTo = useCallback(
    async (cid: string) => {
      const ok = await switchChain(cid);
      if (ok) await refresh();
      return ok;
    },
    [refresh],
  );

  return { status, address, chainId, connect, disconnect, switchTo };
}
