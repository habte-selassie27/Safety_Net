import type { ReactNode } from "react";

export interface DisclosureProps {
  summary: string;
  children: ReactNode;
  open?: boolean;
  className?: string;
}

export function Disclosure({
  summary,
  children,
  open,
  className,
}: DisclosureProps) {
  return (
    <details
      className={className}
      open={open}
      data-testid="disclosure"
      data-state={open ? "open" : "closed"}
    >
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
