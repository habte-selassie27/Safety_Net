// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Dialog } from "./Dialog";

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

describe("Dialog", () => {
  it("renders a labelled dialog with its content and a close control", () => {
    let closed = 0;
    act(() => {
      root?.render(
        <Dialog open={false} title="Trust boundary" onClose={() => closed++}>
          <p>Body copy</p>
        </Dialog>,
      );
    });
    const dialog = container?.querySelector("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-labelledby")).toBe("dialog-title");
    expect(container?.textContent).toContain("Trust boundary");
    expect(container?.textContent).toContain("Body copy");

    const close = container?.querySelector("button");
    act(() => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(closed).toBe(1);
  });
});
