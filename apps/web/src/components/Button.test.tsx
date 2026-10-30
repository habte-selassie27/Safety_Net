// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Button } from "./Button";

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

describe("Button", () => {
  it("renders primary by default with type button", async () => {
    await act(async () => {
      root?.render(<Button>Save</Button>);
    });
    const btn = container!.querySelector("button")!;
    expect(btn.textContent).toContain("Save");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("data-testid")).toBe("button");
  });

  it("disables and shows spinner when loading", async () => {
    await act(async () => {
      root?.render(<Button loading>Save</Button>);
    });
    const btn = container!.querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });

  it("renders secondary variant", async () => {
    await act(async () => {
      root?.render(<Button variant="secondary">Cancel</Button>);
    });
    const btn = container!.querySelector("button")!;
    expect(btn.className).toContain("secondary");
  });
});