import ui from "./ui.module.css";

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  system?: string;
  onSystemChange?: (value: string) => void;
  systems?: { id: string; name: string }[];
  verdict?: string;
  onVerdictChange?: (value: string) => void;
  severity?: string;
  onSeverityChange?: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  sort?: string;
  onSortChange?: (value: string) => void;
  onClear?: () => void;
  resultSummary?: string;
  className?: string;
}

const VERDICTS = [
  "POLICY_VIOLATION",
  "POLICY_ADEQUATE_BUT_HARM",
  "INSUFFICIENT_EVIDENCE",
  "OUT_OF_SCOPE",
  "DISMISSED",
];
const SEVERITIES = ["LOW", "MODERATE", "SERIOUS", "CRITICAL"];
const STATUSES = ["OPEN", "RESPONDED", "DECIDED", "APPEALED", "FINAL"];
const SORTS = ["newest", "decided", "severity"];

export function FilterBar({
  search = "",
  onSearchChange,
  system = "",
  onSystemChange,
  systems = [],
  verdict = "",
  onVerdictChange,
  severity = "",
  onSeverityChange,
  status = "",
  onStatusChange,
  sort = "newest",
  onSortChange,
  onClear,
  resultSummary,
  className,
}: FilterBarProps) {
  return (
    <div
      className={[ui.row, className].filter(Boolean).join(" ")}
      data-testid="filter-bar"
    >
      <label>
        Search incidents
        <input
          className={ui.input}
          type="search"
          value={search}
          placeholder="Incident ID, system, or clause"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </label>
      <label>
        System
        <select
          className={ui.select}
          value={system}
          onChange={(e) => onSystemChange?.(e.target.value)}
        >
          <option value="">All systems</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Verdict
        <select
          className={ui.select}
          value={verdict}
          onChange={(e) => onVerdictChange?.(e.target.value)}
        >
          <option value="">All verdicts</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Severity
        <select
          className={ui.select}
          value={severity}
          onChange={(e) => onSeverityChange?.(e.target.value)}
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          className={ui.select}
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort
        <select
          className={ui.select}
          value={sort}
          onChange={(e) => onSortChange?.(e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {onClear ? (
        <button type="button" className={ui.linkButton} onClick={onClear}>
          Clear all
        </button>
      ) : null}
      {resultSummary ? (
        <span className={ui.muted} aria-live="polite">
          {resultSummary}
        </span>
      ) : null}
    </div>
  );
}
