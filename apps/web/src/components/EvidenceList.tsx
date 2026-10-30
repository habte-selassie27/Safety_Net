import type { EvidenceItemView } from "../data/types";
import { shortHash } from "../lib/format";
import ui from "./ui.module.css";

function EvidenceItem({ item }: { item: EvidenceItemView }) {
  return (
    <article className={ui.evidenceItem} data-testid="evidence-item">
      <div className={ui.rowBetween}>
        <div className={ui.row}>
          <span className={ui.chip}>{item.id}</span>
          <span className={ui.chip}>{item.kind}</span>
          {item.unavailable ? (
            <span className={ui.badge} data-verdict="INSUFFICIENT_EVIDENCE">
              unavailable
            </span>
          ) : null}
          {item.tampered ? (
            <span className={ui.badge} data-verdict="POLICY_VIOLATION">
              hash mismatch
            </span>
          ) : null}
        </div>
        <span className={`${ui.hint} ${ui.mono}`} title={item.contentSha256}>
          {shortHash(item.contentSha256)}
        </span>
      </div>
      {item.kind === "url" && item.url ? (
        <p style={{ marginTop: 8 }}>
          <a href={item.url} rel="noreferrer noopener" target="_blank">
            {item.url}
          </a>
        </p>
      ) : null}
      {item.kind === "inline" && item.text ? (
        <div className={ui.evidenceText}>{item.text}</div>
      ) : null}
      {item.note ? (
        <p className={ui.hint} style={{ marginTop: 8 }}>
          {item.note}
        </p>
      ) : null}
      <p className={ui.hint} style={{ marginTop: 6 }}>
        max {item.maxChars} chars · content hash pinned at filing
      </p>
    </article>
  );
}

export function EvidenceList({ items }: { items: EvidenceItemView[] }) {
  return (
    <div className={ui.stack}>
      {items.some((item) => item.kind === "inline") ? (
        <p className={`${ui.notice} ${ui.noticeWarn}`}>
          Inline evidence is public and permanent. It is the reporter's
          assertion, not proof of the event.
        </p>
      ) : null}
      {items.map((item) => (
        <EvidenceItem key={item.id} item={item} />
      ))}
    </div>
  );
}
