import ui from "./ui.module.css";

export function Skeleton({ height = 16 }: { height?: number }) {
  return (
    <div
      className={ui.muted}
      style={{
        height,
        background: "var(--surface-2)",
        borderRadius: 6,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}
