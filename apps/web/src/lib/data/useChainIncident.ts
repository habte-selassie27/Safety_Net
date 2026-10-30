import { useEffect, useState } from "react";

import type { IncidentView } from "../../data/types";
import { fetchChainIncident } from "./chain";

export type ChainIncidentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; incident: IncidentView | null };

export function useChainIncident(id: string | undefined): ChainIncidentState {
  const [state, setState] = useState<ChainIncidentState>({ status: "idle" });

  useEffect(() => {
    if (!id) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchChainIncident(id)
      .then((incident) => {
        if (cancelled) return;
        setState({ status: "ready", incident });
      })
      .catch((cause) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: cause instanceof Error ? cause.message : "Could not load incident.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}