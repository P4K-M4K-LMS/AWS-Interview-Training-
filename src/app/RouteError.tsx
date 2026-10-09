import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

/**
 * Shown instead of a blank page when a route fails to render or its code
 * fails to load (typically a stale index.html right after a deploy).
 * Progress is in IndexedDB and is not affected.
 */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  const stale = /dynamically imported module|Failed to fetch|Loading chunk|import\(\)/i.test(message);
  return (
    <div className="max-w-xl mx-auto mt-16 panel p-5 space-y-3" role="alert" data-testid="route-error">
      <h1 className="text-xl font-bold">{stale ? "OpsForge was updated while this page was open" : "This page could not be loaded"}</h1>
      <p className="text-sm muted">
        {stale ? "The site deployed a new version and this tab still holds the old one. Reloading fetches the current files. Your progress is stored in this browser and is not affected." : "Something went wrong while rendering this page. Reloading usually fixes it; your progress is stored in this browser and is not affected."}
      </p>
      <pre className="text-xs whitespace-pre-wrap rounded p-2 bg-red-950/40 text-red-200">{message}</pre>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
        <Link to="/" className="btn-secondary" onClick={() => setTimeout(() => location.reload(), 50)}>
          Go to Today
        </Link>
      </div>
    </div>
  );
}
