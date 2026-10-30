// @vitest-environment happy-dom
//
// Smoke tests for the public web app. These render the real hash-router shell
// and exercise the demo provider and filing flows against the in-memory store.
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import { demoStore } from "./data/store";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement | null = null;

async function renderAt(path: string): Promise<HTMLElement> {
  window.history.replaceState(
    null,
    "",
    path.startsWith("/") ? path : `/${path}`,
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<App />);
  });
  return container;
}

async function navigateTo(path: string): Promise<void> {
  await act(async () => {
    window.history.pushState(
      null,
      "",
      path.startsWith("/") ? path : `/${path}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function text(): string {
  return container?.textContent ?? "";
}

function button(label: string): HTMLButtonElement {
  const match = [...(container?.querySelectorAll("button") ?? [])].find(
    (entry) => entry.textContent?.trim() === label,
  );
  if (!match) throw new Error(`No button labelled "${label}"`);
  return match;
}

async function click(label: string): Promise<void> {
  const target = button(label);
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function fill(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
): void {
  if (!element) throw new Error("Expected a form field");
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  demoStore.reset();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container = null;
  document.body.innerHTML = "";
});

describe("public routes", () => {
  it("renders the home feed and trust boundary link", async () => {
    await renderAt("/");
    expect(text()).toContain("The public record of");
    expect(text()).toContain("Latest verdicts");
    expect(text()).toContain("Policy gaps");
    expect(text()).toContain("What a verdict does not mean");
  });

  it("renders an incident with verdict, cited clause, and evidence", async () => {
    await renderAt("/incidents/inc-000001");
    expect(text()).toContain("Synthetic Chatbot");
    expect(text()).toContain("Policy violation");
    expect(text()).toContain("C1");
    expect(text()).toContain("Take 4000mg");
    expect(text()).toContain("Provider response");
    expect(text()).toContain("Round 2");
  });

  it("renders the policy gaps screen", async () => {
    await renderAt("/policy-gaps");
    expect(text()).toContain("Policy gaps");
    expect(text()).toContain("C4");
    expect(text()).toContain("inc-000003");
  });

  it("renders systems with claimed and unverified states", async () => {
    await renderAt("/systems");
    expect(text()).toContain("Synthetic Chatbot");
    expect(text()).toContain("Claimed");
    expect(text()).toContain("Unclaimed");
  });

  it("renders the provider console with the open synthetic incident", async () => {
    await renderAt("/provider?system=synthetic-chatbot-1");
    expect(text()).toContain("Provider console");
    expect(text()).toContain("Open & responded incidents");
    expect(text()).toContain("inc-000006");
    expect(text()).toContain("Demo mode acts as this provider");
  });

  it("renders the five-step filing flow", async () => {
    await renderAt("/report?system=synthetic-chatbot-1");
    expect(text()).toContain("Report an incident");
    expect(text()).toContain("1. System & policy");
    expect(text()).toContain("Pinned policy");
  });

  it("renders the trust boundary and disclaimer", async () => {
    await renderAt("/about");
    expect(text()).toContain("A verdict means");
    expect(text()).toContain("A verdict does not mean");
    expect(text()).toContain("not a legal determination");
  });

  it("renders the open data page", async () => {
    await renderAt("/data");
    expect(text()).toContain("Open data");
    expect(text()).toContain("Query snippets");
    expect(text()).toContain("hashes and verdicts");
  });

  it("renders the embed without the public shell", async () => {
    await renderAt("/embed/system/synthetic-chatbot-1");
    expect(text()).toContain("Synthetic Chatbot");
    expect(text()).toContain("Open the full SafetyNet record");
    expect(text()).not.toContain("Provider console");
  });

  it("renders a not-found page for an unknown route", async () => {
    await renderAt("/does-not-exist");
    expect(text()).toContain("Page not found");
  });

  it("updates the route when history changes", async () => {
    await renderAt("/");
    await navigateTo("/incidents");
    expect(text()).toContain("Incident record");
  });
});

describe("demo provider flows", () => {
  it("claims an unverified system", async () => {
    await renderAt("/systems/synthetic-codegen-1");
    expect(text()).toContain("Unverified provider");
    await click("Claim this system (demo)");
    expect(text()).toContain("Provider claimed");
    expect(demoStore.system("synthetic-codegen-1")?.claimed).toBe(true);
  });

  it("responds to an open incident as the claimed provider", async () => {
    await renderAt("/provider?system=synthetic-chatbot-1");
    await click("Respond");
    const field = container?.querySelector("textarea") ?? null;
    fill(
      field,
      "We audited the refusal path and are adding a category label to every decline message.",
    );
    await click("Submit defense");
    expect(text()).toContain("Response recorded");
    expect(demoStore.incident("inc-000006")?.status).toBe("RESPONDED");
    expect(
      demoStore.incident("inc-000006")?.response?.provider.toLowerCase(),
    ).toBe(demoStore.system("synthetic-chatbot-1")?.claimed_by.toLowerCase());
  });

  it("appeals a decided incident within the window", async () => {
    await renderAt("/provider?system=synthetic-chatbot-1");
    await click("Appeal this verdict");
    const field = container?.querySelector("textarea") ?? null;
    fill(
      field,
      "The screenshot was unavailable but the transcript retention log now exists and should be considered.",
    );
    await click("File appeal");
    expect(text()).toContain("Appeal recorded");
    expect(demoStore.incident("inc-000005")?.status).toBe("APPEALED");
    expect(demoStore.incident("inc-000005")?.appeals).toHaveLength(1);
  });
});

describe("demo filing flow", () => {
  it("files a synthetic incident and opens its page", async () => {
    await renderAt("/report?system=synthetic-chatbot-1");
    await click("Continue");
    expect(text()).toContain("2. Claim");

    fill(
      container?.querySelector("textarea") ?? null,
      "SYNTHETIC: The assistant declined a benefits request without naming the restriction category, contrary to clause C2.",
    );
    await click("Continue");
    expect(text()).toContain("3. Evidence");

    fill(
      container?.querySelector("textarea") ?? null,
      "SYNTHETIC TRANSCRIPT — Assistant: 'I can't help with that.' No category was named, contrary to clause C2.",
    );
    await click("Continue");
    expect(text()).toContain("4. Review");
    expect(text()).toContain("Evidence hash");

    const acknowledge = container?.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(acknowledge).not.toBeNull();
    await act(async () => {
      acknowledge?.click();
    });
    await click("Continue to submit");
    expect(text()).toContain("5. Submit");

    await click("Submit incident (demo)");
    expect(demoStore.incident("inc-000007")?.status).toBe("OPEN");
    expect(text()).toContain("Open inc-000007");
  });
});
