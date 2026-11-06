import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import App from "@/App";
import "@/i18n";
import "@/styles.css";

// zod compiles validators with `new Function` unless told not to; the CSP forbids eval.
z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
