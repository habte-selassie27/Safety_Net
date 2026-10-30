import type { ReactNode } from "react";
import { formatDate } from "../lib/format";
import { VerdictBadge } from "./VerdictBadge";
import ui from "./ui.module.css";

export interface TimelineItem {
  id?: string;
  label: string;
  date?: number;
  body?: ReactNode;
  current?: boolean;
  verdict?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol
      className={[ui.timeline, className].filter(Boolean).join(" ")}
      data-testid="timeline"
    >
      {items.map((item, i) => (
        <li
          key={item.id ?? i}
          className={ui.timelineItem}
          aria-current={item.current ? "step" : undefined}
        >
          <div className={ui.row}>
            <strong>{item.label}</strong>
            {item.current ? <span className={ui.muted}>(Current)</span> : null}
            {item.verdict ? <VerdictBadge verdict={item.verdict} /> : null}
          </div>
          {item.date ? (
            <div className={ui.muted}>{formatDate(item.date)}</div>
          ) : null}
          {item.body ? <div>{item.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}
