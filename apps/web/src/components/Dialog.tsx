import { useEffect, useRef } from "react";
import ui from "./ui.module.css";

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} className={ui.card} onClose={onClose} aria-labelledby="dialog-title">
      <div className={ui.row} style={{ justifyContent: "space-between" }}>
        <h3 id="dialog-title">{title}</h3>
        <button className={ui.button} onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </dialog>
  );
}
