import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface ErrorStateProps {
  title: string;
  body?: string;
  code?: string;
  actions?: ReactNode;
  details?: string;
  className?: string;
}

export function ErrorState({
  title,
  body,
  code,
  actions,
  details,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={[ui.errorBanner, className].filter(Boolean).join(" ")}
      role="alert"
      data-testid="error-state"
    >
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {code ? (
        <p>
          <code className={ui.mono} data-testid="error-code">
            {code}
          </code>
        </p>
      ) : null}
      {actions ? <div>{actions}</div> : null}
      {details ? (
        <details>
          <summary>Technical details</summary>
          <pre>{details}</pre>
        </details>
      ) : null}
    </div>
  );
}
