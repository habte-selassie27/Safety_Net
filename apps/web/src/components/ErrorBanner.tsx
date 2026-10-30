import ui from "./ui.module.css";

export function ErrorBanner({
  code,
  message,
  onRetry,
}: {
  code?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={ui.errorBanner} role="alert" data-testid="error-state">
      <strong>{code ? `${code}: ` : ""}Something went wrong</strong>
      <p style={{ marginTop: 4 }}>{message}</p>
      {onRetry ? (
        <p style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSecondary} ${ui.buttonSmall}`}
            onClick={onRetry}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
