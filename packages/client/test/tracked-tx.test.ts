import { describe, expect, it } from "vitest";

import { FakeAdapter } from "../src/fake-adapter";
import { TrackedTxImpl } from "../src/tracked-tx";
import {
  TxFailedError,
  type TxStatusEvent,
  TxTimeoutError,
} from "../src/types";

function makeAdapter(): FakeAdapter {
  return new FakeAdapter();
}

describe("TrackedTx", () => {
  it("emits every distinct status once and resolves the result", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(
      ["PENDING", "PROPOSING", "COMMITTING", "ACCEPTED"],
      "inc-000001",
    );
    const events: TxStatusEvent[] = [];
    const tx = new TrackedTxImpl<string>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "adjudicate",
          args: [],
        }),
      poll: { initialMs: 1, sleep: async () => {} },
    });
    tx.on("status", (event) => events.push(event));

    await expect(tx.result).resolves.toBe("inc-000001");
    expect(events.map((event) => event.status)).toEqual([
      "PENDING",
      "PROPOSING",
      "COMMITTING",
      "ACCEPTED",
    ]);
    expect(events.every((event) => typeof event.elapsedMs === "number")).toBe(
      true,
    );
  });

  it("collapses repeated statuses into one event", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(["PENDING", "PENDING", "PENDING", "ACCEPTED"], "ok");
    const statuses: string[] = [];
    const tx = new TrackedTxImpl<string>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: { initialMs: 1, sleep: async () => {} },
    });
    tx.on("status", (event) => statuses.push(event.status));
    await tx.result;
    expect(statuses).toEqual(["PENDING", "ACCEPTED"]);
  });

  it("backs off adaptively and caps at maxMs", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(
      [
        "PENDING",
        "PENDING",
        "PENDING",
        "PENDING",
        "PENDING",
        "PENDING",
        "PENDING",
        "ACCEPTED",
      ],
      "ok",
    );
    const sleeps: number[] = [];
    const tx = new TrackedTxImpl<string>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: {
        initialMs: 500,
        maxMs: 3000,
        factor: 1.5,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    });
    await tx.result;
    expect(sleeps.slice(0, 5)).toEqual([500, 750, 1125, 1688, 2532]);
    expect(Math.max(...sleeps)).toBe(3000);
  });

  it("rejects with TxFailedError on a non-success terminal status", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(["PENDING", "UNDETERMINED"], null);
    const tx = new TrackedTxImpl<unknown>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: { initialMs: 1, sleep: async () => {} },
    });
    await expect(tx.result).rejects.toBeInstanceOf(TxFailedError);
    await expect(tx.result).rejects.toMatchObject({
      status: "UNDETERMINED",
      code: "E5002",
    });
  });

  it("rejects with TxTimeoutError when the deadline passes", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(["PENDING", "PENDING", "PENDING", "ACCEPTED"], "never");
    let clock = 0;
    const tx = new TrackedTxImpl<unknown>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: {
        initialMs: 1,
        timeoutMs: 50,
        now: () => {
          clock += 100;
          return clock;
        },
        sleep: async () => {},
      },
    });
    await expect(tx.result).rejects.toBeInstanceOf(TxTimeoutError);
  });

  it("pauses polling while the page is hidden", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(["PENDING", "ACCEPTED"], "ok");
    let hidden = true;
    let sleepCount = 0;
    const tx = new TrackedTxImpl<string>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: {
        initialMs: 1,
        sleep: async () => {
          sleepCount += 1;
          if (sleepCount >= 2) hidden = false;
        },
        isHidden: () => hidden,
        onVisible: () => () => {},
      },
    });
    await tx.result;
    // The first two sleeps happened while hidden; no status call was made yet.
    expect(adapter.statusCalls.length).toBeGreaterThan(0);
    expect(sleepCount).toBeGreaterThanOrEqual(2);
  });

  it("stops polling when cancelled", async () => {
    const adapter = makeAdapter();
    adapter.queueWrite(["PENDING", "PENDING", "ACCEPTED"], "ok");
    const tx = new TrackedTxImpl<string>({
      adapter,
      submit: () =>
        adapter.submitWrite({
          address: `0x${"11".repeat(20)}`,
          method: "x",
          args: [],
        }),
      poll: {
        initialMs: 1,
        sleep: async () => {
          tx.cancelPolling();
        },
      },
    });
    await expect(tx.result).rejects.toBeInstanceOf(TxFailedError);
    await expect(tx.result).rejects.toMatchObject({ status: "CANCELED" });
  });
});
