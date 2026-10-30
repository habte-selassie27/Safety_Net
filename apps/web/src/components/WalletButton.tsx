import ui from "./ui.module.css";

export type WalletState =
  | "none"
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong-network";

export interface WalletButtonProps {
  state: WalletState;
  address?: string;
  chainName?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export function WalletButton({
  state,
  address,
  chainName,
  onConnect,
  onDisconnect,
  className,
}: WalletButtonProps) {
  if (state === "none") {
    return (
      <button
        type="button"
        className={[ui.button, ui.buttonSecondary, className]
          .filter(Boolean)
          .join(" ")}
        data-testid="wallet-button"
        disabled
        title="No browser wallet found."
      >
        Connect wallet
      </button>
    );
  }

  if (state === "disconnected") {
    return (
      <button
        type="button"
        className={[ui.button, className].filter(Boolean).join(" ")}
        data-testid="wallet-button"
        onClick={onConnect}
      >
        Connect wallet
      </button>
    );
  }

  if (state === "connecting") {
    return (
      <button
        type="button"
        className={[ui.button, className].filter(Boolean).join(" ")}
        data-testid="wallet-button"
        disabled
        aria-busy="true"
      >
        Connecting…
      </button>
    );
  }

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <div className={[ui.row, className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={[ui.button, ui.buttonSecondary, className]
          .filter(Boolean)
          .join(" ")}
        data-testid="wallet-button"
      >
        {short}
        {state === "wrong-network" ? (
          <span className={ui.muted} aria-hidden="true">
            !
          </span>
        ) : null}
      </button>
      <button type="button" className={ui.linkButton} onClick={onDisconnect}>
        Disconnect
      </button>
      {state === "wrong-network" && chainName ? (
        <span className={ui.muted}>Wrong network: {chainName}</span>
      ) : null}
    </div>
  );
}
