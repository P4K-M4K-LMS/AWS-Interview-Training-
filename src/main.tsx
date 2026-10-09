import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { routes } from "./App";
import { RouteError } from "./app/RouteError";

// Pages load on demand as separate files. After a deploy, a browser (or a CDN)
// that still holds the previous index.html asks for chunk files that no longer
// exist. Reload once to pick up the new index instead of showing a blank page.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "opsforge:reloaded-after-preload-error";
  try {
    if (sessionStorage.getItem(key) === location.href) return; // already tried once for this address
    sessionStorage.setItem(key, location.href);
  } catch {
    // storage unavailable: still try one reload
  }
  location.reload();
});

// Hash routing keeps every deep link working on static hosts (GitHub Pages)
// without server rewrites.
const router = createHashRouter(routes.map((r) => ({ ...r, errorElement: <RouteError /> })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
