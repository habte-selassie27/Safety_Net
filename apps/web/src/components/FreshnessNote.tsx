import { formatDateTime, timeAgo } from "../lib/format";
import ui from "./ui.module.css";

export interface FreshnessNoteProps {
  updatedAt?: number | null;
  now?: number;
  className?: string;
}

export function FreshnessNote({
  updatedAt,
  now = Date.now(),
  className,
}: FreshnessNoteProps) {
  if (!updatedAt || !Number.isFinite(updatedAt)) {
    return (
      <p
        className={[ui.muted, className].filter(Boolean).join(" ")}
        data-testid="freshness-note"
        data-freshness="unknown"
      >
        Index freshness unknown. Detail pages read the live chain.
      </p>
    );
  }

  const ms = updatedAt > 1e12 ? updatedAt : updatedAt * 1000;
  const ageMs = now - ms;
  const stale = ageMs > 24 * 60 * 60 * 1000;
  const freshness = stale ? "stale" : "fresh";

  return (
    <p
      className={[stale ? ui.noticeWarn : ui.muted, className]
        .filter(Boolean)
        .join(" ")}
      data-testid="freshness-note"
      data-freshness={freshness}
    >
      Index updated {formatDateTime(ms)} ({timeAgo(ms, now)}).
      {stale ? " Detail pages still read the live chain." : ""}
    </p>
  );
}
