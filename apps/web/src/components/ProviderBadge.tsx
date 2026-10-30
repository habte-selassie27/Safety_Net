import { Link } from "../lib/router";
import { ClaimBadge } from "./ClaimBadge";
import ui from "./ui.module.css";

export interface ProviderBadgeProps {
  claimed: boolean;
  className?: string;
}

export function ProviderBadge({ claimed, className }: ProviderBadgeProps) {
  return (
    <span
      className={className}
      data-testid="provider-badge"
      data-claimed={claimed ? "true" : "false"}
    >
      <ClaimBadge claimed={claimed} />
      <Link to="/about#claiming" className={ui.linkButton}>
        What does claimed mean?
      </Link>
    </span>
  );
}
