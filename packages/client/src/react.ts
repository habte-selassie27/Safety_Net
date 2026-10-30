// Optional React bindings: `@safetynet/client/react`.
// Thin wrappers over ReadController/WriteController so the state machine is
// testable without a DOM.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ReadController,
  type ReadState,
  WriteController,
  type WriteState,
} from "./controllers";
import type { TrackedTx } from "./types";

export interface UseReadResult<T> extends ReadState<T> {
  refetch: () => void;
}

export function useRead<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): UseReadResult<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const controller = useMemo(
    () => new ReadController<T>(() => loaderRef.current()),
    [],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [tick, setTick] = useState(0);
  const depsKey = deps.map((value) => String(value)).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: depsKey/tick intentionally retrigger the fetch
  useEffect(() => {
    void controller.fetch();
  }, [controller, depsKey, tick]);

  const refetch = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, refetch };
}

export interface UseWriteResult<T> extends WriteState<T> {
  write: () => Promise<T | null>;
  reset: () => void;
}

export function useWrite<T>(submit: () => TrackedTx<T>): UseWriteResult<T> {
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const controller = useMemo(() => new WriteController<T>(), []);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => () => controller.dispose(), [controller]);

  const write = useCallback(
    () => controller.run(() => submitRef.current()),
    [controller],
  );
  const reset = useCallback(() => controller.reset(), [controller]);
  return { ...state, write, reset };
}

export { ReadController, WriteController } from "./controllers";
