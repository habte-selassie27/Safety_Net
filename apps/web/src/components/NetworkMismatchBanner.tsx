import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface NetworkMismatchBannerProps {
  networkName: string;
  walletChainName: string;
  onSwitch?: () => void;
  help?: ReactNode;
  className?: string;
}

export function NetworkMismatchBanner({
  networkName,
  walletChainName,
  onSwitch,
  help,
  className,
}: NetworkMismatchBannerProps) {
  return (
    <div
      className={[ui.notice, ui.noticeWarn, className]
        .filter(Boolean)
        .join(" ")}
      role="alert"
      data-testid="network-mismatch-banner"
    >
      <strong>Wrong network.</strong> SafetyNet is on {networkName}. Your wallet
      is on {walletChainName}.
      {onSwitch ? (
        <button type="button" className={ui.linkButton} onClick={onSwitch}>
          Switch network
        </button>
      ) : null}
      {help ? <div>{help}</div> : null}
    </div>
  );
}
