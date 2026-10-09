import { parseHubRoutes, parseRoutes, parseStatefulRules, parseStatelessRules, type Flow, type Topology } from "../../engine/network/trace";

/**
 * Network path lab exercises on the fictional platform. Each gives a
 * topology, one editable component (a stateful filter, a stateless filter,
 * a route table or the hub's routes) and flows that must come out a certain
 * way. Passing credits the Study objectives curated for it. `solution` is
 * the reference the tests use; it is never shown to the learner.
 */
export type Editable = { kind: "stateful"; id: string } | { kind: "stateless"; id: string } | { kind: "routes"; id: string } | { kind: "hub"; id: string };

export interface NetworkExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  topology: Topology;
  editable: Editable;
  flows: Array<{ id: string; label: string; flow: Flow; expect: "reach" | "drop" }>;
  hints: string[];
  solution: string;
}

const sf = (id: string, text: string) => ({ id, rules: parseStatefulRules(text).rules });
const sl = (id: string, text: string) => ({ id, rules: parseStatelessRules(text).rules });
const rt = (id: string, text: string) => ({ id, routes: parseRoutes(text).routes });

/** The courier company's main network: a public subnet with the translator, an app subnet and a data subnet. */
function mainNetwork(over: { appFilter?: string; dataFilter?: string; dataStateless?: string; appRoutes?: string; dataRoutes?: string; statelessOnData?: boolean }) {
  return {
    id: "net-main",
    cidr: "10.0.0.0/16",
    internetGateway: true,
    subnets: [
      { id: "subnet-public", cidr: "10.0.0.0/24", routeTable: "rt-public" },
      { id: "subnet-app", cidr: "10.0.1.0/24", routeTable: "rt-app" },
      { id: "subnet-data", cidr: "10.0.2.0/24", routeTable: "rt-data", ...(over.statelessOnData ? { statelessFilter: "acl-data" } : {}) },
    ],
    routeTables: [
      rt("rt-public", "10.0.0.0/16 -> local\n0.0.0.0/0 -> internet-gateway"),
      rt("rt-app", over.appRoutes ?? "10.0.0.0/16 -> local"),
      rt("rt-data", over.dataRoutes ?? "10.0.0.0/16 -> local"),
    ],
    statefulFilters: [
      sf("filter-web", "in tcp 443 from 0.0.0.0/0\nout any any to 0.0.0.0/0"),
      sf("filter-app", over.appFilter ?? "in tcp 8080 from filter:filter-web\nout any any to 0.0.0.0/0"),
      sf("filter-db", over.dataFilter ?? "in tcp 5432 from 10.0.0.0/24\nout any any to 0.0.0.0/0"),
    ],
    statelessFilters: over.statelessOnData ? [sl("acl-data", over.dataStateless ?? "100 allow in tcp 5432 10.0.1.0/24\n100 allow out tcp 5432 10.0.1.0/24\n* deny in any any 0.0.0.0/0\n* deny out any any 0.0.0.0/0")] : [],
    hosts: [
      { id: "web-1", subnet: "subnet-public", ip: "10.0.0.10", publicIp: "203.0.113.10", filters: ["filter-web"] },
      { id: "app-1", subnet: "subnet-app", ip: "10.0.1.10", filters: ["filter-app"] },
      { id: "db-1", subnet: "subnet-data", ip: "10.0.2.10", filters: ["filter-db"] },
    ],
    nats: [{ id: "nat-a", subnet: "subnet-public" }],
    endpoints: [{ id: "ep-objects", service: "object-store" }],
  };
}

export const NETWORK_EXERCISES: NetworkExercise[] = [
  {
    id: "net-01-stateful-source",
    title: "\"It cannot reach the database\"",
    brief: "The app host cannot connect to the database on port 5432. The database's stateful filter allows 5432, but from the wrong place. Fix the database filter so the app host can connect and the web host still cannot.",
    teaches: "A stateful filter rule names who may connect; a rule for the wrong source is as good as no rule. Referencing the app's filter (filter:filter-app) is more robust than a subnet range.",
    topology: { networks: [mainNetwork({})], hubs: [] },
    editable: { kind: "stateful", id: "filter-db" },
    flows: [
      { id: "app-db", label: "app-1 to db-1 on 5432", flow: { from: "app-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "reach" },
      { id: "web-db", label: "web-1 to db-1 on 5432 (must stay blocked)", flow: { from: "web-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "drop" },
    ],
    hints: ["Read the trace for app-1: which hop drops it, and what does the rule say?", "The rule allows 10.0.0.0/24 (the public subnet); app-1 is 10.0.1.10.", "in tcp 5432 from filter:filter-app, or in tcp 5432 from 10.0.1.0/24"],
    solution: "in tcp 5432 from filter:filter-app\nout any any to 0.0.0.0/0",
  },
  {
    id: "net-02-stateless-reply",
    title: "The request arrives, the reply never leaves",
    brief: "A stateless filter now guards the data subnet. It allows 5432 in from the app subnet, yet connections hang. Stateless filters do not remember flows: the reply to the client's ephemeral port needs its own outbound rule. Fix the stateless filter.",
    teaches: "Stateful filters allow the reply automatically; stateless ones need an explicit outbound rule for the ephemeral port range (1024-65535), the classic cause of \"it connects but hangs\".",
    topology: { networks: [mainNetwork({ dataFilter: "in tcp 5432 from filter:filter-app\nout any any to 0.0.0.0/0", statelessOnData: true })], hubs: [] },
    editable: { kind: "stateless", id: "acl-data" },
    flows: [
      { id: "app-db", label: "app-1 to db-1 on 5432", flow: { from: "app-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "reach" },
      { id: "web-db", label: "web-1 to db-1 on 5432 (must stay blocked)", flow: { from: "web-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "drop" },
    ],
    hints: ["The trace passes the inbound hops and drops at the reply.", "The outbound rule allows port 5432, but the reply goes to a high-numbered port on the client.", "100 allow out tcp 1024-65535 10.0.1.0/24"],
    solution: "100 allow in tcp 5432 10.0.1.0/24\n100 allow out tcp 1024-65535 10.0.1.0/24\n* deny in any any 0.0.0.0/0\n* deny out any any 0.0.0.0/0",
  },
  {
    id: "net-03-nat",
    title: "A private host needs updates from the internet",
    brief: "The app host must download packages from the internet, but it has no public address and must stay unreachable from outside. Edit the app subnet's route table.",
    teaches: "A private subnet reaches the internet through an address translator in a public subnet; a direct route to the internet gateway does nothing for a host without a public address, and would not protect it anyway.",
    topology: { networks: [mainNetwork({})], hubs: [] },
    editable: { kind: "routes", id: "rt-app" },
    flows: [
      { id: "app-out", label: "app-1 to the internet (updates) on 443", flow: { from: "app-1", to: "internet:198.51.100.5", proto: "tcp", port: 443 }, expect: "reach" },
      { id: "in-app", label: "internet to app-1 on 22 (must stay blocked)", flow: { from: "internet:198.51.100.5", to: "app-1", proto: "tcp", port: 22 }, expect: "drop" },
      { id: "app-db", label: "app-1 to db-1 on 5432 still local", flow: { from: "app-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "drop" },
    ],
    hints: ["The trace says there is no route for internet addresses.", "0.0.0.0/0 -> internet-gateway fails too: read why in the trace (no public address).", "0.0.0.0/0 -> nat:nat-a; the translator lives in the public subnet, which routes to the gateway."],
    solution: "10.0.0.0/16 -> local\n0.0.0.0/0 -> nat:nat-a",
  },
  {
    id: "net-04-endpoint",
    title: "Reach the object store without touching the internet",
    brief: "The database host must write backups to the platform's object store, and the data subnet must stay isolated from the internet. Edit the data subnet's route table so the store is reached through the private endpoint.",
    teaches: "Platform services can be reached through a private endpoint inside the network; without one, the only path is the public internet, which an isolated subnet does not have.",
    topology: { networks: [mainNetwork({ dataFilter: "in tcp 5432 from filter:filter-app\nout any any to 0.0.0.0/0" })], hubs: [] },
    editable: { kind: "routes", id: "rt-data" },
    flows: [
      { id: "db-store", label: "db-1 to the object store on 443", flow: { from: "db-1", to: "service:object-store", proto: "tcp", port: 443 }, expect: "reach" },
      { id: "db-internet", label: "db-1 to the internet (must stay blocked)", flow: { from: "db-1", to: "internet:198.51.100.5", proto: "tcp", port: 443 }, expect: "drop" },
    ],
    hints: ["The network already has an endpoint called ep-objects for service object-store.", "A route's destination can be a service: service:object-store -> endpoint:ep-objects", "Do not add 0.0.0.0/0 -> nat:nat-a; the second flow must stay blocked."],
    solution: "10.0.0.0/16 -> local\nservice:object-store -> endpoint:ep-objects",
  },
  {
    id: "net-05-hub",
    title: "Two networks through the hub, and the way back",
    brief: "The analytics network reaches the main network through the hub router, but connections from analytics to the database hang. The hub knows how to reach the main network; it does not know the way back. Edit the hub's routes.",
    teaches: "Routing is per direction. A request can arrive while the reply has no route home; the hub needs a route for every network it connects, and each subnet needs a route to the hub.",
    topology: {
      networks: [
        mainNetwork({ dataFilter: "in tcp 5432 from 10.1.0.0/16\nout any any to 0.0.0.0/0", dataRoutes: "10.0.0.0/16 -> local\n10.1.0.0/16 -> hub:hub-core" }),
        {
          id: "net-analytics",
          cidr: "10.1.0.0/16",
          internetGateway: false,
          subnets: [{ id: "subnet-analytics", cidr: "10.1.0.0/24", routeTable: "rt-analytics" }],
          routeTables: [rt("rt-analytics", "10.1.0.0/16 -> local\n10.0.0.0/16 -> hub:hub-core")],
          statefulFilters: [sf("filter-analytics", "out any any to 0.0.0.0/0")],
          statelessFilters: [],
          hosts: [{ id: "etl-1", subnet: "subnet-analytics", ip: "10.1.0.10", filters: ["filter-analytics"] }],
          nats: [],
          endpoints: [],
        },
      ],
      hubs: [{ id: "hub-core", attached: ["net-main", "net-analytics"], routes: parseHubRoutes("10.0.0.0/16 -> net-main").routes }],
    },
    editable: { kind: "hub", id: "hub-core" },
    flows: [
      { id: "etl-db", label: "etl-1 (analytics) to db-1 on 5432", flow: { from: "etl-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "reach" },
      { id: "db-etl", label: "db-1 to etl-1 on 22 (no inbound rule on etl-1, must stay blocked)", flow: { from: "db-1", to: "etl-1", proto: "tcp", port: 22 }, expect: "drop" },
    ],
    hints: ["Trace etl-1 to db-1: the request is forwarded, but look at the reply hop.", "The data subnet sends 10.1.0.0/16 to the hub; the hub has no route for 10.1.0.0/16.", "10.1.0.0/16 -> net-analytics"],
    solution: "10.0.0.0/16 -> net-main\n10.1.0.0/16 -> net-analytics",
  },
  {
    id: "net-06-rule-order",
    title: "Numbered rules: the first match wins",
    brief: "The data subnet's stateless filter has an allow for the app subnet and a deny for everything, but the deny carries the lower number, so it matches first. Renumber or reorder so the app subnet gets in and everything else stays out.",
    teaches: "Stateless filters evaluate rules in number order and stop at the first match; a broad deny with a low number silently blocks every allow after it.",
    topology: { networks: [mainNetwork({ dataFilter: "in tcp 5432 from filter:filter-app\nout any any to 0.0.0.0/0", statelessOnData: true, dataStateless: "50 deny in any any 0.0.0.0/0\n100 allow in tcp 5432 10.0.1.0/24\n100 allow out tcp 1024-65535 10.0.1.0/24\n* deny out any any 0.0.0.0/0" })], hubs: [] },
    editable: { kind: "stateless", id: "acl-data" },
    flows: [
      { id: "app-db", label: "app-1 to db-1 on 5432", flow: { from: "app-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "reach" },
      { id: "web-db", label: "web-1 to db-1 on 5432 (must stay blocked)", flow: { from: "web-1", to: "db-1", proto: "tcp", port: 5432 }, expect: "drop" },
    ],
    hints: ["The trace names the rule that matched first: rule 50.", "Give the deny a higher number than the allow, or use * for a catch-all deny.", "100 allow in tcp 5432 10.0.1.0/24 then * deny in any any 0.0.0.0/0"],
    solution: "100 allow in tcp 5432 10.0.1.0/24\n100 allow out tcp 1024-65535 10.0.1.0/24\n* deny in any any 0.0.0.0/0\n* deny out any any 0.0.0.0/0",
  },
];

export const NETWORK_EXERCISE_BY_ID = new Map(NETWORK_EXERCISES.map((e) => [e.id, e]));
