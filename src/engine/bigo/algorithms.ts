import type { ComplexityClass } from "../../domain/types";

/**
 * Instrumented algorithms for the Algorithms Laboratory. Every algorithm
 * counts its "basic operations" (comparisons / visits) so learners can see
 * growth with input size and compare it to measured wall-clock time, which
 * the UI always labels as two different things.
 */

export interface Step {
  /** Indices being examined. */
  focus: number[];
  /** Optional range highlight (e.g. binary search window). */
  range?: [number, number];
  note: string;
  /** Snapshot of the array when it changes (sorting). */
  array?: number[];
}

export interface AlgorithmRun {
  key: AlgorithmKey;
  n: number;
  operations: number;
  elapsedMs: number;
  result: string;
  steps: Step[];
}

export type AlgorithmKey =
  | "constant-index"
  | "linear-search"
  | "binary-search"
  | "bubble-sort"
  | "insertion-sort"
  | "merge-sort"
  | "nested-pairs"
  | "fibonacci-recursive"
  | "hash-lookup";

export interface AlgorithmInfo {
  key: AlgorithmKey;
  name: string;
  complexity: ComplexityClass;
  description: string;
  /** Hard cap on n so the browser never freezes (exponential algorithms). */
  maxN: number;
  /** Max n for which the step-through recorder is enabled. */
  maxStepN: number;
  requiresSorted?: boolean;
}

export const ALGORITHMS: AlgorithmInfo[] = [
  { key: "constant-index", name: "Array index lookup", complexity: "O(1)", description: "Read one element by position. The cost does not change with array size.", maxN: 1_000_000, maxStepN: 16 },
  { key: "hash-lookup", name: "Hash table lookup", complexity: "O(1)", description: "Look up a key in a hash table (a Python dict / JS Map). Average case is constant.", maxN: 1_000_000, maxStepN: 16 },
  { key: "linear-search", name: "Linear search", complexity: "O(n)", description: "Check each element in turn until the target is found. Worst case visits every element.", maxN: 1_000_000, maxStepN: 24 },
  { key: "binary-search", name: "Binary search", complexity: "O(log n)", description: "On sorted data, halve the search window each step.", maxN: 1_000_000, maxStepN: 32, requiresSorted: true },
  { key: "bubble-sort", name: "Bubble sort", complexity: "O(n^2)", description: "Repeatedly swap adjacent out-of-order elements.", maxN: 5_000, maxStepN: 10 },
  { key: "insertion-sort", name: "Insertion sort", complexity: "O(n^2)", description: "Insert each element into the sorted prefix. Fast on nearly-sorted data.", maxN: 5_000, maxStepN: 10 },
  { key: "merge-sort", name: "Merge sort", complexity: "O(n log n)", description: "Split in halves, sort each, merge. Predictable at any input.", maxN: 500_000, maxStepN: 10 },
  { key: "nested-pairs", name: "All pairs comparison", complexity: "O(n^2)", description: "Compare every element with every other element (e.g. find duplicates naively).", maxN: 5_000, maxStepN: 8 },
  { key: "fibonacci-recursive", name: "Naive recursive Fibonacci", complexity: "O(2^n)", description: "Recompute the same sub-problems over and over. Doubles work with each +1 to n.", maxN: 28, maxStepN: 6 },
];

export const ALGORITHM_BY_KEY = new Map(ALGORITHMS.map((a) => [a.key, a]));

/** Deterministic pseudo-random generator so experiments are reproducible. */
export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function makeArray(n: number, seed = 42, sorted = false): number[] {
  const rng = makeRng(seed);
  const arr = Array.from({ length: n }, () => Math.floor(rng() * n * 4));
  if (sorted) arr.sort((a, b) => a - b);
  return arr;
}

export function theoreticalOps(c: ComplexityClass, n: number): number {
  switch (c) {
    case "O(1)":
      return 1;
    case "O(log n)":
      return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
    case "O(n)":
      return n;
    case "O(n log n)":
      return Math.ceil(n * Math.log2(Math.max(2, n)));
    case "O(n^2)":
      return n * n;
    case "O(2^n)":
      return Math.pow(2, n);
  }
}

export function runAlgorithm(key: AlgorithmKey, n: number, seed = 42, record = false): AlgorithmRun {
  const info = ALGORITHM_BY_KEY.get(key)!;
  const size = Math.min(Math.max(1, Math.floor(n)), info.maxN);
  const steps: Step[] = [];
  const rec = record && size <= info.maxStepN;
  let ops = 0;
  let result = "";
  const t0 = performance.now();

  switch (key) {
    case "constant-index": {
      const arr = makeArray(size, seed);
      const i = Math.floor(size / 2);
      ops = 1;
      result = `arr[${i}] = ${arr[i]}`;
      if (rec) steps.push({ focus: [i], note: `Jump straight to index ${i}. One operation regardless of n=${size}.`, array: arr });
      break;
    }
    case "hash-lookup": {
      const arr = makeArray(size, seed);
      const map = new Map<number, number>();
      arr.forEach((v, i) => map.set(v, i));
      const target = arr[Math.floor(size / 3)];
      ops = 1;
      result = `key ${target} -> index ${map.get(target)}`;
      if (rec) steps.push({ focus: [map.get(target)!], note: `Hash the key ${target}, go to its bucket. ~1 operation.`, array: arr });
      break;
    }
    case "linear-search": {
      const arr = makeArray(size, seed);
      const target = arr[size - 1];
      let found = -1;
      for (let i = 0; i < arr.length; i++) {
        ops++;
        if (rec) steps.push({ focus: [i], note: `Compare arr[${i}]=${arr[i]} with target ${target}`, array: i === 0 ? arr : undefined });
        if (arr[i] === target) {
          found = i;
          break;
        }
      }
      result = `target ${target} found at index ${found} (worst case: last element)`;
      break;
    }
    case "binary-search": {
      const arr = makeArray(size, seed, true);
      const target = arr[Math.floor(size * 0.73)];
      let lo = 0;
      let hi = arr.length - 1;
      let found = -1;
      while (lo <= hi) {
        ops++;
        const mid = Math.floor((lo + hi) / 2);
        if (rec) steps.push({ focus: [mid], range: [lo, hi], note: `Window [${lo}, ${hi}], check middle index ${mid} (${arr[mid]}) against ${target}`, array: ops === 1 ? arr : undefined });
        if (arr[mid] === target) {
          found = mid;
          break;
        }
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid - 1;
      }
      result = `target ${target} found at index ${found} in ${ops} comparisons`;
      break;
    }
    case "bubble-sort": {
      const arr = makeArray(size, seed);
      if (rec) steps.push({ focus: [], note: "Start", array: [...arr] });
      for (let i = 0; i < arr.length; i++) {
        let swapped = false;
        for (let j = 0; j < arr.length - 1 - i; j++) {
          ops++;
          if (arr[j] > arr[j + 1]) {
            [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            swapped = true;
            if (rec) steps.push({ focus: [j, j + 1], note: `Swap ${arr[j + 1]} and ${arr[j]}`, array: [...arr] });
          } else if (rec) steps.push({ focus: [j, j + 1], note: `Compare ${arr[j]} <= ${arr[j + 1]}: no swap` });
        }
        if (!swapped) break;
      }
      result = `sorted ${size} elements`;
      break;
    }
    case "insertion-sort": {
      const arr = makeArray(size, seed);
      if (rec) steps.push({ focus: [], note: "Start", array: [...arr] });
      for (let i = 1; i < arr.length; i++) {
        const key = arr[i];
        let j = i - 1;
        ops++;
        while (j >= 0 && arr[j] > key) {
          ops++;
          arr[j + 1] = arr[j];
          j--;
          if (rec) steps.push({ focus: [j + 1, i], note: `Shift ${arr[j + 1]} right to make room for ${key}`, array: [...arr] });
        }
        arr[j + 1] = key;
        if (rec) steps.push({ focus: [j + 1], note: `Place ${key} at index ${j + 1}`, array: [...arr] });
      }
      result = `sorted ${size} elements`;
      break;
    }
    case "merge-sort": {
      const arr = makeArray(size, seed);
      const merge = (a: number[], b: number[]): number[] => {
        const out: number[] = [];
        let i = 0;
        let j = 0;
        while (i < a.length && j < b.length) {
          ops++;
          if (a[i] <= b[j]) out.push(a[i++]);
          else out.push(b[j++]);
        }
        while (i < a.length) out.push(a[i++]);
        while (j < b.length) out.push(b[j++]);
        if (rec) steps.push({ focus: [], note: `Merge [${a.join(",")}] + [${b.join(",")}] -> [${out.join(",")}]`, array: out });
        return out;
      };
      const sort = (a: number[]): number[] => {
        if (a.length <= 1) return a;
        const mid = Math.floor(a.length / 2);
        if (rec) steps.push({ focus: [], note: `Split [${a.join(",")}] into halves` });
        return merge(sort(a.slice(0, mid)), sort(a.slice(mid)));
      };
      sort(arr);
      result = `sorted ${size} elements`;
      break;
    }
    case "nested-pairs": {
      const arr = makeArray(size, seed);
      let dups = 0;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          ops++;
          if (arr[i] === arr[j]) dups++;
          if (rec) steps.push({ focus: [i, j], note: `Compare arr[${i}] with arr[${j}]`, array: i === 0 && j === 1 ? arr : undefined });
        }
      }
      result = `${dups} duplicate pairs found`;
      break;
    }
    case "fibonacci-recursive": {
      const fib = (k: number, depth: number): number => {
        ops++;
        if (rec) steps.push({ focus: [depth], note: `fib(${k}) called at depth ${depth}` });
        if (k < 2) return k;
        return fib(k - 1, depth + 1) + fib(k - 2, depth + 1);
      };
      result = `fib(${size}) = ${fib(size, 0)}`;
      break;
    }
  }

  const elapsedMs = performance.now() - t0;
  return { key, n: size, operations: ops, elapsedMs, result, steps };
}

export function growthTable(key: AlgorithmKey, sizes: number[], seed = 42) {
  const info = ALGORITHM_BY_KEY.get(key)!;
  return sizes
    .filter((s) => s <= info.maxN)
    .map((n) => {
      const r = runAlgorithm(key, n, seed);
      return { n, operations: r.operations, elapsedMs: r.elapsedMs, theoretical: theoreticalOps(info.complexity, n) };
    });
}

export const COMPLEXITY_ORDER: ComplexityClass[] = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n^2)", "O(2^n)"];
