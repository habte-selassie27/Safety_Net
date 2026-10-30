import { shortAddress, shortHash } from "../lib/format";
import { CopyButton } from "./CopyButton";
import ui from "./ui.module.css";

export interface HashProps {
  label?: string;
  value: string;
  short?: string;
  copyable?: boolean;
  className?: string;
}

const HASH_RE = /^sha256:[0-9a-fA-F]{64}$/;

export function Hash({
  label,
  value,
  short,
  copyable = true,
  className,
}: HashProps) {
  const valid = HASH_RE.test(value);
  const display = short ?? (valid ? shortHash(value) : value);

  if (!valid) {
    return (
      <span
        className={[ui.mono, className].filter(Boolean).join(" ")}
        data-testid="hash"
      >
        Invalid hash
        <details>
          <summary>Raw value</summary>
          <code>{value}</code>
        </details>
      </span>
    );
  }

  return (
    <span
      className={[ui.mono, className].filter(Boolean).join(" ")}
      data-testid="hash"
    >
      {label ? <span className={ui.muted}>{label}: </span> : null}
      <code title={value}>{display}</code>
      {copyable ? (
        <CopyButton value={value} label={`Copy ${label ?? "hash"}`} />
      ) : null}
    </span>
  );
}

export interface AddressProps {
  label?: string;
  value: string;
  copyable?: boolean;
  className?: string;
}

export function Address({
  label,
  value,
  copyable = true,
  className,
}: AddressProps) {
  const display = shortAddress(value);
  return (
    <span
      className={[ui.mono, className].filter(Boolean).join(" ")}
      data-testid="address"
    >
      {label ? <span className={ui.muted}>{label}: </span> : null}
      <code title={value}>{display}</code>
      {copyable ? (
        <CopyButton value={value} label={`Copy ${label ?? "address"}`} />
      ) : null}
    </span>
  );
}
