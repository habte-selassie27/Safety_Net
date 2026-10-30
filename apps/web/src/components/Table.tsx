import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface TableProps {
  caption?: string;
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function Table({
  caption,
  children,
  className,
  scrollable = true,
}: TableProps) {
  const wrapperClass = scrollable
    ? [ui.tableWrap, className].filter(Boolean).join(" ")
    : className;

  const wrapperProps = scrollable
    ? { role: "region", "aria-label": caption ?? "Table", tabIndex: 0 }
    : {};

  return (
    <div className={wrapperClass} data-testid="table" {...wrapperProps}>
      <table className={ui.table}>
        {caption ? <caption className={ui.srOnly}>{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
