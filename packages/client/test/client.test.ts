import { describe, expect, it } from "vitest";

import { createClient } from "../src/client";
import { FakeAdapter } from "../src/fake-adapter";
import { ClientError } from "../src/types";

const ADDRESS = `0x${"ab".repeat(20)}`;

interface DemoAPI {
  read: {
    get_incident(
      args: [incident_id: string],
    ): Promise<{ incident_id: string } | null>;
    get_incident_count(): Promise<bigint>;
  };
  write: {
    adjudicate(
      args: [incident_id: string],
      opts?: { wait?: "ACCEPTED" | "FINALIZED" },
    ): import("../src/types").TrackedTx<string>;
  };
}

describe("createClient", () => {
  it("requires an adapter", () => {
    expect(() => createClient({} as never)).toThrow(ClientError);
  });

  it("rejects an invalid contract address", () => {
    const client = createClient({ adapter: new FakeAdapter() });
    expect(() => client.contract<DemoAPI>("0x1234")).toThrow(
      /invalid contract address/,
    );
  });

  it("routes typed reads with args and sender", async () => {
    const adapter = new FakeAdapter();
    const seen: unknown[] = [];
    adapter.onRead("get_incident", (args) => {
      seen.push(args);
      return { incident_id: args.args[0] };
    });
    const client = createClient({ adapter, account: `0x${"22".repeat(20)}` });
    const contract = client.contract<DemoAPI>(ADDRESS);
    const incident = await contract.read.get_incident(["inc-000001"]);
    expect(incident).toEqual({ incident_id: "inc-000001" });
    expect(seen[0]).toMatchObject({
      address: ADDRESS,
      method: "get_incident",
      args: ["inc-000001"],
      sender: `0x${"22".repeat(20)}`,
    });
  });

  it("routes writes and returns a tracked transaction", async () => {
    const adapter = new FakeAdapter();
    adapter.queueWrite(["PENDING", "ACCEPTED"], "POLICY_VIOLATION");
    const client = createClient({
      adapter,
      poll: { initialMs: 1, sleep: async () => {} },
    });
    const contract = client.contract<DemoAPI>(ADDRESS);
    const tx = contract.write.adjudicate(["inc-000001"]);
    await expect(tx.result).resolves.toBe("POLICY_VIOLATION");
    expect(adapter.submitted[0]).toMatchObject({
      address: ADDRESS,
      method: "adjudicate",
      args: ["inc-000001"],
    });
  });

  it("caches reads for the configured window", async () => {
    let calls = 0;
    let clock = 0;
    const adapter = new FakeAdapter();
    adapter.onRead("get_incident_count", () => {
      calls += 1;
      return BigInt(calls);
    });
    const client = createClient({
      adapter,
      readCacheMs: 30_000,
      now: () => clock,
    });
    const contract = client.contract<DemoAPI>(ADDRESS);
    expect(await contract.read.get_incident_count()).toBe(1n);
    expect(await contract.read.get_incident_count()).toBe(1n);
    expect(calls).toBe(1);
    clock += 30_001;
    expect(await contract.read.get_incident_count()).toBe(2n);
    expect(calls).toBe(2);
  });

  it("invalidates the read cache on demand", async () => {
    let calls = 0;
    const adapter = new FakeAdapter();
    adapter.onRead("get_incident_count", () => {
      calls += 1;
      return BigInt(calls);
    });
    const client = createClient({ adapter, readCacheMs: 30_000 });
    const contract = client.contract<DemoAPI>(ADDRESS);
    await contract.read.get_incident_count();
    client.invalidateReads();
    await contract.read.get_incident_count();
    expect(calls).toBe(2);
  });

  it("never caches a rejected read", async () => {
    let calls = 0;
    const adapter = new FakeAdapter();
    adapter.onRead("get_incident_count", () => {
      calls += 1;
      throw new Error("rpc down");
    });
    const client = createClient({ adapter, readCacheMs: 30_000 });
    const contract = client.contract<DemoAPI>(ADDRESS);
    await expect(contract.read.get_incident_count()).rejects.toThrow(
      "rpc down",
    );
    await expect(contract.read.get_incident_count()).rejects.toThrow(
      "rpc down",
    );
    expect(calls).toBe(2);
  });

  it("applies generated per-method decoders", async () => {
    const adapter = new FakeAdapter();
    adapter.onRead("get_incident", () => '{"incident_id":"inc-000001"}');
    const client = createClient({ adapter });
    const contract = client.contract<DemoAPI>(ADDRESS, {
      decode: {
        get_incident: (raw) => (raw ? JSON.parse(String(raw)) : null),
        get_incident_count: (raw) => Number(raw ?? 0),
      },
    });
    await expect(contract.read.get_incident(["inc-000001"])).resolves.toEqual({
      incident_id: "inc-000001",
    });
  });

  it("exposes the chain id from the adapter", async () => {
    const adapter = new FakeAdapter().setChainId("61999");
    const client = createClient({ adapter });
    await expect(client.getChainId()).resolves.toBe("61999");
  });
});
