import { EmptyState } from "../components/EmptyState";

export function NotFound() {
  return (
    <EmptyState
      testId="page-not-found"
      title="Page not found"
      action="Back to the record"
      actionTo="/incidents"
    >
      That route does not exist. The public record, policy gaps, and filing flow
      are linked from the navigation.
    </EmptyState>
  );
}
