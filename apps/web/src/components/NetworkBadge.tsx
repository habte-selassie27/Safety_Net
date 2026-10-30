import { NETWORK } from "../lib/network";
import ui from "./ui.module.css";

const NETWORK_LABELS: Record<string, string> = {
  studionet: "StudioNet",
  local: "Local",
  asimov: "Asimov",
  bradbury: "Bradbury",
  sim: "Simulator",
};

export function NetworkBadge() {
  return (
    <span
      className={ui.network}
      data-testid="network-badge"
      title="Network used for reads and submissions"
    >
      <span className={ui.dot} aria-hidden="true" />
      {NETWORK_LABELS[NETWORK] ?? NETWORK}
    </span>
  );
}
