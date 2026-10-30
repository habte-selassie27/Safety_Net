import { useState } from "react";
import styles from "./CopyButton.module.css";
import ui from "./ui.module.css";

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [message, setMessage] = useState("");

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("copy failed");
      }
      setState("copied");
      setMessage("Copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      setMessage("Copy failed — select the text and copy manually.");
    }
  }

  return (
    <>
      <button
        type="button"
        className={[
          styles.root,
          state === "failed" ? styles.failed : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${label}`}
        data-testid="copy-button"
        onClick={handleCopy}
      >
        {state === "copied" ? "✓" : "Copy"}
      </button>
      {state === "failed" ? (
        <output className={styles.failed}>{message}</output>
      ) : null}
      <output className={ui.srOnly} aria-live="polite">
        {state === "copied" ? "Copied" : ""}
      </output>
    </>
  );
}
