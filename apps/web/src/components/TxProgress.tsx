import ui from "./ui.module.css";

export type TxStatus =
  | "PENDING"
  | "PROPOSING"
  | "COMMITTING"
  | "REVEALING"
  | "ACCEPTED"
  | "FINALIZED"
  | "UNDETERMINED"
  | "CANCELED"
  | "ERROR";

const ORDER: TxStatus[] = [
  "PENDING",
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "ACCEPTED",
  "FINALIZED",
];

export interface TxEvent {
  status: TxStatus;
  elapsedMs: number;
}

export function TxProgress({
  status,
  hash,
  events = [],
}: {
  status: TxStatus;
  hash?: string;
  events?: TxEvent[];
}) {
  const failed =
    status === "UNDETERMINED" || status === "CANCELED" || status === "ERROR";
  const currentIndex = failed ? -1 : ORDER.indexOf(status);
  const latest = events.length ? events[events.length - 1] : undefined;

  return (
    <section
      aria-label="Transaction progress"
      data-testid="tx-progress"
      className={ui.notice}
      style={{ marginTop: 12 }}
    >
      <div className={ui.rowBetween}>
        <strong>
          {failed
            ? status === "UNDETERMINED"
              ? "Validators did not converge"
              : status === "CANCELED"
                ? "Transaction cancelled"
                : "Transaction failed"
            : status === "FINALIZED"
              ? "Finalized"
              : `Transaction ${status.toLowerCase()}`}
        </strong>
        {latest ? <span className={ui.hint}>{latest.elapsedMs} ms</span> : null}
      </div>
      <ol className={ui.stepper} aria-live="polite">
        {ORDER.map((step, index) => {
          const state =
            failed && index === 0
              ? "failed"
              : index < currentIndex
                ? "done"
                : index === currentIndex
                  ? "active"
                  : "todo";
          return (
            <li
              key={step}
              className={`${ui.step} ${state === "done" ? ui.stepDone : ""} ${
                state === "active" ? ui.stepActive : ""
              }`}
            >
              <span className={ui.stepDot} aria-hidden="true" />
              {step}
            </li>
          );
        })}
      </ol>
      {failed ? (
        <p className={ui.errorText} style={{ marginTop: 6 }}>
          {status === "UNDETERMINED"
            ? "No verdict was stored. The incident is unchanged. Try adjudication again or narrow the cited clause."
            : "No verdict was stored. Check the transaction hash before retrying."}
        </p>
      ) : null}
      {hash ? (
        <p className={`${ui.hint} ${ui.mono}`} style={{ marginTop: 6 }}>
          tx {hash}
        </p>
      ) : null}
    </section>
  );
}
