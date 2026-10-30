import type { ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "md" | "sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  iconPosition = "left",
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.root];
  if (variant === "secondary") classes.push(styles.secondary);
  if (variant === "ghost") classes.push(styles.ghost);
  if (variant === "link") classes.push(styles.link);
  if (size === "sm") classes.push(styles.sm);
  if (loading) classes.push(styles.loading);
  if (className) classes.push(className);

  return (
    <button
      data-testid="button"
      type="button"
      className={classes.join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && iconPosition === "left" ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{children}</span>
      {icon && iconPosition === "right" ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
    </button>
  );
}
