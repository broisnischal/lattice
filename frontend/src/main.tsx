import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted variable fonts (offline / CSP-safe — no remote CDN). Inter for
// UI chrome, Newsreader for the reading surface.
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
