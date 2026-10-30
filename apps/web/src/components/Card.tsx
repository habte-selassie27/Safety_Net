import type { ReactNode } from "react";
import { Link } from "../lib/router";
import ui from "./ui.module.css";

export interface CardProps {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}

export function Card({ children, className, flush }: CardProps) {
  const classes = [ui.card, flush ? ui.cardFlush : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} data-testid="card">
      {children}
    </div>
  );
}

export interface CardLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function CardLink({ to, children, className }: CardLinkProps) {
  return (
    <Link
      to={to}
      className={[ui.cardLink, className].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
