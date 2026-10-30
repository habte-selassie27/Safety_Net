// @vitest-environment happy-dom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Skeleton } from "./Skeleton";

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

describe("Skeleton", () => {
  it("renders a busy placeholder without announcing a false record", () => {
    act(() => {
      root?.render(<Skeleton height={24} />);
    });
    const node = container?.firstElementChild as HTMLElement | null;
    expect(node).toBeTruthy();
    expect(node?.getAttribute("aria-busy")).toBe("true");
    expect(node?.style.height).toBe("24px");
  });
});
