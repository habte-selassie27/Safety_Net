import type { ReactNode } from "react";
import { Link } from "../lib/router";
import ui from "./ui.module.css";

export function EmptyState({
  title,
  children,
  action,
  actionTo,
  testId = "empty-state",
}: {
  title: string;
  children?: ReactNode;
  action?: string;
  actionTo?: string;
  testId?: string;
}) {
  return (
    <div className={ui.empty} data-testid={testId}>
      <h3>{title}</h3>
      {children ? <p style={{ marginTop: 6 }}>{children}</p> : null}
      {action && actionTo ? (
        <p style={{ marginTop: 14 }}>
          <Link className={ui.button} to={actionTo}>
            {action}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
