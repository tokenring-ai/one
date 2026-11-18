// The access-link boot must stay the first import: it removes the sign-in token from the address bar before anything else runs.
import "./accessLinkBoot.ts";
import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { accessLinkRedeem } from "./accessLinkBoot.ts";
import AccessLinkGate from "./components/AccessLinkGate.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Follows prefers-reduced-motion; <html data-motion="reduce"> forces it (see index.css). */}
    <MotionConfig reducedMotion={document.documentElement.dataset.motion === "reduce" ? "always" : "user"}>
      <BrowserRouter>
        <AccessLinkGate redeem={accessLinkRedeem}>
          <App />
        </AccessLinkGate>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);
