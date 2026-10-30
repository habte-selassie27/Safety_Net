export function shortAddress(address: string): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  if (!hash) return "—";
  const value = hash.startsWith("sha256:") ? hash.slice(7) : hash;
  return value.length <= 16
    ? value
    : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return "—";
  return `${new Date(timestamp).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function hoursRemaining(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 3_600_000));
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "POLICY_VIOLATION":
      return "Policy violation";
    case "POLICY_ADEQUATE_BUT_HARM":
      return "Policy gap";
    case "INSUFFICIENT_EVIDENCE":
      return "Insufficient evidence";
    case "OUT_OF_SCOPE":
      return "Out of scope";
    case "DISMISSED":
      return "Dismissed";
    default:
      return verdict;
  }
}

export function verdictIcon(verdict: string): string {
  switch (verdict) {
    case "POLICY_VIOLATION":
      return "⚠";
    case "POLICY_ADEQUATE_BUT_HARM":
      return "◐";
    case "INSUFFICIENT_EVIDENCE":
      return "?";
    case "OUT_OF_SCOPE":
      return "⊘";
    case "DISMISSED":
      return "✓";
    default:
      return "•";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return "Open — awaiting response";
    case "RESPONDED":
      return "Responded — awaiting adjudication";
    case "DECIDED":
      return "Decided";
    case "APPEALED":
      return "Appealed — awaiting re-adjudication";
    case "FINAL":
      return "Final";
    default:
      return status;
  }
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
