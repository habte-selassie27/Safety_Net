import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/print.css";
import "./index.css";
import "./styles/print.css";
import App from "./App.tsx";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
