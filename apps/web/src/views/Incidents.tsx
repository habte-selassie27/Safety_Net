import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { SeverityChips } from "../components/SeverityChips";
import { SyntheticBadge } from "../components/SyntheticBadge";
import { VerdictBadge } from "../components/VerdictBadge";
import ui from "../components/ui.module.css";
import { filterIncidents } from "../data/store";
import { usePublishedIndex } from "../hooks/usePublishedIndex";
import { formatDate } from "../lib/format";
import { Link, navigate, useRoute, withParams } from "../lib/router";

const VERDICTS = [
  "POLICY_VIOLATION",
  "POLICY_ADEQUATE_BUT_HARM",
  "INSUFFICIENT_EVIDENCE",
  "OUT_OF_SCOPE",
  "DISMISSED",
];
const SEVERITIES = ["LOW", "MODERATE", "SERIOUS", "CRITICAL"];
const STATUSES = ["OPEN", "RESPONDED", "DECIDED", "APPEALED", "FINAL"];

export function Incidents() {
  const route = useRoute();
  const indexState = usePublishedIndex();
  const filters = {
    system: route.params.get("system") ?? undefined,
    verdict: route.params.get("verdict") ?? undefined,
    severity: route.params.get("severity") ?? undefined,
    status: route.params.get("status") ?? undefined,
    query: route.params.get("q") ?? undefined,
  };
  const update = (key: string, value: string) => {
    navigate(withParams(route.path, { [key]: value || undefined }));
  };
  const hasFilters = Object.values(filters).some(Boolean);

  if (indexState.status === "loading") {
    return (
      <div className={ui.stackLoose} data-testid="page-incidents">
        <Skeleton />
      </div>
    );
  }
  if (indexState.status === "error") {
    return (
      <ErrorState
        title="Could not load the incident index"
        body={indexState.error}
      />
    );
  }
  const state = { incidents: indexState.index.incidents, systems: indexState.index.systems };
  const incidents = filterIncidents(state.incidents, filters);

  return (
    <div className={ui.stackLoose} data-testid="page-incidents">
      <div className={ui.pageHead}>
        <div>
          <div className={ui.row} style={{ marginBottom: 6 }}>
            <SyntheticBadge />
          </div>
          <h1>Incident record</h1>
          <p className={ui.lede}>
            Every filed report, its pinned evidence, the provider response, and
            the policy compliance verdict.
          </p>
        </div>
        <Link className={ui.button} to="/report">
          Report an incident
        </Link>
      </div>

      <section
        aria-label="Filters"
        data-testid="filter-bar"
      >
        <Card>
        <div className={ui.grid4}>
          <label className={ui.field}>
            <span className={ui.label}>Search</span>
            <input
              className={ui.input}
              type="search"
              placeholder="System, id, claim…"
              value={filters.query ?? ""}
              onChange={(event) => update("q", event.target.value)}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.label}>System</span>
            <select
              className={ui.select}
              value={filters.system ?? ""}
              onChange={(event) => update("system", event.target.value)}
            >
              <option value="">All systems</option>
              {state.systems.map((system) => (
                <option key={system.system_id} value={system.system_id}>
                  {system.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Verdict</span>
            <select
              className={ui.select}
              value={filters.verdict ?? ""}
              onChange={(event) => update("verdict", event.target.value)}
            >
              <option value="">All verdicts</option>
              {VERDICTS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {verdict}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Severity</span>
            <select
              className={ui.select}
              value={filters.severity ?? ""}
              onChange={(event) => update("severity", event.target.value)}
            >
              <option value="">All severities</option>
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Status</span>
            <select
              className={ui.select}
              value={filters.status ?? ""}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className={ui.field} style={{ justifyContent: "flex-end" }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasFilters}
              onClick={() => navigate(route.path)}
            >
              Clear filters
            </Button>
          </div>
        </div>
        <output
          className={ui.hint}
          aria-live="polite"
          data-testid="result-summary"
        >
          {incidents.length} of {state.incidents.length} incidents
        </output>
        </Card>
      </section>

      {incidents.length === 0 ? (
        <EmptyState
          testId="incidents-empty"
          title="No incidents match those filters"
          action={hasFilters ? "Clear filters" : "File the first incident"}
          actionTo={hasFilters ? route.path : "/report"}
        >
          {hasFilters
            ? "Try a broader search or a different verdict."
            : "The record is empty. A filed incident is permanent."}
        </EmptyState>
      ) : (
        <div className={ui.tableWrap} data-testid="incident-list-table">
          <table className={ui.table}>
            <caption className={ui.srOnly}>
              Incident reports, newest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Incident</th>
                <th scope="col">System</th>
                <th scope="col">Verdict</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.incident_id} data-testid="incident-row">
                  <td>
                    <Link
                      to={`/incidents/${incident.incident_id}`}
                      className={ui.mono}
                    >
                      {incident.incident_id}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/systems/${incident.system_id}`}>
                      {incident.system_name}
                    </Link>
                  </td>
                  <td>
                    <VerdictBadge verdict={incident.verdict?.verdict} />
                  </td>
                  <td>
                    <SeverityChips severity={incident.verdict?.severity} />
                    {!incident.verdict ? (
                      <span className={ui.hint}>—</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={ui.chip}>{incident.status}</span>
                  </td>
                  <td className={ui.hint}>
                    {formatDate(
                      incident.verdict?.ruled_at ?? incident.filed_at,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
