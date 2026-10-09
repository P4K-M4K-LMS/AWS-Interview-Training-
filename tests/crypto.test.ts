import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { CRYPTO_EXERCISES } from "../src/content/study/cryptoExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { allowed, parseProgram, runProgram, type CryptoState, type Principal, type ServiceKey } from "../src/engine/crypto/envelope";
import { creditLabExercise } from "../src/engine/study/bridge";

const key = (): ServiceKey => ({
  id: "k",
  account: "a",
  versions: 1,
  rotationEnabled: false,
  policy: [
    { principal: "admin", actions: ["admin"], effect: "allow" },
    { principal: "app", actions: ["encrypt", "generate-data-key"], effect: "allow" },
    { principal: "read*", actions: ["decrypt"], effect: "allow" },
    { principal: "contractor-*", actions: ["decrypt"], effect: "deny" },
  ],
});
const principals: Principal[] = [
  { id: "admin", account: "a" },
  { id: "app", account: "a" },
  { id: "reader", account: "a" },
  { id: "contractor-1", account: "a" },
  { id: "partner", account: "b" },
  { id: "reader-b", account: "b" },
];
const initial = (objects: CryptoState["objects"]): Omit<CryptoState, "trace"> => ({ keys: [key()], objects, memory: { dataKeys: {}, wrapped: {} } });
const run = (text: string, objects: CryptoState["objects"] = [{ name: "big", sizeKb: 1000, state: "plaintext", stored: false }, { name: "small", sizeKb: 2, state: "plaintext", stored: false }]) => {
  const { commands, errors } = parseProgram(text);
  expect(errors).toEqual([]);
  return runProgram(initial(objects), principals, commands);
};

describe("key policy", () => {
  it("default deny, explicit deny wins, admin implies every action, wildcards stay inside the account", () => {
    const k = key();
    expect(allowed(k, principals[1], "decrypt").ok).toBe(false);
    expect(allowed(k, principals[1], "encrypt").ok).toBe(true);
    expect(allowed(k, principals[2], "decrypt").ok).toBe(true);
    expect(allowed(k, principals[3], "decrypt").ok).toBe(false);
    expect(allowed(k, principals[3], "decrypt").why).toMatch(/denies/);
    expect(allowed(k, principals[5], "decrypt").ok).toBe(false);
    expect(allowed(k, principals[5], "decrypt").why).toMatch(/another account/);
    expect(allowed(k, principals[0], "rotate").ok).toBe(true);
    const partner = allowed(k, principals[4], "decrypt");
    expect(partner.ok).toBe(false);
    expect(partner.why).toMatch(/another account/);
    k.policy.push({ principal: "partner", actions: ["decrypt"], effect: "allow" });
    expect(allowed(k, principals[4], "decrypt").ok).toBe(true);
  });
});

describe("envelope protocol", () => {
  it("the service refuses to encrypt a large object directly and seals a small one", () => {
    const s = run("encrypt big with key k as app\nencrypt small with key k as app\nstore small\ndecrypt small as reader\ndecrypt small as app");
    expect(s.trace.map((t) => t.ok)).toEqual([false, true, true, true, false]);
    expect(s.trace[0].detail).toMatch(/at most 4 KB/);
    expect(s.objects[1].sealedBy).toEqual({ kind: "service", keyId: "k", version: 1 });
  });

  it("a data key seals locally; the wrapped copy stored beside the data opens it later for an allowed principal", () => {
    const s = run("datakey k as app -> dk\nencrypt big with dk\nstore big with dk\nforget dk\ndecrypt big with dk\nunwrap big as reader -> dk2\ndecrypt big with dk2\nunwrap big as app -> dk3");
    expect(s.trace.map((t) => t.ok)).toEqual([true, true, true, true, false, true, true, false]);
    expect(s.memory.dataKeys).toEqual({ dk2: { keyId: "k", version: 1, id: "dk#1" } });
    expect(s.objects[0].storedWrapped).toEqual({ keyId: "k", version: 1, dataKeyName: "dk", dataKeyId: "dk#1" });
    expect(s.trace[4].detail).toMatch(/only its wrapped copy/);
  });

  it("storing plaintext is refused, storing sealed data without its wrapped key is allowed but flagged", () => {
    const s = run("store big\ndatakey k as app -> dk\nencrypt big with dk\nstore big\nunwrap big as reader -> x");
    expect(s.trace[0].ok).toBe(false);
    expect(s.trace[3].ok).toBe(true);
    expect(s.trace[3].detail).toMatch(/nobody can open it later/);
    expect(s.trace[4].ok).toBe(false);
  });

  it("rotation adds a version; old ciphertext still unwraps and new data keys use the new version", () => {
    const s = run("datakey k as app -> dk\nencrypt big with dk\nstore big with dk\nforget dk\nrotate k as app\nrotate k as admin\nunwrap big as reader -> old\ndecrypt big with old\ndatakey k as app -> fresh");
    expect(s.trace[4].ok).toBe(false);
    expect(s.trace[5].ok).toBe(true);
    expect(s.keys[0].versions).toBe(2);
    expect(s.trace[6].detail).toMatch(/v1 \(an older version/);
    expect(s.trace[7].ok).toBe(true);
    expect(s.memory.dataKeys.fresh).toEqual({ keyId: "k", version: 2, id: "dk#2" });
  });

  it("a wrong data key cannot open an object, and only an administrator may change the policy", () => {
    const s = run("datakey k as app -> a\ndatakey k as app -> b\nencrypt big with a\ndecrypt big with b\nallow partner decrypt on k as app\nallow partner decrypt on k as admin\nstore big with a\nunwrap big as partner -> p");
    expect(s.trace[3].ok).toBe(false);
    expect(s.trace[3].detail).toMatch(/not the key that sealed/);
    expect(s.trace[4].ok).toBe(false);
    expect(s.trace[5].ok).toBe(true);
    expect(s.trace[7].ok).toBe(true);
  });

  it("the parser reports unreadable lines and unknown actions with their line numbers", () => {
    const { commands, errors } = parseProgram("# comment\n\ndatakey k as app -> dk\nencrypt big using dk\nallow x fly on k as admin");
    expect(commands).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
    expect(errors[1].message).toMatch(/unknown action fly/);
  });
});

describe("envelope encryption lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and passes with its reference program", () => {
    for (const e of CRYPTO_EXERCISES) {
      const start = parseProgram(e.start);
      expect(start.errors, e.id).toEqual([]);
      expect(e.checks(runProgram(e.initial, e.principals, start.commands)).every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const sol = parseProgram(e.solution);
      expect(sol.errors, e.id).toEqual([]);
      const checks = e.checks(runProgram(e.initial, e.principals, sol.commands));
      expect(checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`), e.id).toEqual([]);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("the writer-only exercise fails when the app is widened to decrypt, even if everything else is right", () => {
    const e = CRYPTO_EXERCISES.find((x) => x.id === "crypto-06-separation")!;
    const widened = parseProgram(`allow orders-app decrypt on orders-key as key-admin\n${e.solution}`);
    const checks = e.checks(runProgram(e.initial, e.principals, widened.commands));
    // The widened app's unwrap now succeeds, so a plaintext key is also left behind.
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual(["no-widen", "app-refused", "forgotten"]);
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of CRYPTO_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("crypto-01-envelope", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["crypto-01-envelope"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["crypto-01-envelope"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(CRYPTO_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "KMS", "CloudHSM", "CMK", "GenerateDataKey"]) expect(text, word).not.toContain(word);
  });
});
