import type { BigOMission } from "../../domain/types";

export const bigoMissions: BigOMission[] = [
  {
    id: "bigo-01-growth",
    kind: "bigo",
    trackId: "algorithms",
    stage: 1,
    title: "How work grows: O(1), O(n) and O(n²)",
    summary: "Run instrumented algorithms with different input sizes and watch operation counts grow.",
    briefing: "Nimbus Freight's dispatcher looks up a vehicle by scanning a list of 50 vehicles. It is fine today. The fleet is growing to 50,000. Before anyone writes code, measure how three approaches scale.",
    objectives: [
      "Run linear search at n = 100, 1,000 and 10,000 and observe that operations grow in step with n",
      "Run the all-pairs comparison at n = 100 and n = 1,000 and observe quadratic growth",
      "Predict the complexity class of each algorithm after experimenting",
    ],
    skills: ["algorithms.thinking", "algorithms.bigo"],
    prerequisites: [],
    estimatedMinutes: 15,
    lesson: [
      {
        title: "Counting operations, not seconds",
        body: "Big O describes how the number of basic steps grows as the input size n grows. We count steps (comparisons, visits) because seconds depend on the machine, the browser, and what else is running. The lab shows both: **operations** (theory) and **elapsed time** (measurement) so you can see they are related but not the same.",
      },
      {
        title: "The classes you will meet most",
        body: "- **O(1)** constant: the same work no matter how big n is (array index, hash lookup).\n- **O(n)** linear: work grows in step with n (scan a list once).\n- **O(n²)** quadratic: work grows with n squared (compare every pair). Doubling n means 4x the work.",
      },
      {
        title: "Why it matters in operations",
        body: "A quadratic job that takes 1 second on 1,000 records takes about 100 seconds on 10,000 and nearly 3 hours on 100,000. Systems that 'suddenly' fall over at scale often hide an O(n²) loop.",
      },
    ],
    glossary: [
      { term: "input size (n)", definition: "How many items the algorithm processes, e.g. the number of vehicles." },
      { term: "basic operation", definition: "A single step we count: a comparison, a visit, a swap." },
      { term: "Big O", definition: "A notation for the growth rate of work as n grows, ignoring constant factors." },
    ],
    hints: [
      { level: 1, title: "Change one thing", body: "Keep the algorithm fixed and change only n. Compare the operation counts, not the milliseconds." },
      { level: 2, title: "Ratios", body: "When n goes 100 -> 1,000 (10x), linear work goes about 10x; quadratic work goes about 100x." },
      { level: 3, title: "Constant time", body: "Array index lookup always reports the same operation count. That is O(1)." },
      { level: 4, title: "Guided example", body: "Run 'Linear search' at 100, 1000, 10000 and note the counts (~100, ~1000, ~10000). Run 'All pairs comparison' at 100 and 1000 (~4,950 then ~499,500). Then answer: linear search = O(n), all pairs = O(n^2), array index = O(1)." },
    ],
    reflectionPrompts: ["Explain, with the numbers you measured, why the dispatcher's list scan will become a problem at 50,000 vehicles."],
    transferNote: "Interviewers ask 'what is the complexity of your approach?' constantly. Being able to answer with evidence beats guessing.",
    tasks: [
      { id: "exp-linear", label: "Run linear search at n >= 10,000", type: "experiment", prompt: "Run Linear search three times with n = 100, 1,000 and 10,000. Watch the operations column.", algorithms: ["linear-search"], minInputSize: 10000, explanation: "The worst-case linear search visits every element, so the count equals n." },
      { id: "exp-pairs", label: "Run all-pairs comparison at n >= 1,000", type: "experiment", prompt: "Run All pairs comparison with n = 100, then n = 1,000.", algorithms: ["nested-pairs"], minInputSize: 1000, explanation: "There are n(n-1)/2 pairs, which grows like n²: 10x more items means ~100x more work." },
      { id: "pred-linear", label: "Predict: linear search", type: "predict", prompt: "What is the time complexity of linear search?", algorithms: ["linear-search"], expected: "O(n)", explanation: "Each element may need to be checked once: O(n)." },
      { id: "pred-pairs", label: "Predict: all pairs comparison", type: "predict", prompt: "What is the time complexity of comparing every pair of elements?", algorithms: ["nested-pairs"], expected: "O(n^2)", explanation: "Nested loops over the same list: O(n²)." },
      { id: "pred-index", label: "Predict: array index lookup", type: "predict", prompt: "What is the time complexity of reading arr[i]?", algorithms: ["constant-index"], expected: "O(1)", explanation: "The memory address is computed directly: O(1)." },
    ],
  },
  {
    id: "bigo-02-search-sort",
    kind: "bigo",
    trackId: "algorithms",
    stage: 2,
    title: "Logarithms and sorting: picking the right algorithm",
    summary: "Compare binary vs linear search, and bubble vs merge sort, with step-through and measured counts.",
    briefing: "The vehicle table is now sorted by ID. A teammate says 'sorted data means we can search in a handful of steps'. Verify that claim, then decide which sorting algorithm the nightly job should use for 500,000 records.",
    objectives: [
      "Step through binary search on a small array and explain why the window halves",
      "Compare binary and linear search at n = 1,000,000",
      "Compare bubble sort and merge sort at n = 2,000 and predict their classes",
    ],
    skills: ["algorithms.search", "algorithms.sorting", "algorithms.optimization"],
    prerequisites: ["bigo-01-growth"],
    estimatedMinutes: 20,
    lesson: [
      {
        title: "O(log n): halving",
        body: "Binary search checks the middle of a **sorted** array. If the target is smaller, discard the right half; otherwise discard the left half. Each step halves the remaining window, so 1,000,000 items need only about 20 steps (2^20 ≈ 1,000,000). That is O(log n). The catch: the data must already be sorted.",
      },
      {
        title: "O(n log n): divide and merge",
        body: "Merge sort splits the list in half repeatedly (log n levels) and merges each level in linear time (n work per level): O(n log n). Bubble sort and insertion sort compare neighbours over and over: O(n²) in the worst case. Insertion sort is still great for nearly-sorted data.",
      },
      {
        title: "Theory vs measurement",
        body: "Elapsed time includes JavaScript overhead, memory allocation and whatever else the browser is doing. Use the operation count to classify, and the elapsed time to sanity-check. Never report a single timing as proof.",
      },
    ],
    glossary: [
      { term: "logarithm (log n)", definition: "How many times you can halve n before reaching 1. log2(1,000,000) ≈ 20." },
      { term: "divide and conquer", definition: "Split a problem into smaller copies of itself, solve them, combine the results." },
      { term: "worst case", definition: "The input that makes the algorithm do the most work; Big O usually describes it." },
    ],
    hints: [
      { level: 1, title: "Use step-through", body: "Set n to 16 or less for binary search and press Step. Watch the highlighted window shrink." },
      { level: 2, title: "Big n", body: "At n = 1,000,000 binary search should report around 20 operations; linear search around 1,000,000." },
      { level: 3, title: "Sorting", body: "At n = 2,000, bubble sort does roughly 2,000,000 comparisons; merge sort about 20,000." },
      { level: 4, title: "Guided example", body: "Binary search: O(log n). Linear search: O(n). Bubble sort: O(n²). Merge sort: O(n log n). For 500,000 nightly records choose merge sort (or the language's built-in sort, which is also O(n log n))." },
    ],
    reflectionPrompts: ["A teammate proposes bubble sort because 'it is simpler'. Using your measurements, explain the tradeoff and your recommendation."],
    transferNote: "Choosing O(n log n) over O(n²) is the difference between a nightly job finishing in seconds versus not finishing at all.",
    tasks: [
      { id: "exp-binary", label: "Run binary search at n >= 100,000", type: "experiment", prompt: "Run Binary search at n = 1,000,000 (or at least 100,000) and note the operation count.", algorithms: ["binary-search"], minInputSize: 100000, explanation: "Halving a million-element window takes about 20 comparisons." },
      { id: "cmp-search", label: "Compare binary vs linear search", type: "compare", prompt: "Run both searches at the same n and compare operations.", algorithms: ["binary-search", "linear-search"], explanation: "Linear search does n operations; binary does log2(n)." },
      { id: "exp-sort", label: "Run bubble sort and merge sort at n >= 2,000", type: "experiment", prompt: "Run Bubble sort and Merge sort at n = 2,000.", algorithms: ["bubble-sort", "merge-sort"], minInputSize: 2000, explanation: "Quadratic vs n log n: the gap widens quickly as n grows." },
      { id: "pred-binary", label: "Predict: binary search", type: "predict", prompt: "What is the time complexity of binary search on sorted data?", algorithms: ["binary-search"], expected: "O(log n)", explanation: "The window halves each step." },
      { id: "pred-merge", label: "Predict: merge sort", type: "predict", prompt: "What is the time complexity of merge sort?", algorithms: ["merge-sort"], expected: "O(n log n)", explanation: "log n levels of splitting, n work per level." },
      { id: "pred-bubble", label: "Predict: bubble sort (worst case)", type: "predict", prompt: "What is the worst-case time complexity of bubble sort?", algorithms: ["bubble-sort"], expected: "O(n^2)", explanation: "Nested passes over the list." },
    ],
  },
];
