import { useEffect, useState } from "react";

import { type PublicIndex, loadPublishedIndex } from "../lib/data";

export type IndexState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; index: PublicIndex; stale: boolean };

export function usePublishedIndex(): IndexState {
  const [state, setState] = useState<IndexState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPublishedIndex()
      .then((index) => {
        if (cancelled) return;
        setState({ status: "ready", index, stale: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load index.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
