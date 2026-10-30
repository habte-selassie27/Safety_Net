import { Link } from "../lib/router";
import ui from "./ui.module.css";

export interface TrustNoteProps {
  variant?: "short" | "verdict";
  className?: string;
}

const VERBATIM =
  "SafetyNet publishes policy compliance findings produced by independent validators against a provider's own published policy. A finding is not a legal determination, not an assessment of liability, and not a statement that an AI system is safe or unsafe in general. Evidence is supplied by reporters and is not independently authenticated. Always consult the original sources and the cited policy version.";

export function TrustNote({ variant = "short", className }: TrustNoteProps) {
  if (variant === "verdict") {
    return (
      <p
        className={[ui.muted, className].filter(Boolean).join(" ")}
        data-testid="legal-disclaimer"
      >
        {VERBATIM}
      </p>
    );
  }

  return (
    <p
      className={[ui.muted, className].filter(Boolean).join(" ")}
      data-testid="trust-note"
    >
      Policy compliance findings, not legal determinations.{" "}
      <Link to="/about#trust-boundary">Read the trust boundary →</Link>
    </p>
  );
}
