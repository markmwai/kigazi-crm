import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { config } from "./components/atomic-crm/root/config";

// After a new deploy, the service worker may replace its pre-cache while
// the page still holds old chunk references. A reload picks up the new
// HTML + new SW cache. A sessionStorage guard prevents infinite loops.
// See https://vite.dev/guide/build.html#load-error-handling
window.addEventListener("vite:preloadError", () => {
  const key = "chunk-reload";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

const root = document.getElementById("root")!;

// config.js is rendered from the VITE_* variables at build time. A deployment
// that forgot them would otherwise render a blank page and only log the error,
// so say what is missing instead.
const requiredConfig: [string, string | undefined][] = [
  ["VITE_SUPABASE_URL", config.supabaseUrl],
  ["VITE_SB_PUBLISHABLE_KEY", config.supabasePublishableKey],
  ["VITE_CLERK_PUBLISHABLE_KEY", config.clerkPublishableKey],
];
const missingConfig = requiredConfig
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingConfig.length > 0) {
  const container = document.createElement("div");
  container.style.cssText =
    "max-width: 40rem; margin: 15vh auto; padding: 0 1.5rem; font: 16px/1.5 system-ui, sans-serif; color: #1c1917;";
  const title = document.createElement("h1");
  title.style.cssText = "font-size: 1.25rem; margin: 0 0 0.75rem;";
  title.textContent = "Kigazi CRM is not configured";
  const body = document.createElement("p");
  body.style.margin = "0";
  body.textContent =
    `This build is missing ${missingConfig.join(", ")}. ` +
    "Set these environment variables on the Cloudflare Pages project and redeploy: " +
    "they are rendered into config.js at build time.";
  container.append(title, body);
  root.replaceChildren(container);
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
