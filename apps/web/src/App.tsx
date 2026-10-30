import { useEffect, useRef, useState } from "react";

import { NetworkBadge } from "./components/NetworkBadge";
import { NetworkMismatchBanner } from "./components/NetworkMismatchBanner";
import { SyntheticBadge } from "./components/SyntheticBadge";
import { ThemeToggle } from "./components/ThemeToggle";
import { WalletButton } from "./components/WalletButton";
import ui from "./components/ui.module.css";
import { shortAddress } from "./lib/format";
import { CHAIN_ID, NETWORK, SAFETYNET_ADDRESS } from "./lib/network";
import { Link, type RouteName, useRoute } from "./lib/router";
import { WalletProvider, useWallet } from "./lib/wallet.tsx";
import { switchChain } from "./lib/wallet.tsx";
import { About } from "./views/About";
import { Data } from "./views/Data";
import { EmbedSystem } from "./views/EmbedSystem";
import { Home } from "./views/Home";
import { IncidentDetail } from "./views/IncidentDetail";
import { Incidents } from "./views/Incidents";
import { NotFound } from "./views/NotFound";
import { PolicyGaps } from "./views/PolicyGaps";
import { Provider } from "./views/Provider";
import { Report } from "./views/Report";
import { SystemDetail } from "./views/SystemDetail";
import { Systems } from "./views/Systems";

const NAV = [
  { to: "/incidents", label: "Incidents", match: ["incidents", "incident"] },
  { to: "/systems", label: "Systems", match: ["systems", "system"] },
  { to: "/policy-gaps", label: "Policy gaps", match: ["gaps"] },
  { to: "/data", label: "Data", match: ["data"] },
  { to: "/about", label: "About", match: ["about"] },
] as const;

const TITLES: Record<RouteName, string> = {
  home: "The public record of AI harm",
  incidents: "Incident record",
  incident: "Incident",
  systems: "AI systems",
  system: "AI system",
  gaps: "Policy gaps",
  report: "Report an incident",
  provider: "Provider console",
  about: "About",
  data: "Open data",
  "embed-system": "SafetyNet record",
  "not-found": "Page not found",
};

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return desktop;
}

function CurrentView() {
  const route = useRoute();
  switch (route.name) {
    case "home":
      return <Home />;
    case "incidents":
      return <Incidents />;
    case "incident":
      return <IncidentDetail />;
    case "systems":
      return <Systems />;
    case "system":
      return <SystemDetail />;
    case "gaps":
      return <PolicyGaps />;
    case "report":
      return <Report />;
    case "provider":
      return <Provider />;
    case "about":
      return <About />;
    case "data":
      return <Data />;
    case "embed-system":
      return <EmbedSystem systemId={route.id ?? ""} />;
    default:
      return <NotFound />;
  }
}

function HeaderWalletButton() {
  const wallet = useWallet();
  return (
    <WalletButton
      state={
        wallet.available
          ? wallet.connecting
            ? "connecting"
            : wallet.address
              ? wallet.chainId === null
                ? "connected"
                : "connected"
              : "disconnected"
          : "none"
      }
      address={wallet.address ?? undefined}
      onConnect={wallet.connect}
      onDisconnect={wallet.disconnect}
    />
  );
}

function WalletMismatchBridge() {
  const wallet = useWallet();
  if (
    wallet.available &&
    wallet.address &&
    wallet.chainId !== null &&
    wallet.chainId !== CHAIN_ID
  ) {
    return (
      <NetworkMismatchBanner
        networkName={NETWORK}
        walletChainName={wallet.chainId}
        onSwitch={() => {
          switchChain(`0x${Number.parseInt(CHAIN_ID, 10).toString(16)}`).then(
            () => wallet.connect(),
          );
        }}
      />
    );
  }
  return null;
}

export default function App() {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = `${TITLES[route.name]} · SafetyNet`;
  }, [route.name]);

  useEffect(() => {
    if (route.name || route.id) {
      window.scrollTo({ top: 0 });
      document.getElementById("main")?.focus({ preventScroll: true });
      setMenuOpen(false);
    }
  }, [route.name, route.id]);

  useEffect(() => {
    if (!menuOpen) return;
    mobileNavRef.current?.querySelector("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      document.getElementById("mobile-menu-button")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (route.name === "embed-system") {
    return <EmbedSystem systemId={route.id ?? ""} />;
  }

  return (
    <WalletProvider>
      <div className={ui.shell} data-testid="app">
        <a className={ui.skipLink} href="#main" data-testid="skip-link">
          Skip to content
        </a>

        <header className={ui.header}>
          <Link className={ui.brand} to="/">
            <span className={ui.brandMark}>SafetyNet</span>
            <span className={ui.brandSub}>Public AI incident record</span>
          </Link>
          {isDesktop ? (
            <nav
              className={ui.nav}
              aria-label="Primary"
              data-testid="primary-nav"
            >
              {NAV.map((item) => {
                const active = (item.match as readonly string[]).includes(
                  route.name,
                );
                return (
                  <Link
                    key={item.to}
                    className={`${ui.navLink} ${active ? ui.navLinkActive : ""}`}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <div className={ui.headerMeta}>
            <SyntheticBadge label="Demo" />
            <NetworkBadge />
            <HeaderWalletButton />
            <ThemeToggle />
            {isDesktop ? (
              <Link className={ui.button} to="/report">
                Report an incident
              </Link>
            ) : (
              <button
                type="button"
                id="mobile-menu-button"
                className={ui.iconButton}
                data-testid="mobile-menu-button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span aria-hidden="true">☰</span>
              </button>
            )}
          </div>
        </header>

        {!isDesktop && menuOpen ? (
          <nav
            id="mobile-nav"
            ref={mobileNavRef}
            className={ui.mobileNav}
            aria-label="Primary"
            data-testid="primary-nav"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                className={ui.mobileNavLink}
                to={item.to}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              className={ui.mobileNavLink}
              to="/provider"
              onClick={() => setMenuOpen(false)}
            >
              Provider console
            </Link>
            <Link
              className={ui.button}
              to="/report"
              onClick={() => setMenuOpen(false)}
            >
              Report an incident
            </Link>
          </nav>
        ) : null}

        <div
          id="route-announcer"
          data-testid="route-announcer"
          className={ui.srOnly}
          aria-live="polite"
          aria-atomic="true"
        >
          {TITLES[route.name]}
        </div>

        <main className={ui.main} id="main" tabIndex={-1}>
          <WalletMismatchBridge />
          <CurrentView />
        </main>

        <footer className={ui.footer} data-testid="footer">
          <span>SafetyNet · The public record of AI harm</span>
          <span>
            <Link to="/incidents">Incidents</Link> ·{" "}
            <Link to="/systems">Systems</Link> ·{" "}
            <Link to="/policy-gaps">Policy gaps</Link> ·{" "}
            <Link to="/data">Data</Link> ·{" "}
            <Link to="/about">About</Link> ·{" "}
            <Link to="/provider">Provider console</Link> ·{" "}
            <a href="https://github.com/habte-selassie27/safetynet" target="_blank" rel="noreferrer">GitHub</a> ·{" "}
            <a href="/docs" target="_blank" rel="noreferrer">Docs</a>
          </span>
          <span>
            Network {NETWORK} · chain {CHAIN_ID} · contract{" "}
            <span className={ui.mono} title={SAFETYNET_ADDRESS}>
              {shortAddress(SAFETYNET_ADDRESS)}
            </span>
            {" · "}Index updated: demo snapshot
          </span>
          <span data-testid="legal-disclaimer">
            Policy compliance findings, not legal determinations.{" "}
            <Link to="/about#trust-boundary">Read the trust boundary</Link>.
          </span>
          <span>
            <Link to="/about">Trust boundary</Link> ·{" "}
            <Link to="/data">Open data</Link>
          </span>
          <span>SYNTHETIC demo build — no chain writes.</span>
          <span>Build v0.1.0 · {SAFETYNET_ADDRESS.slice(0, 8)} · {new Date().toISOString().slice(0, 10)}</span>
        </footer>
      </div>
    </WalletProvider>
  );
}
