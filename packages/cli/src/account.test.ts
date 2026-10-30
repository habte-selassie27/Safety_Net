import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AccountError,
  type AccountRunner,
  accountAddress,
  accountBalance,
  accountImport,
  accountNew,
  parseAccountList,
  parseAccountShow,
  resolveNetwork,
} from "./account";

const LIST = `bradbury         0x04e0353b7218b66d6803725ce7342e6e1225db1b  (unlocked)
main             0x37cdbd86743e2b80486413e89ca4c70a58147889
* rabby            0x5b3661c576c7001e6d6279c67f3779705d334c89 (active) (unlocked)
`;

const SHOW = `- Fetching account info...

Result:
{
  name: 'rabby',
  address: '0x5b3661c576c7001e6d6279c67f3779705d334c89',
  balance: '701.116656666666668646 GEN',
  network: 'Genlayer Studio Network',
  status: 'unlocked',
  active: true,
}
`;

function fakeRunner(
  responses: Array<{
    match: string;
    stdout?: string;
    status?: number;
    stderr?: string;
  }>,
): { runner: AccountRunner; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    runner: {
      run(args, _options) {
        calls.push(args);
        const response = responses.find((candidate) =>
          args.join(" ").includes(candidate.match),
        );
        return {
          status: response?.status ?? 0,
          stdout: response?.stdout ?? "",
          stderr: response?.stderr ?? "",
        };
      },
    },
  };
}

describe("account parsing", () => {
  it("parses the account list including the active marker", () => {
    const accounts = parseAccountList(LIST);
    expect(accounts).toHaveLength(3);
    expect(accounts[0]).toEqual({
      name: "bradbury",
      address: "0x04e0353b7218b66d6803725ce7342e6e1225db1b",
      active: false,
      unlocked: true,
    });
    expect(accounts[2]).toMatchObject({
      name: "rabby",
      active: true,
      unlocked: true,
    });
  });

  it("parses account show output", () => {
    const details = parseAccountShow(SHOW, "rabby");
    expect(details).toMatchObject({
      name: "rabby",
      address: "0x5b3661c576c7001e6d6279c67f3779705d334c89",
      balance: "701.116656666666668646 GEN",
      status: "unlocked",
      active: true,
    });
  });

  it("rejects output without an address", () => {
    expect(() => parseAccountShow("nothing here")).toThrow(AccountError);
  });
});

describe("account commands", () => {
  it("resolves networks from ground truth", () => {
    expect(resolveNetwork("studionet").rpcUrl).toBe(
      "https://studio.genlayer.com/api",
    );
    expect(() => resolveNetwork("nope")).toThrow(/Unknown network/);
  });

  it("defaults to the active account", () => {
    const { runner } = fakeRunner([{ match: "account list", stdout: LIST }]);
    expect(accountAddress(undefined, runner)).toMatchObject({
      name: "rabby",
      active: true,
    });
  });

  it("addresses a named account and errors for an unknown name", () => {
    const { runner } = fakeRunner([{ match: "account list", stdout: LIST }]);
    expect(accountAddress("main", runner).address).toBe(
      "0x37cdbd86743e2b80486413e89ca4c70a58147889",
    );
    expect(() => accountAddress("missing", runner)).toThrow(/No account named/);
  });

  it("delegates account creation without setting the active account", () => {
    const { runner, calls } = fakeRunner([
      { match: "account create", status: 0 },
      {
        match: "account list",
        stdout: `${LIST}new-key          0x1111111111111111111111111111111111111111\n`,
      },
    ]);
    const summary = accountNew({ name: "new-key" }, runner);
    expect(summary.name).toBe("new-key");
    expect(calls[0]).toEqual([
      "account",
      "create",
      "--name",
      "new-key",
      "--no-set-active",
    ]);
  });

  it("refuses to overwrite an existing keystore", () => {
    const dir = mkdtempSync(join(tmpdir(), "snet-account-"));
    const path = join(dir, "key.json");
    writeFileSync(path, "{}");
    const { runner } = fakeRunner([]);
    expect(() =>
      accountNew({ name: "new-key", keystore: path }, runner),
    ).toThrow(/refusing to overwrite/);
  });

  it("delegates import with an optional source keystore", () => {
    const { runner, calls } = fakeRunner([
      { match: "account import", status: 0 },
      {
        match: "account list",
        stdout: `${LIST}imported         0x2222222222222222222222222222222222222222\n`,
      },
    ]);
    accountImport({ name: "imported", keystore: "/tmp/source.json" }, runner);
    expect(calls[0]).toEqual([
      "account",
      "import",
      "--name",
      "imported",
      "--no-set-active",
      "--keystore",
      "/tmp/source.json",
    ]);
  });

  it("reads balance from account show with the network RPC", () => {
    const { runner, calls } = fakeRunner([
      { match: "account show", stdout: SHOW },
    ]);
    const details = accountBalance(
      { name: "rabby", network: "studionet" },
      runner,
    );
    expect(details.balance).toContain("GEN");
    expect(calls[0]).toContain("https://studio.genlayer.com/api");
  });
});
