import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { NETWORK_EXERCISES } from "../src/content/study/networkExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { cidrContains, parseHubRoutes, parseRoutes, parseStatefulRules, parseStatelessRules, selectRoute, trace } from "../src/engine/network/trace";
import { creditLabExercise } from "../src/engine/study/bridge";
import { applyEdit } from "../src/pages/NetworkLabPage";

const ex = (id: string) => NETWORK_EXERCISES.find((e) => e.id === id)!;

describe("network grammar and routing primitives", () => {
  it("matches CIDRs and picks the longest prefix", () => {
    expect(cidrContains("10.0.0.0/16", "10.0.1.10")).toBe(true);
    expect(cidrContains("10.0.0.0/24", "10.0.1.10")).toBe(false);
    expect(cidrContains("0.0.0.0/0", "198.51.100.5")).toBe(true);
    expect(cidrContains("10.0.2.10", "10.0.2.10")).toBe(true);
    const table = parseRoutes("0.0.0.0/0 -> nat:nat-a\n10.0.0.0/16 -> local\n10.0.2.0/24 -> blackhole").routes;
    expect(selectRoute({ id: "t", routes: table }, "10.0.2.10")?.target).toBe("blackhole");
    expect(selectRoute({ id: "t", routes: table }, "10.0.1.10")?.target).toBe("local");
    expect(selectRoute({ id: "t", routes: table }, "8.8.8.8")?.target).toBe("nat:nat-a");
  });

  it("parses the three filter grammars and reports bad lines by number", () => {
    const s = parseStatefulRules("in tcp 5432 from 10.0.1.0/24\nout any any to 0.0.0.0/0\nin tcp 22 from filter:filter-app\nin tcp 99999 from 10.0.0.0/8\nsideways tcp 1 from x");
    expect(s.rules).toHaveLength(3);
    expect(s.rules[0]).toMatchObject({ direction: "in", proto: "tcp", ports: [5432, 5432], source: "10.0.1.0/24", line: 1 });
    expect(s.errors.map((e) => e.line)).toEqual([4, 5]);
    const l = parseStatelessRules("100 allow in tcp 5432 10.0.1.0/24\n* deny out any any 0.0.0.0/0\n50 allow in tcp 1024-65535 10.0.1.0/24\nbad");
    expect(l.rules).toHaveLength(3);
    expect(l.rules[1].n).toBe(Number.MAX_SAFE_INTEGER);
    expect(l.rules[2].ports).toEqual([1024, 65535]);
    expect(l.errors).toEqual([{ line: 4, message: expect.stringMatching(/expected/) }]);
    const r = parseRoutes("10.0.0.0/16 -> local\nservice:object-store -> endpoint:ep-objects\n0.0.0.0/0 -> teleport:x\nnot a route");
    expect(r.routes).toHaveLength(2);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(parseHubRoutes("10.1.0.0/16 -> net-b\nnope").errors).toEqual([{ line: 2, message: expect.stringMatching(/expected/) }]);
  });
});

describe("path tracing rules", () => {
  it("drops at the destination's stateful filter when the source is wrong, and names the hop", () => {
    const t = ex("net-01-stateful-source").topology;
    const r = trace(t, { from: "app-1", to: "db-1", proto: "tcp", port: 5432 });
    expect(r.reachable).toBe(false);
    expect(r.droppedAt?.where).toBe("db-1 stateful filter (inbound)");
    expect(r.droppedAt?.detail).toMatch(/no inbound rule/);
    expect(r.hops.map((h) => h.verdict)).toEqual(["pass", "pass", "pass", "pass", "drop"]);
    expect(r.flowLog[0]).toMatch(/REJECT at db-1 stateful filter/);
  });

  it("a stateless filter blocks the reply unless the ephemeral range is allowed outbound", () => {
    const t = ex("net-02-stateless-reply").topology;
    const r = trace(t, { from: "app-1", to: "db-1", proto: "tcp", port: 5432 });
    expect(r.reachable).toBe(false);
    expect(r.droppedAt?.where).toBe("subnet-data stateless filter (reply, outbound)");
    expect(r.droppedAt?.detail).toMatch(/ephemeral/);
  });

  it("a private host reaches the internet only through the address translator; a gateway route without a public address fails", () => {
    const base = ex("net-03-nat");
    const viaIgw = applyEdit(base, "10.0.0.0/16 -> local\n0.0.0.0/0 -> internet-gateway");
    const r1 = trace(viaIgw.topology, { from: "app-1", to: "internet:198.51.100.5", proto: "tcp", port: 443 });
    expect(r1.reachable).toBe(false);
    expect(r1.droppedAt?.detail).toMatch(/no public address/);
    const viaNat = applyEdit(base, "10.0.0.0/16 -> local\n0.0.0.0/0 -> nat:nat-a");
    const r2 = trace(viaNat.topology, { from: "app-1", to: "internet:198.51.100.5", proto: "tcp", port: 443 });
    expect(r2.reachable).toBe(true);
    expect(r2.hops.at(-1)?.detail).toMatch(/translated by nat-a/);
    // Inbound from the internet stays blocked: the subnet has no gateway route and the host no public address.
    const r3 = trace(viaNat.topology, { from: "internet:198.51.100.5", to: "app-1", proto: "tcp", port: 22 });
    expect(r3.reachable).toBe(false);
    expect(r3.droppedAt?.where).toBe("subnet-app route table");
    // The public web host is reachable from the internet on 443 and nothing else.
    expect(trace(viaNat.topology, { from: "internet:198.51.100.5", to: "web-1", proto: "tcp", port: 443 }).reachable).toBe(true);
    expect(trace(viaNat.topology, { from: "internet:198.51.100.5", to: "web-1", proto: "tcp", port: 22 }).droppedAt?.where).toBe("web-1 stateful filter (inbound)");
  });

  it("a platform service is reached through a private endpoint route, otherwise over the internet or not at all", () => {
    const base = ex("net-04-endpoint");
    const isolated = trace(base.topology, { from: "db-1", to: "service:object-store", proto: "tcp", port: 443 });
    expect(isolated.reachable).toBe(false);
    expect(isolated.droppedAt?.detail).toMatch(/no private endpoint route/);
    const withEndpoint = applyEdit(base, "10.0.0.0/16 -> local\nservice:object-store -> endpoint:ep-objects");
    const r = trace(withEndpoint.topology, { from: "db-1", to: "service:object-store", proto: "tcp", port: 443 });
    expect(r.reachable).toBe(true);
    expect(r.viaInternet).toBeUndefined();
    const viaNat = applyEdit(base, "10.0.0.0/16 -> local\n0.0.0.0/0 -> nat:nat-a");
    const r2 = trace(viaNat.topology, { from: "db-1", to: "service:object-store", proto: "tcp", port: 443 });
    expect(r2.reachable).toBe(true);
    expect(r2.viaInternet).toBe(true);
    const missing = applyEdit(base, "10.0.0.0/16 -> local\nservice:object-store -> endpoint:ep-nope");
    expect(trace(missing.topology, { from: "db-1", to: "service:object-store", proto: "tcp", port: 443 }).droppedAt?.detail).toMatch(/does not exist/);
  });

  it("the hub forwards only with a route in both directions", () => {
    const base = ex("net-05-hub");
    const r = trace(base.topology, { from: "etl-1", to: "db-1", proto: "tcp", port: 5432 });
    expect(r.reachable).toBe(false);
    expect(r.droppedAt?.where).toBe("hub hub-core route table (reply)");
    expect(r.droppedAt?.detail).toMatch(/no route back/);
    const fixed = applyEdit(base, "10.0.0.0/16 -> net-main\n10.1.0.0/16 -> net-analytics");
    const r2 = trace(fixed.topology, { from: "etl-1", to: "db-1", proto: "tcp", port: 5432 });
    expect(r2.reachable).toBe(true);
    expect(r2.hops.some((h) => h.where.startsWith("hub hub-core"))).toBe(true);
    const wrong = applyEdit(base, "10.0.0.0/16 -> net-analytics\n10.1.0.0/16 -> net-analytics");
    expect(trace(wrong.topology, { from: "etl-1", to: "db-1", proto: "tcp", port: 5432 }).droppedAt?.detail).toMatch(/points at net-analytics/);
  });

  it("stateless rules match in number order", () => {
    const base = ex("net-06-rule-order");
    const r = trace(base.topology, { from: "app-1", to: "db-1", proto: "tcp", port: 5432 });
    expect(r.droppedAt?.where).toBe("subnet-data stateless filter (inbound)");
    expect(r.droppedAt?.detail).toMatch(/rule 50/);
  });

  it("reports unknown endpoints of a flow instead of throwing", () => {
    expect(trace(ex("net-01-stateful-source").topology, { from: "ghost", to: "db-1", proto: "tcp", port: 1 }).droppedAt?.detail).toMatch(/unknown source/);
    expect(trace(ex("net-01-stateful-source").topology, { from: "internet:1.1.1.1", to: "internet:2.2.2.2", proto: "tcp", port: 1 }).droppedAt?.detail).toMatch(/at least one side/);
  });
});

describe("network lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given, passes with its reference solution, and parses cleanly both ways", () => {
    for (const e of NETWORK_EXERCISES) {
      const start = applyEdit(e, "");
      void start;
      const asGiven = e.flows.every((f) => (f.expect === "reach") === trace(e.topology, f.flow).reachable);
      expect(asGiven, `${e.id} must not pass as given`).toBe(false);
      const solved = applyEdit(e, e.solution);
      expect(solved.errors, `${e.id} solution parses`).toEqual([]);
      for (const f of e.flows) expect(trace(solved.topology, f.flow).reachable, `${e.id}/${f.id}`).toBe(f.expect === "reach");
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of NETWORK_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("net-01-stateful-source", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["net-01-stateful-source"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["net-01-stateful-source"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(NETWORK_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["VPC", "NACL", "security group", "Security Group", "Transit Gateway", "PrivateLink", "NAT gateway", "AWS", "Amazon"]) expect(text, word).not.toContain(word);
  });
});
