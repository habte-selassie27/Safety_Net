// Tiny History API router: no dependency, real path permalinks, and SPA
// navigation without a full reload. The static host must rewrite unknown
// paths to /index.html (see vercel.json).
//   /incidents/inc-000001?verdict=POLICY_VIOLATION
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useSyncExternalStore,
} from "react";

export type RouteName =
  | "home"
  | "incidents"
  | "incident"
  | "systems"
  | "system"
  | "gaps"
  | "report"
  | "provider"
  | "about"
  | "data"
  | "embed-system"
  | "not-found";

export interface Route {
  name: RouteName;
  id?: string;
  params: URLSearchParams;
  path: string;
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
}

/** Parse `/incidents/inc-000001?verdict=...`. */
export function parseRoute(path: string): Route {
  const [rawPath = "/", rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  const parts = rawPath.split("/").filter(Boolean);
  const full = `/${parts.join("/")}`;

  if (parts.length === 0) return { name: "home", params, path: full };
  const [head, second, third] = parts;

  if (head === "incidents" && second) {
    return { name: "incident", id: second, params, path: full };
  }
  if (head === "incidents") return { name: "incidents", params, path: full };
  if (head === "systems" && second)
    return { name: "system", id: second, params, path: full };
  if (head === "systems") return { name: "systems", params, path: full };
  if (head === "policy-gaps") return { name: "gaps", params, path: full };
  if (head === "report") return { name: "report", params, path: full };
  if (head === "provider") return { name: "provider", params, path: full };
  if (head === "about") return { name: "about", params, path: full };
  if (head === "data") return { name: "data", params, path: full };
  if (head === "embed" && second === "system" && third) {
    return { name: "embed-system", id: third, params, path: full };
  }
  return { name: "not-found", params, path: full };
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}` || "/";
}

export function useRoute(): Route {
  const path = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    currentPath,
    () => "/",
  );
  return parseRoute(path);
}

export function navigate(
  path: string,
  options: { replace?: boolean } = {},
): void {
  const target = path.startsWith("/") ? path : `/${path}`;
  if (options.replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  notify();
}

export function href(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Return a new path with updated query params (empty values remove the key). */
export function withParams(
  path: string,
  updates: Record<string, string | undefined>,
): string {
  const [base = "/", rawQuery = ""] = path.split("?");
  const params = new URLSearchParams(rawQuery);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (rest.target && rest.target !== "_self") return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={href(to)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
