import { NETWORK } from "../lib/network";
import ui from "./ui.module.css";

export function NetworkBadge() {
  return (
    <span
      className={ui.network}
      data-testid="network-badge"
      title="Network used for reads and submissions"
    >
      <span className={ui.dot} aria-hidden="true" />
      {NETWORK}
    </span>
  );
}
