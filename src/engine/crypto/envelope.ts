/**
 * Envelope encryption on a simulated key service. Nothing here is real
 * cryptography: a "ciphertext" is a tag that records which key material
 * sealed it, so the lessons are about the protocol, not the maths. The key
 * service holds keys with versions and a policy; it hands out data keys
 * (a plaintext copy for local use and a wrapped copy to store beside the
 * data), unwraps them later for principals the policy allows, rotates key
 * material without breaking old ciphertext, and refuses to encrypt large
 * objects directly. A program of one-line commands runs step by step and
 * every step is traced; the checks read the final state and the trace.
 */
export type KeyAction = "encrypt" | "decrypt" | "generate-data-key" | "rotate" | "admin";

export interface KeyPolicyRule {
  principal: string; // glob
  actions: KeyAction[];
  effect: "allow" | "deny";
}

export interface ServiceKey {
  id: string;
  account: string;
  versions: number; // current version number; all versions remain usable for decrypt
  rotationEnabled: boolean;
  policy: KeyPolicyRule[];
}

export interface Principal {
  id: string;
  account: string;
}

export interface DataObject {
  name: string;
  sizeKb: number;
  /** Plaintext marker until encrypted locally or by the service. */
  state: "plaintext" | "sealed";
  sealedBy?: { kind: "data-key"; keyId: string; version: number; dataKeyName: string; dataKeyId: string } | { kind: "service"; keyId: string; version: number };
  /** The wrapped data key stored beside the object, if any. */
  storedWrapped?: { keyId: string; version: number; dataKeyName: string; dataKeyId: string };
  stored: boolean;
}

/** A data key: which service key and version wrapped it, and an identity so two keys from the same version stay distinct. */
export interface DataKeyRef {
  keyId: string;
  version: number;
  id: string;
}

export interface Memory {
  /** Plaintext data keys currently held by the application. */
  dataKeys: Record<string, DataKeyRef>;
  /** Wrapped data keys the application holds (safe to persist). */
  wrapped: Record<string, DataKeyRef>;
}

export interface CryptoState {
  keys: ServiceKey[];
  objects: DataObject[];
  memory: Memory;
  trace: TraceLine[];
}

export interface TraceLine {
  line: number;
  command: string;
  ok: boolean;
  detail: string;
}

export const DIRECT_LIMIT_KB = 4;

/* ---------------- grammar ---------------- */

export interface ParseError {
  line: number;
  message: string;
}

export type Command =
  | { kind: "datakey"; key: string; principal: string; name: string }
  | { kind: "encrypt-local"; object: string; name: string }
  | { kind: "encrypt-service"; object: string; key: string; principal: string }
  | { kind: "store"; object: string; wrappedName?: string }
  | { kind: "forget"; name: string }
  | { kind: "unwrap"; object: string; principal: string; name: string }
  | { kind: "decrypt-local"; object: string; name: string }
  | { kind: "decrypt-service"; object: string; principal: string }
  | { kind: "rotate"; key: string; principal: string }
  | { kind: "allow"; principal: string; actions: KeyAction[]; key: string; admin: string };

const ACTIONS: KeyAction[] = ["encrypt", "decrypt", "generate-data-key", "rotate", "admin"];

/**
 * One command per line:
 *   datakey orders-key as app -> dk1          ask the service for a data key (plaintext dk1 in memory, wrapped dk1 too)
 *   encrypt orders with dk1                   seal the object locally with the plaintext data key
 *   encrypt orders with key orders-key as app seal a small object directly in the service (4 KB limit)
 *   store orders with dk1                     persist the sealed object with the wrapped copy of dk1 beside it
 *   forget dk1                                drop the plaintext data key from memory
 *   unwrap orders as analyst -> dk2           ask the service to unwrap the stored data key for a principal
 *   decrypt orders with dk2                   open the object locally with that plaintext key
 *   decrypt orders as analyst                 open a service-sealed object through the service
 *   rotate orders-key as admin                new key material; old versions still decrypt
 *   allow partner-* decrypt,generate-data-key on orders-key as admin
 */
export function parseProgram(text: string): { commands: Array<Command & { line: number }>; errors: ParseError[] } {
  const commands: Array<Command & { line: number }> = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    let m: RegExpExecArray | null;
    if ((m = /^datakey\s+(\S+)\s+as\s+(\S+)\s*->\s*(\S+)$/i.exec(s))) commands.push({ kind: "datakey", key: m[1], principal: m[2], name: m[3], line });
    else if ((m = /^encrypt\s+(\S+)\s+with\s+key\s+(\S+)\s+as\s+(\S+)$/i.exec(s))) commands.push({ kind: "encrypt-service", object: m[1], key: m[2], principal: m[3], line });
    else if ((m = /^encrypt\s+(\S+)\s+with\s+(\S+)$/i.exec(s))) commands.push({ kind: "encrypt-local", object: m[1], name: m[2], line });
    else if ((m = /^store\s+(\S+)(?:\s+with\s+(\S+))?$/i.exec(s))) commands.push({ kind: "store", object: m[1], wrappedName: m[2], line });
    else if ((m = /^forget\s+(\S+)$/i.exec(s))) commands.push({ kind: "forget", name: m[1], line });
    else if ((m = /^unwrap\s+(\S+)\s+as\s+(\S+)\s*->\s*(\S+)$/i.exec(s))) commands.push({ kind: "unwrap", object: m[1], principal: m[2], name: m[3], line });
    else if ((m = /^decrypt\s+(\S+)\s+with\s+(\S+)$/i.exec(s))) commands.push({ kind: "decrypt-local", object: m[1], name: m[2], line });
    else if ((m = /^decrypt\s+(\S+)\s+as\s+(\S+)$/i.exec(s))) commands.push({ kind: "decrypt-service", object: m[1], principal: m[2], line });
    else if ((m = /^rotate\s+(\S+)\s+as\s+(\S+)$/i.exec(s))) commands.push({ kind: "rotate", key: m[1], principal: m[2], line });
    else if ((m = /^allow\s+(\S+)\s+(\S+)\s+on\s+(\S+)\s+as\s+(\S+)$/i.exec(s))) {
      const actions = m[2].split(",").map((a) => a.trim()) as KeyAction[];
      const bad = actions.filter((a) => !ACTIONS.includes(a));
      if (bad.length) errors.push({ line, message: `unknown action ${bad.join(", ")}; use ${ACTIONS.join(", ")}` });
      else commands.push({ kind: "allow", principal: m[1], actions, key: m[3], admin: m[4], line });
    } else errors.push({ line, message: `cannot read "${s}"; see the command list` });
  });
  return { commands, errors };
}

/* ---------------- execution ---------------- */

function globMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const re = new RegExp(`^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i");
  return re.test(value);
}

export function allowed(key: ServiceKey, principal: Principal, action: KeyAction): { ok: boolean; why: string } {
  // A wildcard rule reaches only principals of the key's own account; another
  // account's principal has to be named in the key policy.
  const matching = key.policy.filter((r) => globMatch(r.principal, principal.id) && (r.principal.includes("*") ? principal.account === key.account : true) && (r.actions.includes(action) || r.actions.includes("admin")));
  if (matching.some((r) => r.effect === "deny")) return { ok: false, why: `the key policy denies ${action} to ${principal.id}` };
  if (!matching.some((r) => r.effect === "allow")) {
    const crossAccount = principal.account !== key.account;
    return { ok: false, why: crossAccount ? `${principal.id} is in account ${principal.account}, the key in ${key.account}: a principal from another account needs an explicit allow by name in the key policy` : `nothing in the policy of ${key.id} allows ${principal.id} to ${action}` };
  }
  return { ok: true, why: `the key policy allows ${principal.id} to ${action}` };
}

export function runProgram(initial: Omit<CryptoState, "trace">, principals: Principal[], commands: Array<Command & { line: number }>): CryptoState {
  const state: CryptoState = JSON.parse(JSON.stringify({ ...initial, trace: [] }));
  const key = (id: string) => state.keys.find((k) => k.id === id);
  const obj = (name: string) => state.objects.find((o) => o.name === name);
  const who = (id: string) => principals.find((p) => p.id === id);
  const push = (c: Command & { line: number }, ok: boolean, detail: string) => state.trace.push({ line: c.line, command: describe(c), ok, detail });
  let issued = Object.keys(state.memory.dataKeys).length + Object.keys(state.memory.wrapped).length + state.objects.filter((o) => o.storedWrapped).length;

  for (const c of commands) {
    switch (c.kind) {
      case "datakey": {
        const k = key(c.key);
        const p = who(c.principal);
        if (!k) {
          push(c, false, `no key named ${c.key}`);
          break;
        }
        if (!p) {
          push(c, false, `no principal named ${c.principal}`);
          break;
        }
        const a = allowed(k, p, "generate-data-key");
        if (!a.ok) {
          push(c, false, a.why);
          break;
        }
        const ref: DataKeyRef = { keyId: k.id, version: k.versions, id: `dk#${++issued}` };
        state.memory.dataKeys[c.name] = ref;
        state.memory.wrapped[c.name] = { ...ref };
        push(c, true, `${a.why}; plaintext data key ${c.name} is in memory and a wrapped copy (sealed by ${k.id} v${k.versions}) came with it`);
        break;
      }
      case "encrypt-local": {
        const o = obj(c.object);
        const dk = state.memory.dataKeys[c.name];
        if (!o) {
          push(c, false, `no object named ${c.object}`);
          break;
        }
        if (!dk) {
          push(c, false, `no plaintext data key named ${c.name} in memory${state.memory.wrapped[c.name] ? " (only its wrapped copy; unwrap it first)" : ""}`);
          break;
        }
        o.state = "sealed";
        o.sealedBy = { kind: "data-key", keyId: dk.keyId, version: dk.version, dataKeyName: c.name, dataKeyId: dk.id };
        push(c, true, `${c.object} (${o.sizeKb} KB) sealed locally with data key ${c.name}; the service never saw the data`);
        break;
      }
      case "encrypt-service": {
        const o = obj(c.object);
        const k = key(c.key);
        const p = who(c.principal);
        if (!o || !k || !p) {
          push(c, false, !o ? `no object named ${c.object}` : !k ? `no key named ${c.key}` : `no principal named ${c.principal}`);
          break;
        }
        if (o.sizeKb > DIRECT_LIMIT_KB) {
          push(c, false, `${c.object} is ${o.sizeKb} KB; the service encrypts at most ${DIRECT_LIMIT_KB} KB directly. Use a data key.`);
          break;
        }
        const a = allowed(k, p, "encrypt");
        if (!a.ok) {
          push(c, false, a.why);
          break;
        }
        o.state = "sealed";
        o.sealedBy = { kind: "service", keyId: k.id, version: k.versions };
        push(c, true, `${c.object} sealed by the service with ${k.id} v${k.versions}; the data crossed to the service`);
        break;
      }
      case "store": {
        const o = obj(c.object);
        if (!o) {
          push(c, false, `no object named ${c.object}`);
          break;
        }
        if (o.state !== "sealed") {
          push(c, false, `${c.object} is still plaintext; storing it would persist readable data`);
          break;
        }
        if (c.wrappedName) {
          const w = state.memory.wrapped[c.wrappedName];
          if (!w) {
            push(c, false, `no wrapped data key named ${c.wrappedName}`);
            break;
          }
          o.storedWrapped = { keyId: w.keyId, version: w.version, dataKeyName: c.wrappedName, dataKeyId: w.id };
        }
        o.stored = true;
        push(c, true, `${c.object} stored sealed${o.storedWrapped ? ` with the wrapped data key ${o.storedWrapped.dataKeyName} beside it` : o.sealedBy?.kind === "data-key" ? " but without its wrapped data key: nobody can open it later" : ""}`);
        break;
      }
      case "forget": {
        if (!state.memory.dataKeys[c.name]) {
          push(c, false, `no plaintext data key named ${c.name} in memory`);
          break;
        }
        delete state.memory.dataKeys[c.name];
        push(c, true, `plaintext data key ${c.name} dropped from memory; only the wrapped copy remains`);
        break;
      }
      case "unwrap": {
        const o = obj(c.object);
        const p = who(c.principal);
        if (!o || !p) {
          push(c, false, !o ? `no object named ${c.object}` : `no principal named ${c.principal}`);
          break;
        }
        if (!o.stored || !o.storedWrapped) {
          push(c, false, `${c.object} has no wrapped data key stored beside it`);
          break;
        }
        const k = key(o.storedWrapped.keyId);
        if (!k) {
          push(c, false, `the key ${o.storedWrapped.keyId} no longer exists`);
          break;
        }
        const a = allowed(k, p, "decrypt");
        if (!a.ok) {
          push(c, false, a.why);
          break;
        }
        state.memory.dataKeys[c.name] = { keyId: k.id, version: o.storedWrapped.version, id: o.storedWrapped.dataKeyId };
        push(c, true, `${a.why}; the service unwrapped the data key with ${k.id} v${o.storedWrapped.version}${o.storedWrapped.version < k.versions ? " (an older version, still kept for decryption)" : ""} into ${c.name}`);
        break;
      }
      case "decrypt-local": {
        const o = obj(c.object);
        const dk = state.memory.dataKeys[c.name];
        if (!o || !dk) {
          push(c, false, !o ? `no object named ${c.object}` : `no plaintext data key named ${c.name} in memory${state.memory.wrapped[c.name] ? " (only its wrapped copy; unwrap it first)" : ""}`);
          break;
        }
        if (o.state !== "sealed" || o.sealedBy?.kind !== "data-key") {
          push(c, false, o.state !== "sealed" ? `${c.object} is not sealed` : `${c.object} was sealed by the service, not with a data key`);
          break;
        }
        if (o.sealedBy.dataKeyId !== dk.id) {
          push(c, false, `${c.name} is not the key that sealed ${c.object} (sealed with data key ${o.sealedBy.dataKeyName}, wrapped by ${o.sealedBy.keyId} v${o.sealedBy.version})`);
          break;
        }
        push(c, true, `${c.object} opened locally with ${c.name}`);
        break;
      }
      case "decrypt-service": {
        const o = obj(c.object);
        const p = who(c.principal);
        if (!o || !p) {
          push(c, false, !o ? `no object named ${c.object}` : `no principal named ${c.principal}`);
          break;
        }
        if (o.state !== "sealed" || o.sealedBy?.kind !== "service") {
          push(c, false, o.state !== "sealed" ? `${c.object} is not sealed` : `${c.object} was sealed with a data key; unwrap it and decrypt locally`);
          break;
        }
        const k = key(o.sealedBy.keyId);
        const a = k ? allowed(k, p, "decrypt") : { ok: false, why: "the key no longer exists" };
        if (!a.ok) {
          push(c, false, a.why);
          break;
        }
        push(c, true, `${a.why}; ${c.object} opened by the service`);
        break;
      }
      case "rotate": {
        const k = key(c.key);
        const p = who(c.principal);
        if (!k || !p) {
          push(c, false, !k ? `no key named ${c.key}` : `no principal named ${c.principal}`);
          break;
        }
        const a = allowed(k, p, "rotate");
        if (!a.ok) {
          push(c, false, a.why);
          break;
        }
        k.versions += 1;
        k.rotationEnabled = true;
        push(c, true, `${k.id} now encrypts with v${k.versions}; ${k.versions === 2 ? "v1 is" : `v1 to v${k.versions - 1} are`} kept so existing ciphertext still opens`);
        break;
      }
      case "allow": {
        const k = key(c.key);
        const p = who(c.admin);
        if (!k || !p) {
          push(c, false, !k ? `no key named ${c.key}` : `no principal named ${c.admin}`);
          break;
        }
        const a = allowed(k, p, "admin");
        if (!a.ok) {
          push(c, false, `only a key administrator can change the policy: ${a.why}`);
          break;
        }
        k.policy.push({ principal: c.principal, actions: c.actions, effect: "allow" });
        push(c, true, `policy of ${k.id} now allows ${c.principal} to ${c.actions.join(", ")}`);
        break;
      }
    }
  }
  return state;
}

export function describe(c: Command): string {
  switch (c.kind) {
    case "datakey":
      return `datakey ${c.key} as ${c.principal} -> ${c.name}`;
    case "encrypt-local":
      return `encrypt ${c.object} with ${c.name}`;
    case "encrypt-service":
      return `encrypt ${c.object} with key ${c.key} as ${c.principal}`;
    case "store":
      return `store ${c.object}${c.wrappedName ? ` with ${c.wrappedName}` : ""}`;
    case "forget":
      return `forget ${c.name}`;
    case "unwrap":
      return `unwrap ${c.object} as ${c.principal} -> ${c.name}`;
    case "decrypt-local":
      return `decrypt ${c.object} with ${c.name}`;
    case "decrypt-service":
      return `decrypt ${c.object} as ${c.principal}`;
    case "rotate":
      return `rotate ${c.key} as ${c.principal}`;
    case "allow":
      return `allow ${c.principal} ${c.actions.join(",")} on ${c.key} as ${c.admin}`;
  }
}

/** Trace lines that succeeded for a command whose text starts with `prefix`. */
export function okLines(state: CryptoState, prefix: string): TraceLine[] {
  return state.trace.filter((t) => t.ok && t.command.startsWith(prefix));
}
/** Trace lines that failed for a command whose text starts with `prefix`. */
export function failedLines(state: CryptoState, prefix: string): TraceLine[] {
  return state.trace.filter((t) => !t.ok && t.command.startsWith(prefix));
}
