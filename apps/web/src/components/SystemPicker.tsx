import { useState } from "react";
import ui from "./ui.module.css";

export interface SystemOption {
  id: string;
  name: string;
  claimed?: boolean;
  version?: string;
}

export interface SystemPickerProps {
  label?: string;
  options: SystemOption[];
  value?: string;
  onChange: (id: string) => void;
  className?: string;
}

export function SystemPicker({
  label = "AI system",
  options,
  value,
  onChange,
  className,
}: SystemPickerProps) {
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.id === value) ?? null;
  const filtered = options.filter((option) => {
    const needle = query.toLowerCase();
    return (
      option.name.toLowerCase().includes(needle) ||
      option.id.toLowerCase().includes(needle)
    );
  });

  if (selected) {
    return (
      <div
        className={className}
        data-testid="system-picker"
        data-state="closed"
      >
        <div className={ui.card}>
          <strong>{selected.name}</strong>
          <code className={ui.mono}>{selected.id}</code>
          {selected.version ? (
            <span className={ui.muted}>Policy v{selected.version}</span>
          ) : null}
          <button
            type="button"
            className={ui.linkButton}
            onClick={() => onChange("")}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="system-picker" data-state="open">
      <label className={ui.label} htmlFor="system-picker-search">
        Filter {label.toLowerCase()}
      </label>
      <input
        id="system-picker-search"
        className={ui.input}
        type="search"
        placeholder="Search by name or system ID"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <label className={ui.label} htmlFor="system-picker-select">
        {label}
      </label>
      <select
        id="system-picker-select"
        className={ui.select}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {filtered.length === 0 ? "No system matches" : "Choose an AI system"}
        </option>
        {filtered.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} — {option.id}
            {option.claimed === undefined
              ? ""
              : option.claimed
                ? " (claimed)"
                : " (unclaimed)"}
            {option.version ? ` · policy v${option.version}` : ""}
          </option>
        ))}
      </select>
      {filtered.length === 0 ? (
        <p className={ui.muted}>
          Systems are registered through the CLI in v1.
        </p>
      ) : null}
    </div>
  );
}
