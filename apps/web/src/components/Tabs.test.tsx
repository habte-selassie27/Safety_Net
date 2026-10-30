// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Tabs } from "./Tabs";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("Tabs", () => {
  it("renders a tablist with the active tab selected", () => {
    act(() => {
      root?.render(
        <Tabs
          tabs={[
            { id: "a", label: "Alpha", panel: <div>Panel A</div> },
            { id: "b", label: "Beta", panel: <div>Panel B</div> },
          ]}
        />,
      );
    });
    const list = container?.querySelector('[role="tablist"]');
    expect(list).toBeTruthy();
    const tabs = container?.querySelectorAll('[role="tab"]') ?? [];
    expect(tabs.length).toBe(2);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(container?.textContent).toContain("Panel A");
  });
});
