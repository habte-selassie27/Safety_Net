// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SeverityMeter } from "./SeverityMeter";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root?.unmount();
  container?.remove();
  root = null;
  container = null;
});

async function render(severity: string | null, verdict?: string | null) {
  await act(async () => {
    root?.render(<SeverityMeter severity={severity} verdict={verdict} />);
  });
}

describe("SeverityMeter", () => {
  it("renders severity for violation verdict", async () => {
    await render("SERIOUS", "POLICY_VIOLATION");
    const meter = container?.querySelector("[data-testid='severity-meter']");
    expect(meter?.getAttribute("data-severity")).toBe("SERIOUS");
  });

  it("renders dash for non-violation verdict", async () => {
    await render("SERIOUS", "DISMISSED");
    const meter = container?.querySelector("[data-testid='severity-meter']");
    expect(meter?.textContent).toContain("—");
  });

  it("renders null severity", async () => {
    await render(null, "POLICY_VIOLATION");
    const meter = container?.querySelector("[data-testid='severity-meter']");
    expect(meter).not.toBeNull();
  });
});
