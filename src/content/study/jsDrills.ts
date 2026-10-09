/**
 * JavaScript drills: one idea per drill, run in the lab's worker on the
 * browser's own JavaScript engine and checked by assertions. Script drills
 * run as the body of a strict async function, so the tests see the
 * program's top-level names; module drills are real ES modules split over
 * files. fetch reaches only the simulated API at https://api.fleet.example.
 * Every starter fails at least one test; the last hint is a complete
 * program; `solution` is the reference the tests run.
 *
 * Test helpers: assert, assertEqual (structural), assertThrows,
 * assertRejects, logs() (the program's console.log lines), fetchLog(),
 * sleep(ms), $source (the code, or the files in module drills), and
 * modules (each file's exports, module drills only). DOM drills add $, $$,
 * click, submit, type and resetDom; the testing drill adds suiteResults()
 * and runSuite(files, entry). The DOM, testing and server drills live in
 * jsDrillsMore.ts.
 */
import { MORE_JS_DRILLS } from "./jsDrillsMore";

export type JsDrillGroup = "Language" | "The DOM" | "Testing" | "Server";

export interface JsDrill {
  id: string;
  /** Shown as a heading over the drill tabs; Language when absent. */
  group?: JsDrillGroup;
  title: string;
  brief: string;
  teaches: string;
  /** Script drills: one program. */
  starter?: string;
  solution?: string;
  /** Module drills: files by name, and the file that runs first. */
  starterFiles?: Record<string, string>;
  solutionFiles?: Record<string, string>;
  entry?: string;
  /** Fixture page for DOM drills (script drills only). */
  dom?: string;
  /** The drill provides test(), expect() and mock() and runs the learner's tests after the program. */
  suite?: boolean;
  /** The drill provides the async datastore as db. */
  store?: boolean;
  /** The simulated process.env. */
  env?: Record<string, string>;
  tests: Array<{ id: string; label: string; code: string }>;
  hints: string[];
}

const SHIPMENTS = `const shipments = [
  { id: "S-100", destination: "Leeds", weightKg: 12, status: "delivered", driverId: "D-1" },
  { id: "S-101", destination: "Bristol", weightKg: 4.5, status: "in-transit", driverId: "D-2" },
  { id: "S-102", destination: "York", weightKg: 30, status: "pending", driverId: null },
  { id: "S-103", destination: "Hull", weightKg: 8, status: "in-transit", driverId: "D-1" },
  { id: "S-104", destination: "Bath", weightKg: 2, status: "cancelled", driverId: "D-3" },
];
`;

const LANGUAGE_DRILLS: JsDrill[] = [
  {
    id: "js-01-hoisting",
    title: "var, let, const and hoisting",
    brief: "makeCheckers() should return three functions, the first reporting 'north', the second 'south', the third 'east'. describe() should return 'Depot north'. tdzDemo() should show the temporal dead zone by returning the name of the error you get for reading a let variable before its declaration. The starter uses var everywhere, so all three checkers share one counter and the other two functions quietly see undefined.",
    teaches: "var is hoisted to the top of its function and initialised to undefined, so reading it early gives undefined instead of an error, and a var loop counter is one variable shared by every closure made in the loop. let and const are block-scoped: each loop iteration gets its own binding, and reading them before the declaration line throws a ReferenceError (the temporal dead zone).",
    starter: `const DEPOTS = ["north", "south", "east"];

function makeCheckers() {
  var checkers = [];
  for (var i = 0; i < DEPOTS.length; i++) {
    checkers.push(function () {
      return DEPOTS[i];
    });
  }
  return checkers;
}

function describe() {
  var text = "Depot " + label;
  var label = "north";
  return text;
}

function tdzDemo() {
  try {
    const before = depot;
    var depot = "north";
    return typeof before;
  } catch (e) {
    return e.name;
  }
}

console.log(makeCheckers().map((check) => check()));
`,
    solution: `const DEPOTS = ["north", "south", "east"];

function makeCheckers() {
  const checkers = [];
  for (let i = 0; i < DEPOTS.length; i++) {
    checkers.push(() => DEPOTS[i]);
  }
  return checkers;
}

function describe() {
  const label = "north";
  return "Depot " + label;
}

function tdzDemo() {
  try {
    const before = depot;
    let depot = "north";
    return typeof before;
  } catch (e) {
    return e.name;
  }
}

console.log(makeCheckers().map((check) => check()));
`,
    tests: [
      { id: "closures", label: "each checker keeps its own loop value", code: `assertEqual(makeCheckers().map((c) => c()), ["north", "south", "east"])` },
      { id: "describe", label: "describe() === 'Depot north'", code: `assertEqual(describe(), "Depot north")` },
      { id: "tdz", label: "tdzDemo() returns 'ReferenceError'", code: `assertEqual(tdzDemo(), "ReferenceError")` },
      { id: "novar", label: "no var left", code: `assert(!/\\bvar\\s/.test($source), "replace every var with let or const")` },
    ],
    hints: ["The log shows [ undefined, undefined, undefined ]: by the time the checkers run, the single var i is 3.", "for (let i = ...) gives each iteration its own i. Declare label before using it. In tdzDemo, var depot becomes let depot.", "Replace var with let in the loop and const elsewhere; move const label = 'north' above the line that uses it; change var depot to let depot."],
  },
  {
    id: "js-02-coercion",
    title: "Types, coercion and comparisons",
    brief: "isMissing(value) should be true only for null and undefined; 0, '' and false are real values. parseQuantity(input) should return a number for numbers and numeric strings (' 7 ' is 7) and null for everything else, including '', '12abc', true, null and []. shippingBand(weightKg) should return 'letter' up to 2 kg, 'parcel' up to 10, 'heavy' up to 30 and 'freight' above, and 'invalid' for anything that is not a positive number. The starter trusts == and Number().",
    teaches: "== converts its operands before comparing, with rules few people remember: null == false is false, but 0 == false and '' == false are true. === compares without conversion. Number() converts too eagerly: Number('') and Number([]) are 0 and Number(true) is 1. typeof tells you what you have before you trust it.",
    starter: `function isMissing(value) {
  return value == false;
}

function parseQuantity(input) {
  const n = Number(input);
  return isNaN(n) ? null : n;
}

function shippingBand(weightKg) {
  if (weightKg <= 2) return "letter";
  if (weightKg <= 10) return "parcel";
  return weightKg <= 30 ? "heavy" : "freight";
}
`,
    solution: `function isMissing(value) {
  return value === null || value === undefined;
}

function parseQuantity(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string" || input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function shippingBand(weightKg) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) return "invalid";
  switch (true) {
    case weightKg <= 2:
      return "letter";
    case weightKg <= 10:
      return "parcel";
    case weightKg <= 30:
      return "heavy";
    default:
      return "freight";
  }
}
`,
    tests: [
      { id: "missing", label: "isMissing: null and undefined only", code: `assertEqual([null, undefined, 0, "", false].map(isMissing), [true, true, false, false, false])` },
      { id: "numbers", label: "parseQuantity reads numbers and numeric strings", code: `assertEqual(["12", " 7 ", 3.5].map(parseQuantity), [12, 7, 3.5])` },
      { id: "traps", label: "parseQuantity refuses '', '12abc', true, null, [] and NaN", code: `assertEqual(["", "12abc", true, null, [], NaN].map(parseQuantity), [null, null, null, null, null, null])` },
      { id: "bands", label: "shippingBand at each boundary", code: `assertEqual([1, 2, 2.5, 10, 30, 31].map(shippingBand), ["letter", "letter", "parcel", "parcel", "heavy", "freight"])` },
      { id: "invalid", label: "shippingBand(0, -1, '5', NaN) are 'invalid'", code: `assertEqual([0, -1, "5", NaN].map(shippingBand), ["invalid", "invalid", "invalid", "invalid"])` },
    ],
    hints: ["Run it: isMissing(null) is false, because null == false is false. Compare with === against null and undefined.", "Check typeof first: numbers must be finite, strings must not be blank, everything else is null.", "isMissing: value === null || value === undefined. parseQuantity: typeof checks, then Number.isFinite. shippingBand: reject non-numbers and non-positive values first, then the bands."],
  },
  {
    id: "js-03-loops",
    title: "Loops: for...of, for...in and while",
    brief: "labels(parcels) should return ['1: S-100', '2: S-101', ...]; countByStatus(shipments) should return an object like { pending: 2, delivered: 1 }; firstHeavy(parcels, limitKg) should return the index of the first parcel heavier than the limit, or -1. The starter walks an array with for...in, increments counts that were never set, and lets its while loop run one step too far.",
    teaches: "for...of walks the values of an array (or any iterable); for...in walks an object's keys as strings, so on an array i + 1 is '01', not 1. A while loop needs its condition to stop before the end: i < length, not i <= length. Counting into an object needs a starting value for each key.",
    starter: `function labels(parcels) {
  const out = [];
  for (const i in parcels) {
    out.push(i + 1 + ": " + parcels[i].id);
  }
  return out;
}

function countByStatus(shipments) {
  const counts = {};
  for (const s of shipments) {
    counts[s.status]++;
  }
  return counts;
}

function firstHeavy(parcels, limitKg) {
  let i = 0;
  while (i <= parcels.length) {
    if (parcels[i].weightKg > limitKg) return i;
    i++;
  }
  return -1;
}
`,
    solution: `function labels(parcels) {
  const out = [];
  for (const [i, parcel] of parcels.entries()) {
    out.push(\`\${i + 1}: \${parcel.id}\`);
  }
  return out;
}

function countByStatus(shipments) {
  const counts = {};
  for (const s of shipments) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }
  return counts;
}

function firstHeavy(parcels, limitKg) {
  let i = 0;
  while (i < parcels.length) {
    if (parcels[i].weightKg > limitKg) return i;
    i++;
  }
  return -1;
}
`,
    tests: [
      { id: "labels", label: "labels are numbered from 1", code: `assertEqual(labels([{ id: "S-100" }, { id: "S-101" }]), ["1: S-100", "2: S-101"])` },
      { id: "counts", label: "countByStatus counts each status", code: `assertEqual(countByStatus([{ status: "pending" }, { status: "delivered" }, { status: "pending" }]), { pending: 2, delivered: 1 })` },
      { id: "found", label: "firstHeavy finds the heavy parcel", code: `assertEqual(firstHeavy([{ weightKg: 1 }, { weightKg: 40 }], 30), 1)` },
      { id: "none", label: "firstHeavy returns -1 when none is heavy", code: `assertEqual(firstHeavy([{ weightKg: 1 }], 30), -1)` },
    ],
    hints: ["labels gives '01: S-100': for...in hands you the index as the string '0'.", "for (const [i, parcel] of parcels.entries()) gives a number and the value. counts[key] = (counts[key] ?? 0) + 1. while (i < parcels.length).", "See the three fixes above; nothing else needs to change."],
  },
  {
    id: "js-04-parameters",
    title: "Function forms, default and rest parameters",
    brief: "buildUrl(path, params) should return the API address with an encoded query string, and no '?' when there are no parameters. maxWeight(...weights) should take any number of arguments and return the largest, or null with none. formatDriver(driver, options) should work without options and be an arrow function. The starter assumes its arguments are always there.",
    teaches: "Default parameters (params = {}) apply when an argument is missing or undefined; rest parameters (...weights) gather extra arguments into a real array, and spread (Math.max(...weights)) passes an array as separate arguments. Arrow functions are shorter, have no own this and no prototype, which is why they cannot be used with new.",
    starter: `function buildUrl(path, params) {
  let url = "https://api.fleet.example" + path + "?";
  for (const key in params) {
    url += key + "=" + params[key] + "&";
  }
  return url;
}

function maxWeight(weights) {
  return Math.max(weights);
}

const formatDriver = function (driver, options) {
  const name = options.uppercase ? driver.name.toUpperCase() : driver.name;
  return name + " (" + driver.depot + ")";
};
`,
    solution: `function buildUrl(path, params = {}) {
  const query = Object.entries(params)
    .map(([key, value]) => \`\${encodeURIComponent(key)}=\${encodeURIComponent(value)}\`)
    .join("&");
  return \`https://api.fleet.example\${path}\${query ? \`?\${query}\` : ""}\`;
}

function maxWeight(...weights) {
  return weights.length ? Math.max(...weights) : null;
}

const formatDriver = (driver, { uppercase = false } = {}) => {
  const name = uppercase ? driver.name.toUpperCase() : driver.name;
  return \`\${name} (\${driver.depot})\`;
};
`,
    tests: [
      { id: "plain", label: "buildUrl('/shipments') has no '?'", code: `assertEqual(buildUrl("/shipments"), "https://api.fleet.example/shipments")` },
      { id: "query", label: "buildUrl encodes the query", code: `assertEqual(buildUrl("/shipments", { status: "in transit", depot: "north" }), "https://api.fleet.example/shipments?status=in%20transit&depot=north")` },
      { id: "rest", label: "maxWeight(3, 9, 4), maxWeight(7), maxWeight()", code: `assertEqual([maxWeight(3, 9, 4), maxWeight(7), maxWeight()], [9, 7, null])` },
      { id: "defaults", label: "formatDriver works with and without options", code: `const d = { name: "Ada", depot: "north" };\nassertEqual([formatDriver(d), formatDriver(d, { uppercase: true })], ["Ada (north)", "ADA (north)"])` },
      { id: "arrow", label: "formatDriver is an arrow function", code: `assert(typeof formatDriver === "function" && !("prototype" in formatDriver), "an arrow function has no prototype property")` },
    ],
    hints: ["Give params a default of {} and only add '?' when there is a query. Encode keys and values with encodeURIComponent.", "function maxWeight(...weights) collects the arguments; Math.max(...weights) spreads them back out.", "const formatDriver = (driver, { uppercase = false } = {}) => ... destructures the options with a default for both the object and the flag."],
  },
  {
    id: "js-05-this",
    title: "this in different call contexts",
    brief: "countAll(items) should call counter.increment once per item and return the count. tracker.recordLater(event) should record the event after a short delay. Both lose this: a method passed as a callback is called without its object, and a function expression inside setTimeout gets its own this.",
    teaches: "this is decided by how a function is called, not where it is written: obj.method() sets this to obj, but passing obj.method somewhere and calling it later calls it bare (undefined in strict code). Arrow functions do not have their own this; they use the surrounding one, which is why they fix callbacks inside methods. bind makes a copy with this fixed.",
    starter: `const counter = {
  count: 0,
  increment() {
    this.count += 1;
  },
};

function countAll(items) {
  items.forEach(counter.increment);
  return counter.count;
}

class Tracker {
  constructor(name) {
    this.name = name;
    this.events = [];
  }
  record(event) {
    this.events.push(\`\${this.name}: \${event}\`);
  }
  recordLater(event) {
    setTimeout(function () {
      this.record(event);
    }, 10);
  }
}
`,
    solution: `const counter = {
  count: 0,
  increment() {
    this.count += 1;
  },
};

function countAll(items) {
  items.forEach(() => counter.increment());
  return counter.count;
}

class Tracker {
  constructor(name) {
    this.name = name;
    this.events = [];
  }
  record(event) {
    this.events.push(\`\${this.name}: \${event}\`);
  }
  recordLater(event) {
    setTimeout(() => this.record(event), 10);
  }
}
`,
    tests: [
      { id: "count", label: "countAll(['a', 'b', 'c']) === 3", code: `counter.count = 0;\nassertEqual(countAll(["a", "b", "c"]), 3)` },
      { id: "later", label: "recordLater records after the delay", code: `const t = new Tracker("van-7");\nt.recordLater("departed");\nawait sleep(40);\nassertEqual(t.events, ["van-7: departed"])` },
      { id: "detached", label: "a detached method has no this (strict mode)", code: `const t = new Tracker("van-9");\nconst detached = t.record;\nassertThrows(() => detached("loaded"), TypeError)` },
    ],
    hints: ["The error says it cannot read 'count' of undefined: forEach calls increment without counter in front of it.", "Wrap the call: items.forEach(() => counter.increment()), or pass counter.increment.bind(counter). In recordLater, use an arrow function so this stays the tracker.", "items.forEach(() => counter.increment()); and setTimeout(() => this.record(event), 10);"],
  },
  {
    id: "js-06-closures",
    title: "Closures: private state that lasts",
    brief: "once(fn) should return a function that calls fn the first time and returns that same result on every later call. makeIdGenerator(prefix) should return a function producing 'S-1', 'S-2', ... with every generator counting on its own. memoize(fn) should remember results by argument so fn runs once per distinct argument. The starter shares one counter between all generators and has no memoize.",
    teaches: "A closure is a function together with the variables it could see where it was created. Each call to the outer function makes fresh variables, so every returned function gets its own private state that nothing else can touch: the basis of once, counters, caches and the module pattern.",
    starter: `function once(fn) {
  return function (...args) {
    return fn(...args);
  };
}

let next = 0;
function makeIdGenerator(prefix) {
  return () => {
    next += 1;
    return \`\${prefix}-\${next}\`;
  };
}
`,
    solution: `function once(fn) {
  let done = false;
  let result;
  return (...args) => {
    if (!done) {
      done = true;
      result = fn(...args);
    }
    return result;
  };
}

function makeIdGenerator(prefix) {
  let next = 0;
  return () => {
    next += 1;
    return \`\${prefix}-\${next}\`;
  };
}

function memoize(fn) {
  const cache = new Map();
  return (arg) => {
    if (!cache.has(arg)) cache.set(arg, fn(arg));
    return cache.get(arg);
  };
}
`,
    tests: [
      { id: "once", label: "once calls fn a single time", code: `let n = 0;\nconst init = once(() => ++n);\ninit();\ninit();\nassertEqual([init(), n], [1, 1])` },
      { id: "ids", label: "two generators count independently", code: `const a = makeIdGenerator("S");\nconst b = makeIdGenerator("D");\na();\na();\nassertEqual([a(), b()], ["S-3", "D-1"])` },
      { id: "memo", label: "memoize runs fn once per argument", code: `let calls = 0;\nconst double = memoize((x) => { calls++; return x * 2; });\ndouble(4);\ndouble(4);\ndouble(5);\nassertEqual([double(4), calls], [8, 2])` },
    ],
    hints: ["The generators share the top-level next. Move it inside makeIdGenerator so each call makes its own.", "once needs two private variables (done and result); memoize needs a private Map.", "let next = 0 inside makeIdGenerator; once remembers done and result; memoize keeps const cache = new Map() and checks cache.has(arg)."],
  },
  {
    id: "js-07-array-methods",
    title: "map, filter, reduce, find, some, every",
    brief: "Using the shipments list, write inTransitIds(list) (the ids in transit), totalWeight(list) (everything except cancelled), findUnassigned(list) (the first shipment without a driver), allWeighed(list) (every weight above zero) and anyHeavy(list, kg) (at least one heavier than kg), all without for or while loops. The starter has two loops, one of them collecting whole objects instead of ids, and the other three functions are missing.",
    teaches: "Array methods name the intent: filter keeps what matches, map transforms each item, reduce folds a list into one value, find returns the first match (or undefined), some and every answer yes-or-no questions. Chaining them replaces most hand-written loops with code that says what it does.",
    starter: `${SHIPMENTS}
function inTransitIds(list) {
  const ids = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].status === "in-transit") ids.push(list[i]);
  }
  return ids;
}

function totalWeight(list) {
  let total = 0;
  for (let i = 0; i < list.length; i++) total += list[i].weightKg;
  return total;
}
`,
    solution: `${SHIPMENTS}
const inTransitIds = (list) => list.filter((s) => s.status === "in-transit").map((s) => s.id);

const totalWeight = (list) => list.filter((s) => s.status !== "cancelled").reduce((sum, s) => sum + s.weightKg, 0);

const findUnassigned = (list) => list.find((s) => !s.driverId);

const allWeighed = (list) => list.every((s) => s.weightKg > 0);

const anyHeavy = (list, kg) => list.some((s) => s.weightKg > kg);
`,
    tests: [
      { id: "ids", label: "inTransitIds(shipments) is ['S-101', 'S-103']", code: `assertEqual(inTransitIds(shipments), ["S-101", "S-103"])` },
      { id: "total", label: "totalWeight leaves out the cancelled shipment (54.5 kg)", code: `assertEqual(totalWeight(shipments), 54.5)` },
      { id: "find", label: "findUnassigned finds S-102", code: `assertEqual(findUnassigned(shipments)?.id, "S-102")` },
      { id: "somevery", label: "allWeighed, anyHeavy over 25 and over 30", code: `assertEqual([allWeighed(shipments), anyHeavy(shipments, 25), anyHeavy(shipments, 30)], [true, true, false])` },
      { id: "noloops", label: "no for or while loops", code: `assert(!/\\b(for|while)\\s*\\(/.test($source), "use array methods instead of loops")` },
    ],
    hints: ["filter then map: list.filter(...).map((s) => s.id). reduce takes a starting value: reduce((sum, s) => sum + s.weightKg, 0).", "find returns the first match; every and some return booleans.", "inTransitIds = filter + map; totalWeight = filter + reduce; findUnassigned = find(s => !s.driverId); allWeighed = every; anyHeavy = some."],
  },
  {
    id: "js-08-destructuring",
    title: "Destructuring, spread and rest",
    brief: "summarize(route) should return { id, driverName, firstStop, remainingStops, totalParcels } from the nested route. withStatus(shipment, status) should return a new object with the status changed, leaving the original alone. mergeDefaults(options) should fill in { retries: 3, timeoutMs: 1000 } without overriding what the caller set. The starter reads the wrong fields, mutates its argument and forces retries back to 3.",
    teaches: "Destructuring pulls values out of objects and arrays by shape, including nested ones and the rest of an array ([first, ...rest]). Object spread copies properties into a new object; later properties win, so { ...defaults, ...options } lets the caller override and { ...shipment, status } changes one field without touching the original.",
    starter: `const route = {
  id: "R-7",
  driver: { name: "Ada Okafor", depot: "north" },
  stops: [
    { town: "Leeds", parcels: 3 },
    { town: "York", parcels: 1 },
    { town: "Hull", parcels: 4 },
  ],
};

function summarize(route) {
  return {
    id: route.id,
    driverName: route.driver.name,
    firstStop: route.stops[0],
    remainingStops: route.stops.length,
    totalParcels: route.stops.length,
  };
}

function withStatus(shipment, status) {
  shipment.status = status;
  return shipment;
}

function mergeDefaults(options) {
  return Object.assign({ retries: 3, timeoutMs: 1000 }, options, { retries: 3 });
}
`,
    solution: `const route = {
  id: "R-7",
  driver: { name: "Ada Okafor", depot: "north" },
  stops: [
    { town: "Leeds", parcels: 3 },
    { town: "York", parcels: 1 },
    { town: "Hull", parcels: 4 },
  ],
};

function summarize({ id, driver: { name: driverName }, stops: [first, ...rest] }) {
  const totalParcels = [first, ...rest].reduce((sum, { parcels }) => sum + parcels, 0);
  return { id, driverName, firstStop: first.town, remainingStops: rest.length, totalParcels };
}

const withStatus = (shipment, status) => ({ ...shipment, status });

const mergeDefaults = (options = {}) => ({ retries: 3, timeoutMs: 1000, ...options });
`,
    tests: [
      { id: "summary", label: "summarize(route)", code: `assertEqual(summarize(route), { id: "R-7", driverName: "Ada Okafor", firstStop: "Leeds", remainingStops: 2, totalParcels: 8 })` },
      { id: "immutable", label: "withStatus returns a new object and leaves the original", code: `const s = { id: "S-1", status: "pending" };\nconst t = withStatus(s, "delivered");\nassertEqual([s.status, t.status, s === t], ["pending", "delivered", false])` },
      { id: "defaults", label: "mergeDefaults keeps the caller's values", code: `assertEqual([mergeDefaults({ retries: 5 }), mergeDefaults()], [{ retries: 5, timeoutMs: 1000 }, { retries: 3, timeoutMs: 1000 }])` },
      { id: "syntax", label: "uses destructuring and spread", code: `assert(/\\.\\.\\./.test($source) && /\\{\\s*\\w+\\s*[,:}]/.test($source.split("function summarize")[1] ?? $source.split("summarize")[1] ?? ""), "destructure the route and use spread")` },
    ],
    hints: ["Destructure in the parameter list: ({ id, driver: { name: driverName }, stops: [first, ...rest] }).", "Spread makes copies: ({ ...shipment, status }) and ({ retries: 3, timeoutMs: 1000, ...options }). Give options a default of {}.", "function summarize({ id, driver: { name: driverName }, stops: [first, ...rest] }) { const totalParcels = [first, ...rest].reduce((sum, { parcels }) => sum + parcels, 0); return { id, driverName, firstStop: first.town, remainingStops: rest.length, totalParcels }; }"],
  },
  {
    id: "js-09-copying",
    title: "Shallow copies, deep copies and shared references",
    brief: "cloneRoute(route) should return a copy that can be changed at any depth without touching the original. addStop(route, stop) should return a new route with one more stop, leaving the original's stops as they were. The starter copies one level deep, so the nested stops array and its objects are still shared.",
    teaches: "Objects and arrays are handled by reference: assigning or spreading copies the outer container, not what it contains. A deep copy (structuredClone) duplicates every level. Often you do not need one: build a new array for the part that changes ([...route.stops, stop]) and share the parts that do not.",
    starter: `function cloneRoute(route) {
  return { ...route };
}

function addStop(route, stop) {
  const copy = { ...route };
  copy.stops.push(stop);
  return copy;
}
`,
    solution: `const cloneRoute = (route) => structuredClone(route);

const addStop = (route, stop) => ({ ...route, stops: [...route.stops, stop] });
`,
    tests: [
      { id: "deep", label: "changing the clone's nested stop leaves the original", code: `const r = { id: "R-1", stops: [{ town: "Leeds" }] };\nconst c = cloneRoute(r);\nc.stops[0].town = "York";\nassertEqual(r.stops[0].town, "Leeds", "the clone shares nested objects with the original")` },
      { id: "addstop", label: "addStop leaves the original's stops alone", code: `const r = { id: "R-1", stops: [{ town: "Leeds" }] };\nconst r2 = addStop(r, { town: "Hull" });\nassertEqual([r.stops.length, r2.stops.length], [1, 2])` },
      { id: "sharing", label: "unchanged stops may be shared (cheap and safe)", code: `const r = { id: "R-1", stops: [{ town: "Leeds" }] };\nconst r2 = addStop(r, { town: "Hull" });\nassert(r2.stops[0] === r.stops[0], "the first stop did not change, so it need not be copied")` },
    ],
    hints: ["{ ...route } copies the outer object only; copy.stops is the same array as route.stops.", "structuredClone(route) copies every level. For addStop, make a new stops array: [...route.stops, stop].", "const cloneRoute = (route) => structuredClone(route); const addStop = (route, stop) => ({ ...route, stops: [...route.stops, stop] });"],
  },
  {
    id: "js-10-event-loop",
    title: "The event loop: predict the order",
    brief: "Before running, write the order in which the seven letters will be logged into PREDICTED, then run to check. Also write delay(ms), which returns a promise that resolves after ms milliseconds, so that await delay(30) pauses an async function without blocking anything else.",
    teaches: "JavaScript runs one thing at a time. Synchronous code runs to the end first; then the microtask queue empties (promise reactions, queueMicrotask, the rest of an async function after await); only then does the next task run (a setTimeout callback, even with 0 ms). Wrapping setTimeout in a Promise is how callback timers become awaitable.",
    starter: `// Predict the order these lines are logged in, then run to check.
const PREDICTED = ["A", "B", "C", "D", "E", "F", "G"];

console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
queueMicrotask(() => console.log("D"));
(async () => {
  console.log("E");
  await null;
  console.log("F");
})();
console.log("G");

function delay(ms) {
  setTimeout(() => {}, ms);
}
`,
    solution: `// Predict the order these lines are logged in, then run to check.
const PREDICTED = ["A", "E", "G", "C", "D", "F", "B"];

console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
queueMicrotask(() => console.log("D"));
(async () => {
  console.log("E");
  await null;
  console.log("F");
})();
console.log("G");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
`,
    tests: [
      { id: "order", label: "PREDICTED matches what actually ran", code: `assertEqual(PREDICTED, logs(), "the run logged a different order from your prediction")` },
      { id: "promise", label: "delay(ms) returns a Promise", code: `assert(delay(1) instanceof Promise, "delay should return a Promise")` },
      { id: "waits", label: "await delay(30) waits about 30 ms", code: `const t0 = Date.now();\nawait delay(30);\nassert(Date.now() - t0 >= 25, "delay resolved too early")` },
    ],
    hints: ["Synchronous lines first: A, then E (an async function runs synchronously until its first await), then G.", "Microtasks next, in the order they were queued: C, D, then F (the rest of the async function). The timer callback B runs last.", "PREDICTED = ['A', 'E', 'G', 'C', 'D', 'F', 'B']; function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }"],
  },
  {
    id: "js-11-promises",
    title: "From callbacks to promises, then Promise.all",
    brief: "loadShipment(id, callback) is an old callback-style loader; leave it as it is. Write loadShipmentAsync(id) so it returns a promise that resolves with the shipment or rejects with the error. Then make loadAll(ids) load every id at the same time: four 20 ms loads should take about 20 ms, not 80.",
    teaches: "A callback API calls you back with (error, result); nesting several of them is callback hell. A Promise represents the eventual result and can be awaited; new Promise((resolve, reject) => ...) adapts a callback API. await in a loop runs one step after another; Promise.all starts them all and waits for every one, rejecting as soon as one fails.",
    starter: `// A callback-style loader from an old module. Do not change it.
function loadShipment(id, callback) {
  setTimeout(() => {
    if (!id.startsWith("S-")) callback(new Error(\`bad id \${id}\`));
    else callback(null, { id, loadedAt: Date.now() });
  }, 20);
}

function loadShipmentAsync(id) {
  loadShipment(id, (err, shipment) => {
    return shipment;
  });
}

async function loadAll(ids) {
  const out = [];
  for (const id of ids) out.push(await loadShipmentAsync(id));
  return out;
}
`,
    solution: `// A callback-style loader from an old module. Do not change it.
function loadShipment(id, callback) {
  setTimeout(() => {
    if (!id.startsWith("S-")) callback(new Error(\`bad id \${id}\`));
    else callback(null, { id, loadedAt: Date.now() });
  }, 20);
}

function loadShipmentAsync(id) {
  return new Promise((resolve, reject) => {
    loadShipment(id, (err, shipment) => (err ? reject(err) : resolve(shipment)));
  });
}

const loadAll = (ids) => Promise.all(ids.map(loadShipmentAsync));
`,
    tests: [
      { id: "promise", label: "loadShipmentAsync resolves with the shipment", code: `const p = loadShipmentAsync("S-1");\nassert(p instanceof Promise, "return a Promise");\nassertEqual((await p).id, "S-1")` },
      { id: "reject", label: "a bad id rejects", code: `await assertRejects(() => loadShipmentAsync("X-1"), Error)` },
      { id: "together", label: "loadAll loads four shipments at once", code: `const t0 = Date.now();\nconst all = await loadAll(["S-1", "S-2", "S-3", "S-4"]);\nconst took = Date.now() - t0;\nassertEqual(all.map((s) => s.id), ["S-1", "S-2", "S-3", "S-4"]);\nassert(took < 60, \`took \${took} ms: one after another takes about 80 ms, all at once about 20\`)` },
    ],
    hints: ["loadShipmentAsync returns nothing: the return inside the callback goes back to loadShipment, not to your caller.", "return new Promise((resolve, reject) => loadShipment(id, (err, s) => err ? reject(err) : resolve(s))). For loadAll, start every load before waiting: Promise.all(ids.map(...)).", "function loadShipmentAsync(id) { return new Promise((resolve, reject) => { loadShipment(id, (err, shipment) => (err ? reject(err) : resolve(shipment))); }); } const loadAll = (ids) => Promise.all(ids.map(loadShipmentAsync));"],
  },
  {
    id: "js-12-fetch",
    title: "async/await with fetch: dependent calls and errors",
    brief: "shipmentWithDriver(id) should fetch the shipment from the simulated API, then its driver, and return { id, destination, driver } with the driver's name, or driver: null for an unassigned shipment (without asking for a driver). An unknown id should return { id, error: 'not found' } instead of throwing. The starter forgets that fetch and json() both return promises.",
    teaches: "fetch resolves as soon as the response headers arrive, even for a 404: check response.ok (or status) before reading the body, which is a second await (response.json()). Dependent calls run one after the other with await; try/catch around the awaits handles both network failures and the errors you throw for bad statuses.",
    starter: `const API = "https://api.fleet.example";

async function shipmentWithDriver(id) {
  const shipment = fetch(\`\${API}/shipments/\${id}\`).json();
  const driver = await fetch(\`\${API}/drivers/\${shipment.driverId}\`).json();
  return { id: shipment.id, destination: shipment.destination, driver: driver.name };
}
`,
    solution: `const API = "https://api.fleet.example";

async function getJson(path) {
  const response = await fetch(\`\${API}\${path}\`);
  if (!response.ok) {
    const error = new Error(\`HTTP \${response.status} for \${path}\`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function shipmentWithDriver(id) {
  try {
    const shipment = await getJson(\`/shipments/\${id}\`);
    const driver = shipment.driverId ? await getJson(\`/drivers/\${shipment.driverId}\`) : null;
    return { id: shipment.id, destination: shipment.destination, driver: driver ? driver.name : null };
  } catch (error) {
    return { id, error: error.status === 404 ? "not found" : error.message };
  }
}
`,
    tests: [
      { id: "happy", label: "S-101 comes back with its driver", code: `assertEqual(await shipmentWithDriver("S-101"), { id: "S-101", destination: "Bristol", driver: "Sam Reyes" })` },
      { id: "sequence", label: "the shipment is fetched before its driver", code: `const before = fetchLog().length;\nawait shipmentWithDriver("S-103");\nassertEqual(fetchLog().slice(before).map((c) => c.path), ["/shipments/S-103", "/drivers/D-1"])` },
      { id: "unassigned", label: "an unassigned shipment asks for no driver", code: `const before = fetchLog().length;\nassertEqual(await shipmentWithDriver("S-102"), { id: "S-102", destination: "York", driver: null });\nassertEqual(fetchLog().length - before, 1)` },
      { id: "missing", label: "an unknown id returns an error object", code: `assertEqual(await shipmentWithDriver("S-999"), { id: "S-999", error: "not found" })` },
    ],
    hints: ["fetch(...) is a promise: await it, then await response.json(). A 404 still resolves, so check response.ok.", "Write a small getJson(path) that throws when !response.ok, and wrap both calls in try/catch.", "async function getJson(path) { const r = await fetch(`${API}${path}`); if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; } return r.json(); } then await getJson for the shipment and, only when driverId is set, for the driver; catch and return { id, error: 'not found' } on a 404."],
  },
  {
    id: "js-13-modules",
    title: "ES modules and template literals",
    brief: "Everything lives in main.js with a global var and string concatenation. Move the company name to config.js as its default export, move formatShipment to format.js as a named export that builds its string with a template literal, and have main.js import formatShipment and export summary. The files are real ES modules; main.js runs first.",
    teaches: "A module has its own scope: nothing is global unless exported, and nothing outside is visible unless imported. A file has at most one default export (imported under any name) and any number of named exports (imported by their names in braces). Template literals (backticks) put values into strings with ${...} instead of +.",
    starterFiles: {
      "main.js": `var COMPANY = "Nimbus Freight";

function formatShipment(s) {
  return COMPANY + ": " + s.id + " to " + s.destination + " (" + s.weightKg + " kg)";
}

function summary(list) {
  return list.map(formatShipment).join("\\n");
}

console.log(summary([{ id: "S-100", destination: "Leeds", weightKg: 12 }]));
`,
      "format.js": `// formatShipment goes here, as a named export.
`,
      "config.js": `// The company name goes here, as the default export.
`,
    },
    solutionFiles: {
      "main.js": `import { formatShipment } from "./format.js";

export function summary(list) {
  return list.map(formatShipment).join("\\n");
}

console.log(summary([{ id: "S-100", destination: "Leeds", weightKg: 12 }]));
`,
      "format.js": `import COMPANY from "./config.js";

export function formatShipment({ id, destination, weightKg }) {
  return \`\${COMPANY}: \${id} to \${destination} (\${weightKg} kg)\`;
}
`,
      "config.js": `export default "Nimbus Freight";
`,
    },
    entry: "main.js",
    tests: [
      { id: "default", label: "config.js has the company name as its default export", code: `assertEqual(modules["config.js"].default, "Nimbus Freight")` },
      { id: "named", label: "format.js exports formatShipment by name", code: `assertEqual(typeof modules["format.js"].formatShipment, "function", "export function formatShipment from format.js")` },
      { id: "summary", label: "main.js exports summary, built on formatShipment", code: `assertEqual(modules["main.js"].summary?.([{ id: "S-1", destination: "Hull", weightKg: 2 }]), "Nimbus Freight: S-1 to Hull (2 kg)")` },
      { id: "template", label: "format.js uses a template literal, not +", code: `assert(/\\$\\{/.test($source["format.js"]) && !/["'\`]\\s*\\+|\\+\\s*["'\`]/.test($source["format.js"]), "build the string with \\\`...\\\${value}...\\\` instead of +")` },
      { id: "noglobals", label: "no var anywhere", code: `assert(!/\\bvar\\s/.test(Object.values($source).join("\\n")), "module scope replaces globals: use const")` },
    ],
    hints: ["config.js: export default \"Nimbus Freight\";  format.js: import COMPANY from \"./config.js\"; then export function formatShipment(...).", "main.js: import { formatShipment } from \"./format.js\"; and export function summary(list) { ... }.", "config.js: export default \"Nimbus Freight\";\nformat.js: import COMPANY from \"./config.js\"; export function formatShipment({ id, destination, weightKg }) { return `${COMPANY}: ${id} to ${destination} (${weightKg} kg)`; }\nmain.js: import { formatShipment } from \"./format.js\"; export function summary(list) { return list.map(formatShipment).join(\"\\n\"); }"],
  },
  {
    id: "js-14-classes",
    title: "Classes: constructors, inheritance, static and private members",
    brief: "Vehicle(id, capacityKg) should track loadKg, refuse a load that would exceed capacity with a RangeError (leaving the load unchanged), count every vehicle created in a static Vehicle.count, keep a private #history of loads exposed through a history getter that returns a copy, and describe itself as 'T-1: 60/100 kg'. Van extends Vehicle with an 800 kg capacity, 4 wheels and a describe() that adds ' (van)'. The starter's Van never calls super.",
    teaches: "A class bundles a constructor and methods on a shared prototype. extends sets up inheritance; a subclass constructor must call super(...) before using this, and super.method() reaches the parent's version. static members belong to the class itself; #private fields are invisible outside the class body, and a getter can expose a safe copy.",
    starter: `class Vehicle {
  constructor(id, capacityKg) {
    this.id = id;
    this.capacityKg = capacityKg;
    this.loadKg = 0;
  }
  load(kg) {
    this.loadKg += kg;
  }
}

class Van extends Vehicle {
  constructor(id) {
    this.wheels = 4;
  }
}
`,
    solution: `class Vehicle {
  static count = 0;
  #history = [];

  constructor(id, capacityKg) {
    this.id = id;
    this.capacityKg = capacityKg;
    this.loadKg = 0;
    Vehicle.count += 1;
  }

  load(kg) {
    if (this.loadKg + kg > this.capacityKg) throw new RangeError(\`\${this.id} cannot take \${kg} kg more\`);
    this.loadKg += kg;
    this.#history.push(kg);
  }

  get history() {
    return [...this.#history];
  }

  describe() {
    return \`\${this.id}: \${this.loadKg}/\${this.capacityKg} kg\`;
  }
}

class Van extends Vehicle {
  constructor(id) {
    super(id, 800);
    this.wheels = 4;
  }

  describe() {
    return \`\${super.describe()} (van)\`;
  }
}
`,
    tests: [
      { id: "van", label: "a Van is a Vehicle with 800 kg and 4 wheels", code: `const v = new Van("V-7");\nv.load(300);\nassertEqual([v.describe(), v.wheels, v instanceof Vehicle], ["V-7: 300/800 kg (van)", 4, true])` },
      { id: "range", label: "overloading throws RangeError and changes nothing", code: `const v = new Vehicle("T-1", 100);\nv.load(60);\nassertThrows(() => v.load(50), RangeError);\nassertEqual(v.loadKg, 60)` },
      { id: "static", label: "Vehicle.count counts vehicles and vans", code: `const before = Vehicle.count;\nnew Vehicle("a", 1);\nnew Van("b");\nassertEqual(Vehicle.count - before, 2)` },
      { id: "private", label: "history is a copy of a private list", code: `const v = new Vehicle("T-2", 100);\nv.load(10);\nv.history.push(999);\nassertEqual([v.history, "#history" in v, Object.keys(v).includes("history")], [[10], false, false])` },
    ],
    hints: ["The ReferenceError says super must be called before this: the Van constructor needs super(id, 800) first.", "static count = 0; and Vehicle.count += 1 in the constructor. #history = []; plus get history() { return [...this.#history]; }.", "See the reference shape: Vehicle with static count, #history, load with a RangeError check, a history getter and describe(); Van calls super(id, 800) and returns `${super.describe()} (van)`."],
  },
  {
    id: "js-15-map-set",
    title: "Map, Set, optional chaining and nullish coalescing",
    brief: "uniqueDestinations(list) should return each destination once, in first-seen order. weightByDriver(list) should return a Map from driverId to total weight, keeping null (unassigned) as its own key, separate from the string 'null'. driverName(shipment) should return shipment.driver.name or 'unassigned' even when shipment or driver is missing. retries(config) should return config.retries, keeping 0, or 3 when it is not set. The starter uses plain objects and || everywhere.",
    teaches: "A Set keeps unique values; a Map keeps keys of any type (null, numbers, objects) without turning them into strings as object keys do. a?.b stops at null or undefined instead of throwing. a ?? b falls back only for null and undefined, where a || b also throws away 0, '' and false.",
    starter: `function uniqueDestinations(list) {
  return list.map((s) => s.destination);
}

function weightByDriver(list) {
  const totals = {};
  for (const s of list) totals[s.driverId] = (totals[s.driverId] || 0) + s.weightKg;
  return totals;
}

function driverName(shipment) {
  return shipment.driver.name || "unassigned";
}

function retries(config) {
  return config.retries || 3;
}
`,
    solution: `const uniqueDestinations = (list) => [...new Set(list.map((s) => s.destination))];

function weightByDriver(list) {
  const totals = new Map();
  for (const s of list) totals.set(s.driverId, (totals.get(s.driverId) ?? 0) + s.weightKg);
  return totals;
}

const driverName = (shipment) => shipment?.driver?.name ?? "unassigned";

const retries = (config) => config?.retries ?? 3;
`,
    tests: [
      { id: "unique", label: "uniqueDestinations keeps first-seen order", code: `assertEqual(uniqueDestinations([{ destination: "Leeds" }, { destination: "Hull" }, { destination: "Leeds" }]), ["Leeds", "Hull"])` },
      { id: "map", label: "weightByDriver returns a Map with null as its own key", code: `const m = weightByDriver([{ driverId: "D-1", weightKg: 2 }, { driverId: null, weightKg: 5 }, { driverId: "D-1", weightKg: 3 }]);\nassert(m instanceof Map, "return a Map");\nassertEqual([m.get("D-1"), m.get(null), m.has("null")], [5, 5, false])` },
      { id: "optional", label: "driverName survives missing pieces", code: `assertEqual([driverName({ driver: { name: "Ada" } }), driverName({}), driverName(undefined)], ["Ada", "unassigned", "unassigned"])` },
      { id: "nullish", label: "retries keeps 0", code: `assertEqual([retries({ retries: 0 }), retries({}), retries(null)], [0, 3, 3])` },
    ],
    hints: ["[...new Set(values)] removes duplicates and keeps order. new Map() with get and set keeps null as a real key.", "shipment?.driver?.name ?? 'unassigned' and config?.retries ?? 3.", "uniqueDestinations = [...new Set(list.map(s => s.destination))]; weightByDriver uses a Map; driverName and retries use ?. and ??."],
  },
  {
    id: "js-16-prototypes",
    title: "The prototype chain",
    brief: "makeVan(id) should return a new object whose prototype is vehicleProto, with its own id and its own kind 'van', so describe() is found on the prototype and the shared prototype is never changed. ownOrInherited(obj, key) should return 'own', 'inherited' or 'missing'. chainLength(obj) should count the prototypes above obj until null. The starter returns the prototype itself and overwrites it.",
    teaches: "Every object has a prototype; reading a property looks on the object, then its prototype, then that one's, until null. Object.create(proto) makes a new object with proto as its prototype, so methods are shared rather than copied; assigning a property creates an own property that shadows the one below. Object.hasOwn tells own from inherited; the in operator sees both.",
    starter: `const vehicleProto = {
  kind: "vehicle",
  describe() {
    return \`\${this.id} (\${this.kind})\`;
  },
};

function makeVan(id) {
  const van = vehicleProto;
  van.id = id;
  van.kind = "van";
  return van;
}
`,
    solution: `const vehicleProto = {
  kind: "vehicle",
  describe() {
    return \`\${this.id} (\${this.kind})\`;
  },
};

function makeVan(id) {
  const van = Object.create(vehicleProto);
  van.id = id;
  van.kind = "van";
  return van;
}

function ownOrInherited(obj, key) {
  if (Object.hasOwn(obj, key)) return "own";
  return key in obj ? "inherited" : "missing";
}

function chainLength(obj) {
  let length = 0;
  for (let p = Object.getPrototypeOf(obj); p !== null; p = Object.getPrototypeOf(p)) length += 1;
  return length;
}
`,
    tests: [
      { id: "separate", label: "two vans keep their own ids", code: `const a = makeVan("V-1");\nconst b = makeVan("V-2");\nassertEqual([a.describe(), b.describe()], ["V-1 (van)", "V-2 (van)"])` },
      { id: "untouched", label: "the shared prototype is not changed", code: `makeVan("V-3");\nassertEqual([vehicleProto.kind, Object.hasOwn(vehicleProto, "id")], ["vehicle", false], "the shared prototype was changed")` },
      { id: "lookup", label: "own, inherited and missing properties", code: `const v = makeVan("V-4");\nassertEqual(["id", "describe", "toString", "wheels"].map((k) => ownOrInherited(v, k)), ["own", "inherited", "inherited", "missing"])` },
      { id: "chain", label: "chainLength of a van, {} and a null-prototype object", code: `assertEqual([chainLength(makeVan("V-5")), chainLength({}), chainLength(Object.create(null))], [2, 1, 0])` },
    ],
    hints: ["const van = vehicleProto makes van another name for the same object. Object.create(vehicleProto) makes a new one that inherits from it.", "Object.hasOwn(obj, key) for own; key in obj for own or inherited. Walk with Object.getPrototypeOf until null.", "function makeVan(id) { const van = Object.create(vehicleProto); van.id = id; van.kind = 'van'; return van; } plus ownOrInherited and chainLength as described."],
  },
  {
    id: "js-17-patterns",
    title: "Higher-order functions, composition and the observer pattern",
    brief: "curry2(fn) should turn fn(a, b) into fn(a)(b). pipe(...fns) should run functions left to right. createEmitter() should return { on, emit } where on(event, fn) subscribes to one event name and returns a function that unsubscribes, and emit(event, payload) calls that event's listeners in order. The starter ignores event names, composes right to left and does not curry.",
    teaches: "Higher-order functions take or return functions. Currying turns a function of several arguments into a chain of one-argument functions; composition builds a pipeline from small steps. The observer pattern decouples whoever emits an event from whoever reacts; keeping the listener list inside a closure is the module pattern: private state with a small public surface.",
    starter: `function curry2(fn) {
  return fn;
}

function pipe(...fns) {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
}

function createEmitter() {
  const listeners = [];
  return {
    on(event, fn) {
      listeners.push(fn);
    },
    emit(event, payload) {
      listeners.forEach((fn) => fn(payload));
    },
  };
}
`,
    solution: `const curry2 = (fn) => (a) => (b) => fn(a, b);

const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

function createEmitter() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return () => {
        const list = listeners.get(event);
        list.splice(list.indexOf(fn), 1);
      };
    },
    emit(event, payload) {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(payload);
    },
  };
}
`,
    tests: [
      { id: "curry", label: "curry2((a, b) => a + b)(2)(3) === 5", code: `assertEqual(curry2((a, b) => a + b)(2)(3), 5)` },
      { id: "pipe", label: "pipe runs left to right", code: `assertEqual(pipe((x) => x + 1, (x) => x * 10)(2), 30)` },
      { id: "events", label: "listeners hear only their event", code: `const e = createEmitter();\nconst got = [];\ne.on("loaded", (p) => got.push("L" + p));\ne.on("delivered", (p) => got.push("D" + p));\ne.emit("loaded", 1);\ne.emit("delivered", 2);\nassertEqual(got, ["L1", "D2"])` },
      { id: "off", label: "on() returns an unsubscribe function", code: `const e = createEmitter();\nconst got = [];\nconst off = e.on("x", (p) => got.push(p));\ne.emit("x", 1);\noff();\ne.emit("x", 2);\nassertEqual(got, [1])` },
    ],
    hints: ["curry2 returns a function that returns a function: (a) => (b) => fn(a, b). pipe uses reduce, not reduceRight.", "Keep a Map from event name to an array of listeners; on returns () => remove fn from that array.", "const curry2 = (fn) => (a) => (b) => fn(a, b); const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x); createEmitter keeps a Map of arrays, and on returns a function that splices the listener out."],
  },
];

export const JS_DRILLS: JsDrill[] = [...LANGUAGE_DRILLS, ...MORE_JS_DRILLS];

export const JS_DRILL_BY_ID = new Map(JS_DRILLS.map((d) => [d.id, d]));
