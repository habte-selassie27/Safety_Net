// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TrustNote } from "./TrustNote";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  if (container) container.remove();
  container = null;
});

describe("TrustNote", () => {
  it("short variant renders the trust boundary link", async () => {
    await act(async () => {
      root?.render(<TrustNote variant="short" />);
    });
    expect(container!.textContent).toContain("Policy compliance findings");
    expect(container!.querySelector("[data-testid='trust-note']")).not.toBeNull();
  });

  it("verdict variant renders the verbatim disclaimer", async () => {
    await act(async () => {
      root?.render(<TrustNote variant="verdict" />);
    });
    const el = container!.querySelector("[data-testid='legal-disclaimer']")!;
    expect(el.textContent).toContain("not an assessment of liability");
    expect(el.textContent).toContain("Always consult the original sources");
  });
});