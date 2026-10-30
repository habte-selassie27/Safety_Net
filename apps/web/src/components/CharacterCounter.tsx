import ui from "./ui.module.css";

export interface CharacterCounterProps {
  value: string;
  max: number;
  className?: string;
}

export function CharacterCounter({
  value,
  max,
  className,
}: CharacterCounterProps) {
  const count = [...value].length;
  const ratio = max > 0 ? count / max : 0;
  const near = ratio >= 0.9 && count <= max;
  const over = count > max;

  const toneClass = over ? ui.counterOver : near ? "" : "";

  return (
    <span
      className={[ui.counter, toneClass, className].filter(Boolean).join(" ")}
      data-testid="char-counter"
      aria-live={near || over ? "polite" : "off"}
    >
      {count.toLocaleString()} / {max.toLocaleString()} characters
    </span>
  );
}
