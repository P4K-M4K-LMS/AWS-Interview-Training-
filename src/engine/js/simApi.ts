/**
 * The JavaScript lab's simulated HTTP API, so fetch exercises run offline
 * and deterministically. It answers at https://api.fleet.example (a
 * reserved, fictional domain) with the courier company's data, after a
 * short delay on the lab's tracked timers so the call is genuinely
 * asynchronous. Every call is logged with start and end times for tests
 * that check order or concurrency. Any other address is refused with the
 * same TypeError a browser gives for an unreachable host.
 */
export const API_BASE = "https://api.fleet.example";
export const API_LATENCY_MS = 25;

export interface SimResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface FetchLogEntry {
  method: string;
  url: string;
  path: string;
  status: number | null;
  startedAt: number;
  endedAt: number | null;
}

const SHIPMENTS = [
  { id: "S-100", destination: "Leeds", weightKg: 12, status: "delivered", driverId: "D-1" },
  { id: "S-101", destination: "Bristol", weightKg: 4.5, status: "in-transit", driverId: "D-2" },
  { id: "S-102", destination: "York", weightKg: 30, status: "pending", driverId: null },
  { id: "S-103", destination: "Hull", weightKg: 8, status: "in-transit", driverId: "D-1" },
  { id: "S-104", destination: "Bath", weightKg: 2, status: "cancelled", driverId: "D-3" },
];
const DRIVERS = [
  { id: "D-1", name: "Ada Okafor", depot: "north" },
  { id: "D-2", name: "Sam Reyes", depot: "south" },
  { id: "D-3", name: "Lin Park", depot: "east" },
];

const STATUS_TEXT: Record<number, string> = { 200: "OK", 201: "Created", 400: "Bad Request", 404: "Not Found", 405: "Method Not Allowed", 503: "Service Unavailable" };

function route(method: string, path: string, body: string | undefined, calls: number): { status: number; body: unknown } {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  let m: RegExpExecArray | null;
  if (pathname === "/shipments" && method === "GET") {
    const status = params.get("status");
    return { status: 200, body: SHIPMENTS.filter((s) => !status || s.status === status) };
  }
  if (pathname === "/shipments" && method === "POST") {
    let parsed: { destination?: unknown; weightKg?: unknown };
    try {
      parsed = JSON.parse(body ?? "");
    } catch {
      return { status: 400, body: { error: "body must be JSON" } };
    }
    if (typeof parsed.destination !== "string" || !parsed.destination) return { status: 400, body: { error: "destination is required" } };
    if (typeof parsed.weightKg !== "number" || !(parsed.weightKg > 0)) return { status: 400, body: { error: "weightKg must be a positive number" } };
    return { status: 201, body: { id: `S-${200 + calls}`, destination: parsed.destination, weightKg: parsed.weightKg, status: "pending", driverId: null } };
  }
  if ((m = /^\/shipments\/([\w-]+)$/.exec(pathname)) && method === "GET") {
    const s = SHIPMENTS.find((x) => x.id === m![1]);
    return s ? { status: 200, body: s } : { status: 404, body: { error: `no shipment ${m[1]}` } };
  }
  if ((m = /^\/drivers\/([\w-]+)$/.exec(pathname)) && method === "GET") {
    const d = DRIVERS.find((x) => x.id === m![1]);
    return d ? { status: 200, body: d } : { status: 404, body: { error: `no driver ${m[1]}` } };
  }
  if (pathname === "/status/flaky" && method === "GET") return calls % 2 === 1 ? { status: 503, body: { error: "try again" } } : { status: 200, body: { ok: true } };
  return { status: pathname.match(/^\/(shipments|drivers)/) ? 405 : 404, body: { error: `no route ${method} ${pathname}` } };
}

/** A fetch bound to one run: uses the run's timers for latency and records every call. */
export function createSimFetch(setTimer: (fn: () => void, ms: number) => unknown, now: () => number) {
  const log: FetchLogEntry[] = [];
  const counts = new Map<string, number>();
  async function simFetch(input: unknown, init: { method?: string; body?: unknown; headers?: unknown } = {}): Promise<SimResponse> {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : String((input as { url?: string })?.url ?? input);
    const url = raw.startsWith("/") ? `${API_BASE}${raw}` : raw;
    const method = (init.method ?? "GET").toUpperCase();
    if (!url.startsWith(`${API_BASE}/`)) {
      throw new TypeError(`Failed to fetch ${raw}: only ${API_BASE} is reachable from this lab (a simulated API).`);
    }
    const path = url.slice(API_BASE.length);
    const entry: FetchLogEntry = { method, url, path, status: null, startedAt: Math.round(now()), endedAt: null };
    log.push(entry);
    const key = `${method} ${path.split("?")[0]}`;
    const calls = (counts.get(key) ?? 0) + 1;
    counts.set(key, calls);
    await new Promise<void>((resolve) => setTimer(resolve, API_LATENCY_MS));
    const { status, body } = route(method, path, typeof init.body === "string" ? init.body : init.body === undefined ? undefined : String(init.body), calls);
    entry.status = status;
    entry.endedAt = Math.round(now());
    const text = JSON.stringify(body);
    let used = false;
    const consume = () => {
      if (used) throw new TypeError("Body has already been consumed.");
      used = true;
    };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: STATUS_TEXT[status] ?? "",
      url,
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
      json: async () => {
        consume();
        return JSON.parse(text);
      },
      text: async () => {
        consume();
        return text;
      },
    };
  }
  return { fetch: simFetch, log };
}
