import ui from "./ui.module.css";

export interface ClaimBadgeProps {
  claimed: boolean;
  className?: string;
}

export function ClaimBadge({ claimed, className }: ClaimBadgeProps) {
  return (
    <span
      className={[ui.badge, className].filter(Boolean).join(" ")}
      data-claimed={claimed ? "true" : "false"}
      data-testid="claim-badge"
    >
      {claimed ? "Claimed" : "Unclaimed"}
    </span>
  );
}
