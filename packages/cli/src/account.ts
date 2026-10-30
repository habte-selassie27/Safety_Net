// Account management (CLI-020).
//
// SafetyNet does not invent its own key storage. It delegates to the official
// `genlayer` CLI so the same OS-keychain account used by `genlayer deploy` is
// used by `snet`. Secrets are never passed on the command line or logged.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { NETWORKS } from "@safetynet/core/ground-truth";

export class AccountError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export interface AccountSummary {
  name: string;
  address: string;
  active: boolean;
  unlocked: boolean;
}

export interface AccountDetails extends AccountSummary {
  balance?: string;
  network?: string;
  status?: string;
}

export interface AccountRunner {
  run(
    args: string[],
    options: { capture: boolean },
  ): {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
  };
}

export const defaultRunner: AccountRunner = {
  run(args, options) {
    const result = spawnSync("genlayer", args, {
      encoding: "utf8",
      stdio: options.capture
        ? ["ignore", "pipe", "pipe"]
        : ["inherit", "inherit", "inherit"],
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ...(result.error ? { error: result.error } : {}),
    };
  },
};

const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function validateAccountName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new AccountError(
      "E1001",
      "Account name must be 1–32 letters, digits, hyphens, or underscores.",
    );
  }
}

export function resolveNetwork(name?: string): {
  name: string;
  rpcUrl: string;
  chainId: string;
} {
  const selected = name ?? process.env.SNET_NETWORK ?? "studionet";
  const network = (NETWORKS as Record<string, unknown>)[selected];
  if (
    !network ||
    typeof network !== "object" ||
    !("rpcUrl" in network) ||
    typeof network.rpcUrl !== "string"
  ) {
    throw new AccountError(
      "E1001",
      `Unknown network "${selected}". Use local, studionet, asimov, or bradbury.`,
    );
  }
  return {
    name: selected,
    rpcUrl: network.rpcUrl,
    chainId:
      "chainId" in network && typeof network.chainId === "string"
        ? network.chainId
        : "",
  };
}

/** Parse `genlayer account list` output. */
export function parseAccountList(output: string): AccountSummary[] {
  const accounts: AccountSummary[] = [];
  for (const line of output.split("\n")) {
    const match = /^(\*)?\s*(\S+)\s+(0x[0-9a-fA-F]{40})\b(.*)$/.exec(
      line.trimEnd(),
    );
    if (!match) continue;
    const flags = match[4] ?? "";
    accounts.push({
      name: match[2] as string,
      address: (match[3] as string).toLowerCase(),
      active: Boolean(match[1]) || /\bactive\b/.test(flags),
      unlocked: /\bunlocked\b/.test(flags),
    });
  }
  return accounts;
}

/** Parse the object-ish output of `genlayer account show`. */
export function parseAccountShow(
  output: string,
  fallbackName = "",
): AccountDetails {
  const name = /name:\s*'([^']+)'/.exec(output)?.[1] ?? fallbackName;
  const address =
    /address:\s*'(0x[0-9a-fA-F]{40})'/.exec(output)?.[1]?.toLowerCase() ?? "";
  const balance = /balance:\s*'([^']+)'/.exec(output)?.[1];
  const network = /network:\s*'([^']+)'/.exec(output)?.[1];
  const status = /status:\s*'([^']+)'/.exec(output)?.[1];
  if (!address) {
    throw new AccountError(
      "E5001",
      "Could not read the account address from `genlayer account show`. Run `genlayer account list` to check the account name.",
    );
  }
  return {
    name,
    address,
    active: /\bactive:\s*true\b/.test(output),
    unlocked: status === "unlocked",
    ...(balance ? { balance } : {}),
    ...(network ? { network } : {}),
    ...(status ? { status } : {}),
  };
}

function ensureSuccess(
  result: ReturnType<AccountRunner["run"]>,
  context: string,
): void {
  if (result.error) {
    throw new AccountError(
      "E4002",
      `${context} failed: ${result.error.message}. Is the genlayer CLI installed?`,
    );
  }
  if (result.status !== 0) {
    throw new AccountError(
      "E5002",
      `${context} failed with exit code ${result.status ?? "unknown"}.${
        result.stderr.trim() ? `\n${result.stderr.trim()}` : ""
      }`,
    );
  }
}

function keystorePath(name: string): string {
  return `${homedir()}/.genlayer/keystores/${name}.json`;
}

export function accountNew(
  options: {
    name?: string;
    keystore?: string;
    setActive?: boolean;
  } = {},
  runner: AccountRunner = defaultRunner,
): AccountSummary {
  const name = options.name ?? "default";
  validateAccountName(name);
  if (options.keystore && existsSync(options.keystore)) {
    throw new AccountError(
      "E2001",
      `Keystore already exists at ${options.keystore}; refusing to overwrite.`,
    );
  }
  const args = ["account", "create", "--name", name];
  if (!options.setActive) args.push("--no-set-active");
  const result = runner.run(args, { capture: false });
  ensureSuccess(result, "Creating the account");
  if (options.keystore) {
    const source = keystorePath(name);
    if (!existsSync(source)) {
      throw new AccountError(
        "E7002",
        `Account created, but no keystore was found at ${source}.`,
      );
    }
    mkdirSync(dirname(options.keystore), { recursive: true });
    copyFileSync(source, options.keystore);
  }
  return accountAddress(name, runner);
}

export function accountImport(
  options: { name?: string; keystore?: string },
  runner: AccountRunner = defaultRunner,
): AccountSummary {
  const name = options.name ?? "default";
  validateAccountName(name);
  const args = ["account", "import", "--name", name, "--no-set-active"];
  if (options.keystore) args.push("--keystore", options.keystore);
  const result = runner.run(args, { capture: false });
  ensureSuccess(result, "Importing the account");
  return accountAddress(name, runner);
}

export function accountList(
  runner: AccountRunner = defaultRunner,
): AccountSummary[] {
  const result = runner.run(["account", "list"], { capture: true });
  ensureSuccess(result, "Listing accounts");
  return parseAccountList(result.stdout);
}

export function accountAddress(
  name?: string,
  runner: AccountRunner = defaultRunner,
): AccountSummary {
  const accounts = accountList(runner);
  const selected = name
    ? accounts.find((account) => account.name === name)
    : (accounts.find((account) => account.active) ?? accounts[0]);
  if (!selected) {
    throw new AccountError(
      "E7002",
      name
        ? `No account named "${name}". Run \`snet account list\`.`
        : "No genlayer account found. Run `snet account new` first.",
    );
  }
  return selected;
}

export function accountBalance(
  options: { name?: string; network?: string } = {},
  runner: AccountRunner = defaultRunner,
): AccountDetails {
  const network = resolveNetwork(options.network);
  const args = ["account", "show", "--rpc", network.rpcUrl];
  if (options.name) args.push("--account", options.name);
  const result = runner.run(args, { capture: true });
  ensureSuccess(result, "Reading the account balance");
  return parseAccountShow(result.stdout, options.name ?? "");
}
