import { formatDate } from "../lib/format";
import { Hash } from "./Hash";
import ui from "./ui.module.css";

export interface PolicyVersion {
  version: string;
  effectiveAt?: number;
  publishedAt?: number;
  clauseIds?: string[];
  clauses?: number;
  hash: string;
  url?: string;
  supersedes?: string;
  current?: boolean;
}

export interface PolicyVersionTableProps {
  versions: PolicyVersion[];
  className?: string;
}

export function PolicyVersionTable({
  versions,
  className,
}: PolicyVersionTableProps) {
  return (
    <div
      className={[ui.tableWrap, className].filter(Boolean).join(" ")}
      data-testid="policy-version-table"
    >
      <table className={ui.table}>
        <caption className={ui.srOnly}>Policy versions</caption>
        <thead>
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Effective</th>
            <th scope="col">Published</th>
            <th scope="col">Clauses</th>
            <th scope="col">Hash</th>
            <th scope="col">Source</th>
            <th scope="col">Supersedes</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version}>
              <td>
                {v.version}
                {v.current ? <span className={ui.badge}>Current</span> : null}
              </td>
              <td>{v.effectiveAt ? formatDate(v.effectiveAt) : "—"}</td>
              <td>{v.publishedAt ? formatDate(v.publishedAt) : "—"}</td>
              <td>{v.clauses ?? v.clauseIds?.length ?? "—"}</td>
              <td>
                <Hash value={v.hash} />
              </td>
              <td>
                {v.url ? (
                  <a href={v.url} target="_blank" rel="noopener noreferrer">
                    {new URL(v.url).host}
                  </a>
                ) : (
                  "Not provided."
                )}
              </td>
              <td>{v.supersedes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
