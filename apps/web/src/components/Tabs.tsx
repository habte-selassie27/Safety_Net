import type { ReactNode } from "react";
import ui from "./ui.module.css";

export interface Tab {
  id: string;
  label: string;
  panel: ReactNode;
}

export function Tabs({ tabs, initialId }: { tabs: Tab[]; initialId?: string }) {
  const active = initialId ?? tabs[0]?.id;
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className={ui.row} role="tablist" aria-label="Tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab?.id}
            className={ui.button}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ marginTop: 12 }}>
        {tab?.panel}
      </div>
    </div>
  );
}
