/**
 * Virtual network path tracer for the fictional platform. Vendor-neutral
 * names (virtual network, stateful filter, stateless filter, address
 * translator, private endpoint, hub router) for the mechanics every cloud
 * network shares: longest-prefix routing, stateful filters that allow the
 * reply automatically, numbered stateless filters that need an explicit
 * reply rule, translation for private hosts reaching the internet, private
 * endpoints for platform services, and a hub that routes between networks.
 * A trace walks the hops in order and names the one that dropped the packet,
 * with a flow-log style line per hop.
 */
export type Proto = "tcp" | "udp" | "icmp" | "any";

export interface StatefulRule {
  direction: "in" | "out";
  proto: Proto;
  ports: [number, number] | "any";
  /** CIDR, or a stateful filter id (any host carrying that filter). */
  source: string;
  line: number;
}

export interface StatefulFilter {
  id: string;
  rules: StatefulRule[];
}

export interface StatelessRule {
  n: number;
  action: "allow" | "deny";
  direction: "in" | "out";
  proto: Proto;
  ports: [number, number] | "any";
  cidr: string;
  line: number;
}

export interface StatelessFilter {
  id: string;
  rules: StatelessRule[];
}

export type RouteTarget = "local" | "internet-gateway" | "blackhole" | `nat:${string}` | `hub:${string}` | `endpoint:${string}` | `peer:${string}`;

export interface Route {
  dest: string; // CIDR
  target: RouteTarget;
  line: number;
}

export interface RouteTable {
  id: string;
  routes: Route[];
}

export interface Subnet {
  id: string;
  cidr: string;
  routeTable: string;
  statelessFilter?: string;
}

export interface Host {
  id: string;
  subnet: string;
  ip: string;
  publicIp?: string;
  filters: string[]; // stateful filter ids
}

export interface Network {
  id: string;
  cidr: string;
  internetGateway: boolean;
  subnets: Subnet[];
  routeTables: RouteTable[];
  statefulFilters: StatefulFilter[];
  statelessFilters: StatelessFilter[];
  hosts: Host[];
  /** Address translators: a NAT in a subnet that must itself route to the internet gateway. */
  nats: Array<{ id: string; subnet: string }>;
  /** Private endpoints for platform services, reachable through an endpoint route. */
  endpoints: Array<{ id: string; service: string }>;
}

export interface Hub {
  id: string;
  /** Hub routes: destination CIDR -> network id. */
  routes: Array<{ dest: string; network: string; line: number }>;
  attached: string[]; // network ids
}

export interface Topology {
  networks: Network[];
  hubs: Hub[];
}

export interface Flow {
  /** host id, "internet:<ip>" or "service:<name>" */
  from: string;
  to: string;
  proto: Proto;
  port: number;
}

export interface Hop {
  n: number;
  where: string;
  verdict: "pass" | "drop";
  detail: string;
}

export interface TraceResult {
  reachable: boolean;
  hops: Hop[];
  droppedAt?: Hop;
  /** Flow-log style lines, one per filter hop: who, what, ACCEPT or REJECT. */
  flowLog: string[];
  /** Reached, but over the public internet rather than a private path. */
  viaInternet?: boolean;
}

/* ---------------- CIDR helpers ---------------- */

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) throw new Error(`bad IP ${ip}`);
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function cidrContains(cidr: string, ip: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1) >>> 0);
  return ((ipToInt(base) & mask) >>> 0) === ((ipToInt(ip) & mask) >>> 0);
}

export function prefixLength(cidr: string): number {
  const bits = cidr.split("/")[1];
  return bits === undefined ? 32 : Number(bits);
}

export function isCidr(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(s.trim());
  return Boolean(m) && m!.slice(1, 5).every((p) => Number(p) <= 255) && (m![5] === undefined || Number(m![5]) <= 32);
}

/** Longest-prefix match over a route table. */
export function selectRoute(table: RouteTable, ip: string): Route | undefined {
  // Service routes (service:<name>) are not addresses; they are matched by name elsewhere.
  return table.routes.filter((r) => isCidr(r.dest) && cidrContains(r.dest, ip)).sort((a, b) => prefixLength(b.dest) - prefixLength(a.dest))[0];
}

function portIn(ports: [number, number] | "any", port: number): boolean {
  return ports === "any" || (port >= ports[0] && port <= ports[1]);
}

function protoMatches(rule: Proto, flow: Proto): boolean {
  return rule === "any" || rule === flow;
}

/* ---------------- grammars (one line per rule) ---------------- */

export interface ParseError {
  line: number;
  message: string;
}

function parsePorts(s: string): [number, number] | "any" | undefined {
  if (s === "any" || s === "*") return "any";
  const m = /^(\d+)(?:-(\d+))?$/.exec(s);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a > 65535 || b > 65535 || b < a) return undefined;
  return [a, b];
}

function parseProto(s: string): Proto | undefined {
  return (["tcp", "udp", "icmp", "any"] as const).find((p) => p === s.toLowerCase());
}

/** Stateful filter: `in tcp 5432 from 10.0.1.0/24` or `out any any to 0.0.0.0/0` or `in tcp 5432 from filter:app`. */
export function parseStatefulRules(text: string): { rules: StatefulRule[]; errors: ParseError[] } {
  const rules: StatefulRule[] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^(in|out)\s+(\S+)\s+(\S+)\s+(?:from|to)\s+(\S+)$/i.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "in|out <proto> <port|range|any> from|to <cidr|filter:id>"' });
      return;
    }
    const proto = parseProto(m[2]);
    const ports = parsePorts(m[3]);
    const source = m[4];
    if (!proto) errors.push({ line, message: `unknown protocol ${m[2]}` });
    else if (!ports) errors.push({ line, message: `bad port or range ${m[3]}` });
    else if (!isCidr(source) && !source.startsWith("filter:")) errors.push({ line, message: `${source} is neither a CIDR nor filter:<id>` });
    else rules.push({ direction: m[1].toLowerCase() as "in" | "out", proto, ports, source, line });
  });
  return { rules, errors };
}

/** Stateless filter: `100 allow in tcp 5432 10.0.1.0/24`, `* deny in any any 0.0.0.0/0`. Lower numbers win. */
export function parseStatelessRules(text: string): { rules: StatelessRule[]; errors: ParseError[] } {
  const rules: StatelessRule[] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^(\d+|\*)\s+(allow|deny)\s+(in|out)\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "<number|*> allow|deny in|out <proto> <port|range|any> <cidr>"' });
      return;
    }
    const proto = parseProto(m[4]);
    const ports = parsePorts(m[5]);
    if (!proto) errors.push({ line, message: `unknown protocol ${m[4]}` });
    else if (!ports) errors.push({ line, message: `bad port or range ${m[5]}` });
    else if (!isCidr(m[6])) errors.push({ line, message: `${m[6]} is not a CIDR` });
    else rules.push({ n: m[1] === "*" ? Number.MAX_SAFE_INTEGER : Number(m[1]), action: m[2].toLowerCase() as "allow" | "deny", direction: m[3].toLowerCase() as "in" | "out", proto, ports, cidr: m[6], line });
  });
  return { rules, errors };
}

/** Route table: `10.0.0.0/16 -> local`, `0.0.0.0/0 -> nat:nat-a`, `10.1.0.0/16 -> hub:core`, `service:object-store -> endpoint:objects`. */
export function parseRoutes(text: string): { routes: Route[]; errors: ParseError[] } {
  const routes: Route[] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^(\S+)\s*->\s*(\S+)$/.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "<cidr|service:name> -> <local|internet-gateway|nat:id|hub:id|endpoint:id|peer:network|blackhole>"' });
      return;
    }
    const [, dest, target] = m;
    const okTarget = /^(local|internet-gateway|blackhole|nat:[\w-]+|hub:[\w-]+|endpoint:[\w-]+|peer:[\w-]+)$/.test(target);
    if (!okTarget) errors.push({ line, message: `unknown target ${target}` });
    else if (!isCidr(dest) && !dest.startsWith("service:")) errors.push({ line, message: `${dest} is neither a CIDR nor service:<name>` });
    else routes.push({ dest, target: target as RouteTarget, line });
  });
  return { routes, errors };
}

/** Hub routes: `10.1.0.0/16 -> net-b`. */
export function parseHubRoutes(text: string): { routes: Hub["routes"]; errors: ParseError[] } {
  const routes: Hub["routes"] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^(\S+)\s*->\s*([\w-]+)$/.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "<cidr> -> <network id>"' });
      return;
    }
    if (!isCidr(m[1])) errors.push({ line, message: `${m[1]} is not a CIDR` });
    else routes.push({ dest: m[1], network: m[2], line });
  });
  return { routes, errors };
}

/* ---------------- tracing ---------------- */

interface Side {
  kind: "host" | "internet" | "service";
  id: string;
  ip: string;
  network?: Network;
  host?: Host;
  subnet?: Subnet;
}

function findHost(t: Topology, id: string): Side | undefined {
  for (const n of t.networks) {
    const h = n.hosts.find((x) => x.id === id);
    if (h) return { kind: "host", id, ip: h.ip, network: n, host: h, subnet: n.subnets.find((s) => s.id === h.subnet) };
  }
  return undefined;
}

function resolveSide(t: Topology, ref: string): Side | undefined {
  if (ref.startsWith("internet:")) return { kind: "internet", id: ref, ip: ref.slice("internet:".length) };
  if (ref.startsWith("service:")) return { kind: "service", id: ref, ip: "0.0.0.0" };
  return findHost(t, ref);
}

const EPHEMERAL: [number, number] = [1024, 65535];

function statefulAllows(filters: StatefulFilter[], host: Host, t: Topology, direction: "in" | "out", flow: Flow, otherIp: string, otherHost: Host | undefined): { ok: boolean; why: string } {
  const attached = host.filters.map((id) => filters.find((f) => f.id === id)).filter((f): f is StatefulFilter => Boolean(f));
  for (const f of attached) {
    for (const r of f.rules) {
      if (r.direction !== direction || !protoMatches(r.proto, flow.proto) || !portIn(r.ports, flow.port)) continue;
      if (r.source.startsWith("filter:")) {
        const fid = r.source.slice("filter:".length);
        if (otherHost?.filters.includes(fid)) return { ok: true, why: `${f.id} line ${r.line} allows ${direction === "in" ? "from" : "to"} any host carrying filter ${fid}` };
        continue;
      }
      if (cidrContains(r.source, otherIp)) return { ok: true, why: `${f.id} line ${r.line} allows ${direction === "in" ? "from" : "to"} ${r.source}` };
    }
  }
  void t;
  return { ok: false, why: attached.length ? `no ${direction}bound rule on ${attached.map((f) => f.id).join(", ")} allows ${flow.proto} ${flow.port} ${direction === "in" ? "from" : "to"} ${otherIp}` : `host ${host.id} has no stateful filter, so nothing is allowed` };
}

function statelessVerdict(filter: StatelessFilter | undefined, direction: "in" | "out", proto: Proto, port: number, otherIp: string): { ok: boolean; why: string } {
  if (!filter) return { ok: true, why: "no stateless filter on this subnet" };
  const rules = filter.rules.filter((r) => r.direction === direction).sort((a, b) => a.n - b.n);
  for (const r of rules) {
    if (protoMatches(r.proto, proto) && portIn(r.ports, port) && cidrContains(r.cidr, otherIp)) {
      return { ok: r.action === "allow", why: `${filter.id} rule ${r.n === Number.MAX_SAFE_INTEGER ? "*" : r.n} (${r.action} ${direction} ${r.proto} ${r.ports === "any" ? "any" : r.ports.join("-")} ${r.cidr}) matched first` };
    }
  }
  return { ok: false, why: `${filter.id} has no ${direction}bound rule matching ${proto} ${port} ${direction === "in" ? "from" : "to"} ${otherIp}; stateless filters deny what they do not list` };
}

export function trace(t: Topology, flow: Flow): TraceResult {
  const hops: Hop[] = [];
  const flowLog: string[] = [];
  let n = 0;
  const pass = (where: string, detail: string) => hops.push({ n: ++n, where, verdict: "pass", detail });
  const drop = (where: string, detail: string): TraceResult => {
    const hop: Hop = { n: ++n, where, verdict: "drop", detail };
    hops.push(hop);
    flowLog.push(`${flow.from} -> ${flow.to} ${flow.proto}/${flow.port} REJECT at ${where}`);
    return { reachable: false, hops, droppedAt: hop, flowLog };
  };
  const src = resolveSide(t, flow.from);
  const dst = resolveSide(t, flow.to);
  if (!src) return drop("source", `unknown source ${flow.from}`);
  if (!dst) return drop("destination", `unknown destination ${flow.to}`);
  if (src.kind !== "host" && dst.kind !== "host") return drop("source", "at least one side must be a host in a network");

  let viaInternet = false;

  // 1. Source side leaves its host and subnet.
  if (src.kind === "host" && src.host && src.network && src.subnet) {
    const sf = statefulAllows(src.network.statefulFilters, src.host, t, "out", flow, dst.ip, dst.host);
    if (!sf.ok) return drop(`${src.host.id} stateful filter (outbound)`, sf.why);
    pass(`${src.host.id} stateful filter (outbound)`, sf.why);
    const sl = statelessVerdict(src.network.statelessFilters.find((f) => f.id === src.subnet?.statelessFilter), "out", flow.proto, flow.port, dst.ip);
    if (!sl.ok) return drop(`${src.subnet.id} stateless filter (outbound)`, sl.why);
    pass(`${src.subnet.id} stateless filter (outbound)`, sl.why);

    // 2. Routing from the source subnet.
    const table = src.network.routeTables.find((r) => r.id === src.subnet?.routeTable);
    if (!table) return drop(`${src.subnet.id} route table`, "subnet has no route table");
    if (dst.kind === "service") {
      const er = table.routes.find((r) => r.dest === `service:${dst.id.slice("service:".length)}` && r.target.startsWith("endpoint:"));
      if (er) {
        const epId = er.target.slice("endpoint:".length);
        const ep = src.network.endpoints.find((e) => e.id === epId);
        if (!ep) return drop(`${table.id} route line ${er.line}`, `endpoint ${epId} does not exist in ${src.network.id}`);
        pass(`${table.id} route line ${er.line}`, `service ${dst.id.slice(8)} reached through private endpoint ${epId}; traffic never leaves the network`);
        flowLog.push(`${flow.from} -> ${flow.to} ${flow.proto}/${flow.port} ACCEPT`);
        return { reachable: true, hops, flowLog };
      }
      // No endpoint: the service lives on the internet.
      const internet = selectRoute(table, "203.0.113.1");
      const r = internetPath(src.network, src.host, table, internet);
      if (!r.ok) return drop(r.where, `${r.why} (no private endpoint route for ${dst.id} either)`);
      pass(r.where, `${r.why}; the service is reached over the public internet, not a private path`);
      viaInternet = true;
      flowLog.push(`${flow.from} -> ${flow.to} ${flow.proto}/${flow.port} ACCEPT (via internet)`);
      return { reachable: true, hops, flowLog, viaInternet };
    }
    const route = selectRoute(table, dst.ip);
    if (!route) return drop(`${table.id} route table`, `no route matches ${dst.ip}; the packet has nowhere to go`);
    if (route.target === "blackhole") return drop(`${table.id} route line ${route.line}`, `${route.dest} is a blackhole route`);
    if (dst.kind === "internet") {
      const r = internetPath(src.network, src.host, table, route);
      if (!r.ok) return drop(r.where, r.why);
      pass(r.where, r.why);
      flowLog.push(`${flow.from} -> ${flow.to} ${flow.proto}/${flow.port} ACCEPT`);
      return { reachable: true, hops, flowLog };
    }
    // Host to host.
    const sameNetwork = dst.network?.id === src.network.id;
    if (route.target === "local") {
      if (!sameNetwork) return drop(`${table.id} route line ${route.line}`, `${dst.ip} is in ${dst.network?.id ?? "another network"}, but the matching route is local to ${src.network.id}`);
      pass(`${table.id} route line ${route.line}`, `${route.dest} -> local: same network, delivered directly`);
    } else if (route.target.startsWith("hub:")) {
      const hub = t.hubs.find((h) => h.id === route.target.slice("hub:".length));
      if (!hub) return drop(`${table.id} route line ${route.line}`, `hub ${route.target.slice(4)} does not exist`);
      if (!hub.attached.includes(src.network.id)) return drop(`hub ${hub.id}`, `${src.network.id} is not attached to the hub`);
      pass(`${table.id} route line ${route.line}`, `${route.dest} -> ${route.target}: handed to the hub router`);
      const hr = hub.routes.filter((r) => cidrContains(r.dest, dst.ip)).sort((a, b) => prefixLength(b.dest) - prefixLength(a.dest))[0];
      if (!hr) return drop(`hub ${hub.id} route table`, `the hub has no route for ${dst.ip}`);
      if (hr.network !== dst.network?.id) return drop(`hub ${hub.id} route line ${hr.line}`, `${hr.dest} points at ${hr.network}, but ${dst.ip} lives in ${dst.network?.id}`);
      if (!hub.attached.includes(hr.network)) return drop(`hub ${hub.id} route line ${hr.line}`, `${hr.network} is not attached to the hub`);
      pass(`hub ${hub.id} route line ${hr.line}`, `${hr.dest} -> ${hr.network}: forwarded into the destination network`);
    } else if (route.target.startsWith("peer:")) {
      const peer = route.target.slice("peer:".length);
      if (dst.network?.id !== peer) return drop(`${table.id} route line ${route.line}`, `peering route points at ${peer}, but ${dst.ip} lives in ${dst.network?.id}`);
      pass(`${table.id} route line ${route.line}`, `${route.dest} -> ${route.target}: delivered over the peering link`);
    } else {
      return drop(`${table.id} route line ${route.line}`, `${route.dest} -> ${route.target} does not lead to ${dst.ip}; a host-to-host flow needs local, hub or peer`);
    }
  } else if (src.kind === "internet") {
    // Internet reaching a host: the network needs an internet gateway, the subnet a route to it, the host a public address.
    if (!dst.network || !dst.host || !dst.subnet) return drop("destination", "destination is not a host");
    if (!dst.network.internetGateway) return drop(`${dst.network.id} edge`, "the network has no internet gateway");
    const table = dst.network.routeTables.find((r) => r.id === dst.subnet?.routeTable);
    const route = table ? selectRoute(table, src.ip) : undefined;
    if (!route || route.target !== "internet-gateway") return drop(`${dst.subnet.id} route table`, `the subnet has no route to the internet gateway, so it is private; a reply could never leave`);
    if (!dst.host.publicIp) return drop(`${dst.host.id} address`, "the host has no public address; the internet cannot address it");
    pass(`${dst.network.id} internet gateway`, `${src.ip} reaches public address ${dst.host.publicIp} of ${dst.host.id}`);
  }

  // 3. Destination side: stateless inbound, stateful inbound, and the reply path.
  if (dst.kind === "host" && dst.host && dst.network && dst.subnet) {
    const srcIp = src.kind === "host" ? src.ip : src.ip;
    const sl = statelessVerdict(dst.network.statelessFilters.find((f) => f.id === dst.subnet?.statelessFilter), "in", flow.proto, flow.port, srcIp);
    if (!sl.ok) return drop(`${dst.subnet.id} stateless filter (inbound)`, sl.why);
    pass(`${dst.subnet.id} stateless filter (inbound)`, sl.why);
    const sf = statefulAllows(dst.network.statefulFilters, dst.host, t, "in", flow, srcIp, src.host);
    if (!sf.ok) return drop(`${dst.host.id} stateful filter (inbound)`, sf.why);
    pass(`${dst.host.id} stateful filter (inbound)`, sf.why);
    // Reply: stateful filters remember the flow; stateless ones need an explicit outbound rule on ephemeral ports.
    const replyProto = flow.proto;
    const sr = statelessVerdict(dst.network.statelessFilters.find((f) => f.id === dst.subnet?.statelessFilter), "out", replyProto, EPHEMERAL[0], srcIp);
    if (!sr.ok) return drop(`${dst.subnet.id} stateless filter (reply, outbound)`, `${sr.why}. The request arrived, but the reply to the client's ephemeral port (${EPHEMERAL[0]}-${EPHEMERAL[1]}) is blocked, so the connection hangs`);
    pass(`${dst.subnet.id} stateless filter (reply, outbound)`, `reply to ${srcIp} on an ephemeral port is allowed: ${sr.why}`);
    // The reply must route back.
    const table = dst.network.routeTables.find((r) => r.id === dst.subnet?.routeTable);
    const back = table ? selectRoute(table, srcIp) : undefined;
    if (src.kind === "host" && (!back || back.target === "blackhole")) return drop(`${dst.subnet.id} route table (reply)`, `no route back to ${srcIp}; the request arrives but the reply is lost`);
    if (src.kind === "host" && src.network && src.network.id !== dst.network.id && back && back.target === "local") return drop(`${dst.subnet.id} route table (reply)`, `the only route for ${srcIp} is local to ${dst.network.id}, so the reply never leaves`);
    if (src.kind === "host" && src.network && back && back.target.startsWith("hub:")) {
      const hub = t.hubs.find((h) => h.id === back.target.slice("hub:".length));
      const hr = hub?.routes.filter((r) => cidrContains(r.dest, srcIp)).sort((a, b) => prefixLength(b.dest) - prefixLength(a.dest))[0];
      if (!hub) return drop(`${dst.subnet.id} route table (reply)`, `reply route points at hub ${back.target.slice(4)}, which does not exist`);
      if (!hr) return drop(`hub ${hub.id} route table (reply)`, `the request got through, but the hub has no route back to ${srcIp} in ${src.network.id}; the reply is dropped and the connection hangs`);
      if (hr.network !== src.network.id) return drop(`hub ${hub.id} route line ${hr.line} (reply)`, `${hr.dest} points at ${hr.network}, but ${srcIp} lives in ${src.network.id}`);
    }
    if (src.kind === "host" && src.network && src.subnet) {
      const sl2 = statelessVerdict(src.network.statelessFilters.find((f) => f.id === src.subnet?.statelessFilter), "in", replyProto, EPHEMERAL[0], dst.ip);
      if (!sl2.ok) return drop(`${src.subnet.id} stateless filter (reply, inbound)`, `${sl2.why}. The reply cannot re-enter the client's subnet`);
    }
    pass(`${dst.subnet.id} route table (reply)`, back ? `reply to ${srcIp} routed by ${back.dest} -> ${back.target}` : "reply routed");
  }
  flowLog.push(`${flow.from} -> ${flow.to} ${flow.proto}/${flow.port} ACCEPT`);
  return { reachable: true, hops, flowLog, ...(viaInternet ? { viaInternet } : {}) };
}

function internetPath(network: Network, host: Host, table: RouteTable, route: Route | undefined): { ok: boolean; where: string; why: string } {
  if (!route) return { ok: false, where: `${table.id} route table`, why: "no route for internet addresses; the subnet is isolated" };
  if (route.target === "internet-gateway") {
    if (!network.internetGateway) return { ok: false, where: `${table.id} route line ${route.line}`, why: "route points at an internet gateway the network does not have" };
    if (!host.publicIp) return { ok: false, where: `${host.id} address`, why: `the route goes to the internet gateway, but ${host.id} has no public address, so the gateway cannot send it out; give it a public address or route through an address translator` };
    return { ok: true, where: `${table.id} route line ${route.line}`, why: `${route.dest} -> internet-gateway, leaving as public address ${host.publicIp}` };
  }
  if (route.target.startsWith("nat:")) {
    const nat = network.nats.find((x) => x.id === route.target.slice("nat:".length));
    if (!nat) return { ok: false, where: `${table.id} route line ${route.line}`, why: `address translator ${route.target.slice(4)} does not exist` };
    const natSubnet = network.subnets.find((s) => s.id === nat.subnet);
    const natTable = network.routeTables.find((r) => r.id === natSubnet?.routeTable);
    const natRoute = natTable ? selectRoute(natTable, "203.0.113.1") : undefined;
    if (!natRoute || natRoute.target !== "internet-gateway") return { ok: false, where: `address translator ${nat.id}`, why: `the translator sits in ${nat.subnet}, whose route table has no route to the internet gateway, so it cannot forward anything` };
    if (!network.internetGateway) return { ok: false, where: `address translator ${nat.id}`, why: "the network has no internet gateway" };
    return { ok: true, where: `${table.id} route line ${route.line}`, why: `${route.dest} -> ${route.target}: translated by ${nat.id} in ${nat.subnet}, then out through the internet gateway; the host stays unreachable from outside` };
  }
  return { ok: false, where: `${table.id} route line ${route.line}`, why: `${route.dest} -> ${route.target} does not lead to the internet` };
}

/** Serialises an editable component to the line grammar and parses it back. */
export function statefulToText(f: StatefulFilter): string {
  return f.rules.map((r) => `${r.direction} ${r.proto} ${r.ports === "any" ? "any" : r.ports[0] === r.ports[1] ? r.ports[0] : r.ports.join("-")} ${r.direction === "in" ? "from" : "to"} ${r.source}`).join("\n");
}
export function statelessToText(f: StatelessFilter): string {
  return f.rules.map((r) => `${r.n === Number.MAX_SAFE_INTEGER ? "*" : r.n} ${r.action} ${r.direction} ${r.proto} ${r.ports === "any" ? "any" : r.ports[0] === r.ports[1] ? r.ports[0] : r.ports.join("-")} ${r.cidr}`).join("\n");
}
export function routesToText(t: RouteTable): string {
  return t.routes.map((r) => `${r.dest} -> ${r.target}`).join("\n");
}
export function hubToText(h: Hub): string {
  return h.routes.map((r) => `${r.dest} -> ${r.network}`).join("\n");
}
