import type { CheckResult } from "../../domain/types";
import { DIRECT_LIMIT_KB, failedLines, okLines, type CryptoState, type Principal } from "../../engine/crypto/envelope";

/**
 * Envelope-encryption exercises. Each starts from a key service state (keys
 * with policies, principals, objects) and a program that fails in an
 * instructive way; the learner edits the program until every check passes.
 * `solution` is the reference the tests run; never shown.
 */
export interface CryptoExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  initial: Omit<CryptoState, "trace">;
  principals: Principal[];
  start: string;
  hints: string[];
  checks: (state: CryptoState) => CheckResult[];
  solution: string;
}

const ACCOUNT = "acct-orders";
const admin = (): Principal => ({ id: "key-admin", account: ACCOUNT });
const app = (): Principal => ({ id: "orders-app", account: ACCOUNT });
const analyst = (): Principal => ({ id: "analyst", account: ACCOUNT });
const partner = (): Principal => ({ id: "partner-etl", account: "acct-partner" });

const ordersKey = (over: Partial<CryptoState["keys"][number]> = {}): CryptoState["keys"][number] => ({
  id: "orders-key",
  account: ACCOUNT,
  versions: 1,
  rotationEnabled: false,
  policy: [
    { principal: "key-admin", actions: ["admin"], effect: "allow" },
    { principal: "orders-app", actions: ["encrypt", "generate-data-key"], effect: "allow" },
    { principal: "analyst", actions: ["decrypt"], effect: "allow" },
  ],
  ...over,
});

const emptyMemory = () => ({ dataKeys: {}, wrapped: {} });
const plaintext = (name: string, sizeKb: number): CryptoState["objects"][number] => ({ name, sizeKb, state: "plaintext", stored: false });
const storedSealed = (name: string, sizeKb: number, dataKeyName: string, version = 1): CryptoState["objects"][number] => ({
  name,
  sizeKb,
  state: "sealed",
  sealedBy: { kind: "data-key", keyId: "orders-key", version, dataKeyName, dataKeyId: `${dataKeyName}#stored` },
  storedWrapped: { keyId: "orders-key", version, dataKeyName, dataKeyId: `${dataKeyName}#stored` },
  stored: true,
});

const check = (id: string, label: string, passed: boolean, detail?: string): CheckResult => ({ id, label, passed, detail });

export const CRYPTO_EXERCISES: CryptoExercise[] = [
  {
    id: "crypto-01-envelope",
    title: "A big file does not fit through the key service",
    brief: `The orders archive is 512,000 KB. The starting program asks the key service to encrypt it directly, and the service refuses anything over ${DIRECT_LIMIT_KB} KB. Seal the archive with a data key instead, store it with the wrapped key beside it, and leave no plaintext key in memory.`,
    teaches: "Envelope encryption: the key service hands out a data key in two forms, plaintext for local use and wrapped (encrypted by the service key) for storage. The data never crosses to the service; only the small data key does. The wrapped copy travels with the data, the plaintext copy is forgotten as soon as the sealing is done.",
    initial: { keys: [ordersKey()], objects: [plaintext("orders-archive", 512000)], memory: emptyMemory() },
    principals: [admin(), app(), analyst()],
    start: "encrypt orders-archive with key orders-key as orders-app\nstore orders-archive",
    hints: ["The trace says why the first line failed: the service encrypts at most 4 KB directly. A data key seals any size locally.", "datakey orders-key as orders-app -> dk1 gives you a plaintext dk1 and a wrapped dk1. Seal with the plaintext, store with the wrapped.", "datakey orders-key as orders-app -> dk1 / encrypt orders-archive with dk1 / store orders-archive with dk1 / forget dk1"],
    checks: (s) => {
      const o = s.objects.find((x) => x.name === "orders-archive")!;
      return [
        check("sealed", "The archive is sealed with a data key, locally", o.state === "sealed" && o.sealedBy?.kind === "data-key", o.state !== "sealed" ? "still plaintext" : o.sealedBy?.kind === "service" ? "sealed by the service" : undefined),
        check("stored", "The archive is stored with its wrapped data key beside it", o.stored && Boolean(o.storedWrapped), o.stored ? (o.storedWrapped ? undefined : "stored without the wrapped key: nobody can open it later") : "not stored"),
        check("forgotten", "No plaintext data key is left in memory", Object.keys(s.memory.dataKeys).length === 0, Object.keys(s.memory.dataKeys).length ? `still in memory: ${Object.keys(s.memory.dataKeys).join(", ")}` : undefined),
        check("no-service", "The service never saw the archive", okLines(s, "encrypt orders-archive with key").length === 0),
      ];
    },
    solution: "datakey orders-key as orders-app -> dk1\nencrypt orders-archive with dk1\nstore orders-archive with dk1\nforget dk1",
  },
  {
    id: "crypto-02-direct",
    title: "A small secret can go straight to the service",
    brief: "A 1 KB database password needs sealing before it is stored. The starting program generates a data key for it, which works but leaves a data key to manage for one kilobyte. Seal it directly in the service, store it, and show the analyst can open it through the service.",
    teaches: "Direct encryption suits small values: no data key to store, no plaintext key in memory, every decrypt is a service call the key policy checks. Envelope encryption suits everything else. The size limit is what forces the choice.",
    initial: { keys: [ordersKey()], objects: [plaintext("db-password", 1)], memory: emptyMemory() },
    principals: [admin(), app(), analyst()],
    start: "datakey orders-key as orders-app -> dk1\nencrypt db-password with dk1\nstore db-password with dk1\nforget dk1\nunwrap db-password as analyst -> dk2\ndecrypt db-password with dk2",
    hints: ["encrypt <object> with key <key> as <principal> asks the service to seal the object itself. It fits: 1 KB is under the limit.", "A service-sealed object opens with decrypt <object> as <principal>; no data key is involved.", "encrypt db-password with key orders-key as orders-app / store db-password / decrypt db-password as analyst"],
    checks: (s) => {
      const o = s.objects.find((x) => x.name === "db-password")!;
      return [
        check("sealed", "The password is sealed by the service", o.state === "sealed" && o.sealedBy?.kind === "service", o.state !== "sealed" ? "still plaintext" : o.sealedBy?.kind === "data-key" ? "sealed with a data key" : undefined),
        check("stored", "The sealed password is stored", o.stored, o.stored ? undefined : "not stored"),
        check("opened", "The analyst opened it through the service", okLines(s, "decrypt db-password as analyst").length > 0),
        check("no-datakey", "No data key was generated for one kilobyte", okLines(s, "datakey").length === 0, okLines(s, "datakey").length ? "a data key was generated" : undefined),
      ];
    },
    solution: "encrypt db-password with key orders-key as orders-app\nstore db-password\ndecrypt db-password as analyst",
  },
  {
    id: "crypto-03-unwrap",
    title: "Opening what a data key sealed",
    brief: "The orders archive is stored sealed, with its wrapped data key beside it. The analyst, who may decrypt with the key, asks the service to decrypt the archive and gets refused: the service never saw the archive. Open it the envelope way.",
    teaches: "Decrypting an envelope is the sealing in reverse: send the wrapped data key to the service, which checks the key policy and returns the plaintext data key; then open the data locally. The service decides who may read, without ever handling the data.",
    initial: { keys: [ordersKey()], objects: [storedSealed("orders-archive", 512000, "dk1")], memory: emptyMemory() },
    principals: [admin(), app(), analyst()],
    start: "decrypt orders-archive as analyst",
    hints: ["The trace says the archive was sealed with a data key; the service holds no copy of the data to decrypt.", "unwrap <object> as <principal> -> <name> sends the stored wrapped key to the service and puts the plaintext key in memory under <name>.", "unwrap orders-archive as analyst -> dk1 / decrypt orders-archive with dk1 / forget dk1"],
    checks: (s) => [
      check("unwrapped", "The analyst unwrapped the stored data key through the service", okLines(s, "unwrap orders-archive as analyst").length > 0),
      check("opened", "The archive was opened locally with that key", okLines(s, "decrypt orders-archive with").length > 0),
      check("forgotten", "No plaintext data key is left in memory", Object.keys(s.memory.dataKeys).length === 0, Object.keys(s.memory.dataKeys).length ? `still in memory: ${Object.keys(s.memory.dataKeys).join(", ")}` : undefined),
    ],
    solution: "unwrap orders-archive as analyst -> dk1\ndecrypt orders-archive with dk1\nforget dk1",
  },
  {
    id: "crypto-04-cross-account",
    title: "A partner in another account",
    brief: "partner-etl lives in account acct-partner and must read the stored orders archive. The key policy says nothing about it, so the unwrap is refused. Grant exactly what the partner needs, as the key administrator, and open the archive as the partner.",
    teaches: "A key policy is the authority for who may use a key, and a principal from another account can only be reached by naming it there. Grant the one action the job needs: a partner that reads needs decrypt, not generate-data-key and never admin.",
    initial: { keys: [ordersKey()], objects: [storedSealed("orders-archive", 512000, "dk1")], memory: emptyMemory() },
    principals: [admin(), app(), analyst(), partner()],
    start: "unwrap orders-archive as partner-etl -> dk1\ndecrypt orders-archive with dk1",
    hints: ["The trace names the problem: partner-etl is in another account and nothing in the key policy names it.", "allow <principal> <actions> on <key> as <admin> adds a rule; only key-admin may change the policy.", "allow partner-etl decrypt on orders-key as key-admin / unwrap orders-archive as partner-etl -> dk1 / decrypt orders-archive with dk1 / forget dk1"],
    checks: (s) => {
      const k = s.keys.find((x) => x.id === "orders-key")!;
      const partnerRules = k.policy.filter((r) => /partner/.test(r.principal) && r.effect === "allow");
      const extra = partnerRules.flatMap((r) => r.actions).filter((a) => a !== "decrypt");
      return [
        check("granted", "The key policy names the partner", partnerRules.length > 0, partnerRules.length ? undefined : "no rule for partner-etl"),
        check("least", "The partner got decrypt and nothing more", partnerRules.length > 0 && extra.length === 0, extra.length ? `also granted: ${[...new Set(extra)].join(", ")}` : undefined),
        check("unwrapped", "The partner unwrapped the data key", okLines(s, "unwrap orders-archive as partner-etl").length > 0),
        check("opened", "The partner opened the archive locally", okLines(s, "decrypt orders-archive with").length > 0),
      ];
    },
    solution: "allow partner-etl decrypt on orders-key as key-admin\nunwrap orders-archive as partner-etl -> dk1\ndecrypt orders-archive with dk1\nforget dk1",
  },
  {
    id: "crypto-05-rotation",
    title: "Rotating the key without re-encrypting the world",
    brief: "Policy says the key material must change this quarter. Rotate the key as the administrator, then prove that the archive sealed under the old material still opens, and that a fresh data key uses the new version.",
    teaches: "Rotation gives the key a new version for everything sealed from now on; the old versions stay in the service for decryption only. Nothing already stored needs re-encrypting, because each wrapped data key records which version sealed it.",
    initial: { keys: [ordersKey()], objects: [storedSealed("orders-archive", 512000, "dk1"), plaintext("orders-archive-q4", 256000)], memory: emptyMemory() },
    principals: [admin(), app(), analyst()],
    start: "rotate orders-key as orders-app\nunwrap orders-archive as analyst -> old\ndecrypt orders-archive with old",
    hints: ["orders-app may encrypt and generate data keys, not rotate. The administrator rotates.", "After the rotation the unwrap trace says which version opened the archive; a new datakey line shows the version a fresh key gets.", "rotate orders-key as key-admin / unwrap orders-archive as analyst -> old / decrypt orders-archive with old / forget old / datakey orders-key as orders-app -> fresh / encrypt orders-archive-q4 with fresh / store orders-archive-q4 with fresh / forget fresh"],
    checks: (s) => {
      const k = s.keys.find((x) => x.id === "orders-key")!;
      const q4 = s.objects.find((x) => x.name === "orders-archive-q4")!;
      const oldOpened = okLines(s, "unwrap orders-archive as").some((t) => /older version/.test(t.detail)) && okLines(s, "decrypt orders-archive with").length > 0;
      return [
        check("rotated", "The key was rotated by its administrator", k.versions >= 2, k.versions >= 2 ? `now v${k.versions}` : "still v1"),
        check("old-opens", "The archive sealed under v1 still opens after the rotation", oldOpened, oldOpened ? undefined : "unwrap and decrypt it after the rotate line"),
        check("new-version", "The Q4 archive is sealed and stored under the new version", q4.state === "sealed" && q4.stored && q4.storedWrapped?.version === k.versions && k.versions >= 2, q4.state !== "sealed" ? "not sealed" : !q4.stored ? "not stored with its wrapped key" : q4.storedWrapped?.version !== k.versions ? `sealed under v${q4.sealedBy?.version}` : undefined),
        check("forgotten", "No plaintext data key is left in memory", Object.keys(s.memory.dataKeys).length === 0),
      ];
    },
    solution: "rotate orders-key as key-admin\nunwrap orders-archive as analyst -> old\ndecrypt orders-archive with old\nforget old\ndatakey orders-key as orders-app -> fresh\nencrypt orders-archive-q4 with fresh\nstore orders-archive-q4 with fresh\nforget fresh",
  },
  {
    id: "crypto-06-separation",
    title: "Writers that cannot read",
    brief: "The orders app only ever writes archives; reading is the analyst's job. Seal and store a new archive as the app, show in the trace that the app cannot unwrap it afterwards, and that the analyst can.",
    teaches: "Encrypt and decrypt are separate permissions on a key. A writer that holds generate-data-key and encrypt can seal data it may never read again, which is the point: a stolen writer credential exposes nothing already stored.",
    initial: { keys: [ordersKey()], objects: [plaintext("orders-archive-q4", 256000)], memory: emptyMemory() },
    principals: [admin(), app(), analyst()],
    start: "allow orders-app decrypt on orders-key as key-admin\ndatakey orders-key as orders-app -> dk1\nencrypt orders-archive-q4 with dk1\nstore orders-archive-q4 with dk1\nforget dk1\nunwrap orders-archive-q4 as orders-app -> dk2\ndecrypt orders-archive-q4 with dk2",
    hints: ["The first line widens the app to decrypt. Remove it: the app does not need to read.", "A refused unwrap as orders-app is what the check wants to see in the trace; failed lines are evidence too.", "datakey orders-key as orders-app -> dk1 / encrypt orders-archive-q4 with dk1 / store orders-archive-q4 with dk1 / forget dk1 / unwrap orders-archive-q4 as orders-app -> dk2 / unwrap orders-archive-q4 as analyst -> dk3 / decrypt orders-archive-q4 with dk3 / forget dk3"],
    checks: (s) => {
      const k = s.keys.find((x) => x.id === "orders-key")!;
      const o = s.objects.find((x) => x.name === "orders-archive-q4")!;
      const appCanDecrypt = k.policy.some((r) => r.effect === "allow" && r.principal === "orders-app" && (r.actions.includes("decrypt") || r.actions.includes("admin")));
      return [
        check("stored", "The archive is sealed with a data key and stored with the wrapped key", o.state === "sealed" && o.sealedBy?.kind === "data-key" && o.stored && Boolean(o.storedWrapped)),
        check("no-widen", "The app was not granted decrypt", !appCanDecrypt, appCanDecrypt ? "the policy now lets orders-app decrypt" : undefined),
        check("app-refused", "The trace shows the app refused an unwrap", failedLines(s, "unwrap orders-archive-q4 as orders-app").length > 0, "try the unwrap as orders-app and let it fail"),
        check("analyst-opens", "The analyst unwrapped and opened the archive", okLines(s, "unwrap orders-archive-q4 as analyst").length > 0 && okLines(s, "decrypt orders-archive-q4 with").length > 0),
        check("forgotten", "No plaintext data key is left in memory", Object.keys(s.memory.dataKeys).length === 0),
      ];
    },
    solution: "datakey orders-key as orders-app -> dk1\nencrypt orders-archive-q4 with dk1\nstore orders-archive-q4 with dk1\nforget dk1\nunwrap orders-archive-q4 as orders-app -> dk2\nunwrap orders-archive-q4 as analyst -> dk3\ndecrypt orders-archive-q4 with dk3\nforget dk3",
  },
];

export const CRYPTO_EXERCISE_BY_ID = new Map(CRYPTO_EXERCISES.map((e) => [e.id, e]));
