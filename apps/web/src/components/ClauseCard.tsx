import type { Clause } from "../data/types";
import ui from "./ui.module.css";

export function ClauseCard({
  clause,
  cited = false,
  reasonCode,
}: {
  clause: Clause;
  cited?: boolean;
  reasonCode?: string;
}) {
  return (
    <article
      className={`${ui.clause} ${cited ? ui.clauseCited : ""}`}
      data-testid="clause-card"
    >
      <div className={ui.clauseHead}>
        <div className={ui.row}>
          <span className={ui.clauseId}>{clause.id}</span>
          <strong style={{ fontSize: "0.92rem" }}>{clause.title}</strong>
          {clause.mandatory ? (
            <span className={ui.mandatory}>Mandatory</span>
          ) : null}
        </div>
        {cited ? (
          <span className={ui.chip}>{reasonCode ?? "Cited"}</span>
        ) : null}
      </div>
      <p className={ui.clauseText}>{clause.text}</p>
    </article>
  );
}
