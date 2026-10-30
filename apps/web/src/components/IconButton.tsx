import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

export function IconButton({
  label,
  icon,
  className,
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid="icon-button"
      title={title ?? label}
      className={[ui.iconButton, className].filter(Boolean).join(" ")}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
