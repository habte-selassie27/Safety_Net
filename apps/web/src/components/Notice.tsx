import type { ReactNode } from "react";
import ui from "./ui.module.css";

export type NoticeVariant = "info" | "warning" | "error" | "success";

export interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  "data-testid"?: string;
}

const ICONS: Record<NoticeVariant, string> = {
  info: "i",
  warning: "!",
  error: "!",
  success: "✓",
};

export function Notice({
  variant = "info",
  title,
  children,
  action,
  dismissible,
  onDismiss,
  className,
  ...rest
}: NoticeProps) {
  const canDismiss =
    dismissible ?? (variant === "info" || variant === "success");
  const toneClass =
    variant === "warning"
      ? ui.noticeWarn
      : variant === "error"
        ? ui.noticeError
        : variant === "success"
          ? ui.noticeOk
          : "";
  const role = variant === "error" ? "alert" : "status";

  return (
    <div
      className={[ui.notice, toneClass, className].filter(Boolean).join(" ")}
      role={role}
      data-testid="notice"
      data-variant={variant}
      data-tone={variant === "warning" ? "warn" : variant}
      {...rest}
    >
      <span aria-hidden="true">{ICONS[variant]}</span>
      <div>
        {title ? <strong>{title}</strong> : null}
        {children ? <div>{children}</div> : null}
        {action ? <div>{action}</div> : null}
      </div>
      {canDismiss && onDismiss ? (
        <button type="button" aria-label="Dismiss notice" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
