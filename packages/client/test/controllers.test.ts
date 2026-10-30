import { describe, expect, it } from "vitest";

import { ReadController, WriteController } from "../src/controllers";
import { FakeAdapter } from "../src/fake-adapter";
import { TrackedTxImpl } from "../src/tracked-tx";

describe("ReadController", () => {
  it("moves from loading to data", async () => {
    const controller = new ReadController(async () => 42);
    expect(controller.getSnapshot()).toEqual({
      data: null,
      loading: true,
      error: null,
    });
    const updates: number[] = [];
    controller.subscribe(() => updates.push(1));
    await controller.fetch();
    expect(controller.getSnapshot()).toEqual({
      data: 42,
      loading: false,
      error: null,
    });
    expect(updates.length).toBe(2);
  });

  it("captures errors", async () => {
    const controller = new ReadController(async () => {
      throw new Error("boom");
    });
    await controller.fetch();
    expect(controller.getSnapshot().error?.message).toBe("boom");
    expect(controller.getSnapshot().loading).toBe(false);
  });

  it("reloads with a new loader", async () => {
    const controller = new ReadController(async () => 1);
    await controller.fetch();
    expect(controller.getSnapshot().data).toBe(1);
    await controller.reload(async () => 2);
    expect(controller.getSnapshot().data).toBe(2);
  });

  it("ignores a stale response when a newer fetch started", async () => {
    let releaseFirst: (value: number) => void = () => {};
    let first = true;
    const controller = new ReadController(
      () =>
        new Promise<number>((resolve) => {
          if (first) {
            first = false;
            releaseFirst = resolve;
          } else {
            resolve(2);
          }
        }),
    );
    const pending = controller.fetch();
    await controller.fetch();
    releaseFirst(1);
    await pending;
    expect(controller.getSnapshot().data).toBe(2);
  });
});

describe("WriteController", () => {
  it("collects status events and resolves the result", async () => {
    const adapter = new FakeAdapter();
    adapter.queueWrite(["PENDING", "PROPOSING", "ACCEPTED"], "verdict");
    const controller = new WriteController<string>();
    const updates: string[] = [];
    controller.subscribe(() => updates.push("update"));
    const result = await controller.run(
      () =>
        new TrackedTxImpl<string>({
          adapter,
          submit: () =>
            adapter.submitWrite({
              address: `0x${"11".repeat(20)}`,
              method: "x",
              args: [],
            }),
          poll: { initialMs: 1, sleep: async () => {} },
        }),
    );
    expect(result).toBe("verdict");
    const state = controller.getSnapshot();
    expect(state.running).toBe(false);
    expect(state.status).toBe("ACCEPTED");
    expect(state.events.map((event) => event.status)).toEqual([
      "PENDING",
      "PROPOSING",
      "ACCEPTED",
    ]);
    expect(state.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(updates.length).toBeGreaterThan(0);
  });

  it("captures failures and resets", async () => {
    const adapter = new FakeAdapter();
    adapter.queueWrite(["PENDING", "UNDETERMINED"], null);
    const controller = new WriteController<unknown>();
    const result = await controller.run(
      () =>
        new TrackedTxImpl<unknown>({
          adapter,
          submit: () =>
            adapter.submitWrite({
              address: `0x${"11".repeat(20)}`,
              method: "x",
              args: [],
            }),
          poll: { initialMs: 1, sleep: async () => {} },
        }),
    );
    expect(result).toBeNull();
    expect(controller.getSnapshot().error?.message).toContain("UNDETERMINED");
    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({
      status: null,
      events: [],
      running: false,
    });
  });
});
