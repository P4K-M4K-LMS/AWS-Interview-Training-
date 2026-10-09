/**
 * A small, predictable value formatter for the JavaScript lab's console and
 * assertion messages, close to what browser devtools and Node print:
 * strings quoted inside structures, arrays and objects on one line, Maps and
 * Sets with their size, class instances prefixed with the class name,
 * functions as [Function: name], cycles as [Circular].
 */
export function inspect(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): string {
  if (typeof value === "string") return depth === 0 ? value : `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "function") {
    const src = Function.prototype.toString.call(value);
    if (/^class[\s{]/.test(src)) return `[class ${value.name || "(anonymous)"}]`;
    return value.name ? `[Function: ${value.name}]` : "[Function (anonymous)]";
  }
  const obj = value as object;
  if (seen.has(obj)) return "[Circular]";
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (value instanceof Promise) return "Promise {}";
  if (depth > 3) return Array.isArray(value) ? "[Array]" : "[Object]";
  seen.add(obj);
  try {
    const inner = (v: unknown) => inspect(v, depth + 1, seen);
    if (Array.isArray(value)) return value.length === 0 ? "[]" : `[ ${value.map(inner).join(", ")} ]`;
    if (value instanceof Map) return value.size === 0 ? `Map(0) {}` : `Map(${value.size}) { ${[...value].map(([k, v]) => `${inner(k)} => ${inner(v)}`).join(", ")} }`;
    if (value instanceof Set) return value.size === 0 ? `Set(0) {}` : `Set(${value.size}) { ${[...value].map(inner).join(", ")} }`;
    const proto = Object.getPrototypeOf(obj);
    const prefix = proto === null ? "[Object: null prototype] " : proto !== Object.prototype && proto?.constructor?.name ? `${proto.constructor.name} ` : "";
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${prefix}{}`;
    const body = keys.map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`}: ${inner((obj as Record<string, unknown>)[k])}`).join(", ");
    return `${prefix}{ ${body} }`;
  } finally {
    seen.delete(obj);
  }
}

/** Structural equality for assertions: primitives by value (NaN equals NaN), arrays, plain objects and class instances by own keys and prototype, Maps, Sets, Dates. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return a.getTime() === (b as Date).getTime();
  if (a instanceof Map) {
    const m = b as Map<unknown, unknown>;
    if (a.size !== m.size) return false;
    for (const [k, v] of a) if (!m.has(k) || !deepEqual(v, m.get(k))) return false;
    return true;
  }
  if (a instanceof Set) {
    const s = b as Set<unknown>;
    if (a.size !== s.size) return false;
    const rest = [...s];
    for (const v of a) {
      const i = rest.findIndex((w) => deepEqual(v, w));
      if (i < 0) return false;
      rest.splice(i, 1);
    }
    return true;
  }
  if (Array.isArray(a)) {
    const arr = b as unknown[];
    return a.length === arr.length && a.every((v, i) => deepEqual(v, arr[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
