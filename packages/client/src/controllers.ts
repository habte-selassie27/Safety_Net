// Framework-agnostic controllers behind the React hooks. Tested directly so
// hook behavior does not require a DOM harness.

import type { TrackedTx, TxStatus, TxStatusEvent } from "./types";

export interface ReadState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export class ReadController<T> {
  private state: ReadState<T> = { data: null, loading: true, error: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private loader: () => Promise<T>;

  constructor(loader: () => Promise<T>) {
    this.loader = loader;
  }

  readonly getSnapshot = (): ReadState<T> => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async fetch(): Promise<void> {
    const generation = ++this.generation;
    this.set({ ...this.state, loading: true, error: null });
    try {
      const data = await this.loader();
      if (generation !== this.generation) return;
      this.set({ data, loading: false, error: null });
    } catch (error) {
      if (generation !== this.generation) return;
      this.set({ data: null, loading: false, error: error as Error });
    }
  }

  /** Replace the loader (e.g. when args change) and refetch. */
  async reload(loader: () => Promise<T>): Promise<void> {
    this.loader = loader;
    await this.fetch();
  }

  private set(state: ReadState<T>): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

export interface WriteState<T> {
  status: TxStatus | null;
  events: TxStatusEvent[];
  hash: string | null;
  data: T | null;
  error: Error | null;
  running: boolean;
}

const INITIAL_WRITE: WriteState<unknown> = {
  status: null,
  events: [],
  hash: null,
  data: null,
  error: null,
  running: false,
};

export class WriteController<T> {
  private state: WriteState<T> = { ...(INITIAL_WRITE as WriteState<T>) };
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;

  readonly getSnapshot = (): WriteState<T> => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async run(submit: () => TrackedTx<T>): Promise<T | null> {
    this.unsubscribe?.();
    this.set({ ...(INITIAL_WRITE as WriteState<T>), running: true });
    const tx = submit();
    this.unsubscribe = tx.on("status", (event) => {
      this.set({
        ...this.state,
        status: event.status,
        events: [...this.state.events, event],
      });
    });
    try {
      const hash = await tx.hash;
      this.set({ ...this.state, hash });
      const data = await tx.result;
      this.set({ ...this.state, data, running: false, status: "ACCEPTED" });
      return data;
    } catch (error) {
      this.set({ ...this.state, error: error as Error, running: false });
      return null;
    }
  }

  reset(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.set({ ...(INITIAL_WRITE as WriteState<T>) });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  private set(state: WriteState<T>): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
