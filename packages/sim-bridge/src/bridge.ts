import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type {
  JsonRpcResponse,
  SimBridgeConfig,
  SimBridgeOptions,
  SimTxResult,
} from "./types";

const DEFAULT_PROTOCOL_VERSION = 1;

export class SimBridge {
  private readonly python: string;
  private readonly cwd: string;
  private readonly config: SimBridgeConfig;
  private readonly protocolVersion: number;
  private readonly onStderr: ((line: string) => void) | undefined;

  private proc: ReturnType<typeof spawn> | null = null;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private ready: Promise<void> | null = null;
  private closed = false;

  constructor(options: SimBridgeOptions = {}) {
    this.python = options.python ?? process.env.SNET_PYTHON ?? "python3";
    this.cwd = options.cwd ?? process.cwd();
    this.config = options.config ?? {};
    this.protocolVersion = options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION;
    this.onStderr = options.onStderr;
  }

  async start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = this.doStart();
    return this.ready;
  }

  private async doStart(): Promise<void> {
    const env: NodeJS.ProcessEnv = { ...process.env };
    const simPath = join(this.cwd, "packages", "safetynet-sim");
    if (existsSync(simPath)) {
      env.PYTHONPATH = env.PYTHONPATH
        ? `${simPath}${process.platform === "win32" ? ";" : ":"}${env.PYTHONPATH}`
        : simPath;
    }

    const proc = spawn(this.python, ["-m", "safetynet_sim.rpc"], {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc = proc;

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim() && this.onStderr) this.onStderr(line);
      }
    });
    proc.on("exit", (code) => {
      if (!this.closed) {
        const error = new Error(`sim bridge exited with code ${code}`);
        for (const { reject } of this.pending.values()) reject(error);
        this.pending.clear();
      }
    });

    const init = (await this.call("sim.init", {
      config: this.config,
      protocolVersion: this.protocolVersion,
    })) as { ok: boolean; protocolVersion: number };
    if (init.protocolVersion !== this.protocolVersion) {
      throw new Error(
        `sim protocol version mismatch: expected ${this.protocolVersion}, got ${init.protocolVersion}`,
      );
    }
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let idx = this.buffer.indexOf("\n");
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line) {
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          if (typeof msg.id === "number") {
            const pending = this.pending.get(msg.id);
            if (pending) {
              this.pending.delete(msg.id);
              if (msg.error) {
                const err = new Error(msg.error.message);
                (err as Error & { code?: number; data?: unknown }).code =
                  msg.error.code;
                (err as Error & { data?: unknown }).data = msg.error.data;
                pending.reject(err);
              } else {
                pending.resolve(msg.result);
              }
            }
          }
        } catch {
          // Ignore malformed lines; the bridge stays alive.
        }
      }
      idx = this.buffer.indexOf("\n");
    }
  }

  async call<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    await this.start();
    if (!this.proc || !this.proc.stdin) {
      throw new Error("sim bridge is not running");
    }
    const id = this.nextId++;
    const request = { jsonrpc: "2.0", id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      this.proc!.stdin!.write(JSON.stringify(request) + "\n", (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  async deploy(sourcePath: string, args: unknown[] = [], sender?: string) {
    return this.call("sim.deploy", {
      sourcePath,
      args,
      ...(sender ? { sender } : {}),
    });
  }

  async read(address: string, method: string, args: unknown[] = [], sender?: string) {
    return this.call("sim.read", {
      address,
      method,
      args,
      ...(sender ? { sender } : {}),
    });
  }

  async write(
    address: string,
    method: string,
    args: unknown[] = [],
    sender?: string,
  ): Promise<SimTxResult> {
    return this.call<SimTxResult>("sim.write", {
      address,
      method,
      args,
      ...(sender ? { sender } : {}),
    });
  }

  async mock(kind: "llm" | "web", rule: unknown): Promise<unknown> {
    return this.call("sim.mock", { kind, rule });
  }

  async snapshot(): Promise<string> {
    const result = (await this.call("sim.snapshot", {})) as { id: string };
    return result.id;
  }

  async revert(id: string): Promise<void> {
    await this.call("sim.revert", { id });
  }

  async setValidators(n: number): Promise<void> {
    await this.call("sim.setValidators", { n });
  }

  async trace(txHash: string): Promise<unknown> {
    return this.call("sim.trace", { txHash });
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    try {
      await this.call("sim.shutdown", {});
    } catch {
      // Ignore errors during shutdown.
    }
    if (this.proc) {
      this.proc.stdin?.end();
      this.proc.kill();
      this.proc = null;
    }
    this.ready = null;
  }
}

export { SimBridge as default };
