import type { JsDrill } from "./jsDrills";

/**
 * The JavaScript lab's DOM, testing and server drills. DOM drills run a
 * script against a fixture page in the worker's DOM (linkedom: standard DOM
 * APIs; no layout or styles; the capture phase and form validity APIs are
 * not modelled), and their tests call resetDom() so each starts from the
 * fixture. The testing drill runs the learner's own test file three ways.
 * The server drills call a request handler directly: no sockets.
 */

const SHIPMENTS_TABLE = `<table id="shipments">
  <thead>
    <tr><th>Id</th><th>Destination</th><th>Due</th><th></th></tr>
  </thead>
  <tbody>
    <tr class="row" data-id="S-100" data-due="2026-10-01">
      <td>S-100</td>
      <td>Leeds</td>
      <td>2026-10-01</td>
      <td><button class="details">Details</button></td>
    </tr>
    <tr class="row" data-id="S-101" data-due="2026-10-20">
      <td>S-101</td>
      <td>Bristol</td>
      <td>2026-10-20</td>
      <td><button class="details">Details</button></td>
    </tr>
    <tr class="row" data-id="S-102" data-due="2026-09-28">
      <td>S-102</td>
      <td>York</td>
      <td>2026-09-28</td>
      <td><button class="details">Details</button></td>
    </tr>
  </tbody>
</table>`;

const PARCELS_TABLE = `<table id="parcels">
  <tbody>
    <tr data-id="P-1"><td>P-1</td><td><button class="remove">Remove</button></td></tr>
    <tr data-id="P-2"><td>P-2</td><td><button class="remove">Remove</button></td></tr>
  </tbody>
</table>
<a id="export" href="/export.csv">Export</a>`;

const BOOKING_FORM = `<form id="booking" novalidate>
  <label for="dest">Destination</label>
  <input id="dest" name="destination">
  <p id="dest-error" class="error" hidden></p>
  <label for="weight">Weight (kg)</label>
  <input id="weight" name="weight">
  <p id="weight-error" class="error" hidden></p>
  <button type="submit">Book</button>
</form>
<p id="status" role="status"></p>`;

const SHIP_BUGGY = `export function boxesNeeded(weightKg, maxPerBoxKg) {
  return Math.floor(weightKg / maxPerBoxKg) + 1;
}

export function notifyIfSplit(weightKg, maxPerBoxKg, notify) {
  const boxes = boxesNeeded(weightKg, maxPerBoxKg);
  if (boxes > 1) notify(boxes);
  return boxes;
}
`;

const SHIP_FIXED = `export function boxesNeeded(weightKg, maxPerBoxKg) {
  if (!(maxPerBoxKg > 0)) throw new RangeError("maxPerBoxKg must be above 0");
  return Math.ceil(weightKg / maxPerBoxKg);
}

export function notifyIfSplit(weightKg, maxPerBoxKg, notify) {
  const boxes = boxesNeeded(weightKg, maxPerBoxKg);
  if (boxes > 1) notify(boxes);
  return boxes;
}
`;

/** Prefix for the server drill's tests: call the handler with a JSON body and parse the reply. */
const CALL = `const call = async (method, path, body) => {
  const res = await handle({ method, path, headers: { "content-type": "application/json" }, body: body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body) });
  let json = null;
  try { json = JSON.parse(res.body); } catch {}
  return { ...res, json };
};
`;

const runAgainst = (shipJs: string) => `await runSuite({ "ship.js": ${JSON.stringify(shipJs)}, "ship.test.js": $source["ship.test.js"] }, "ship.test.js")`;

export const MORE_JS_DRILLS: JsDrill[] = [
  {
    id: "dom-01-traverse",
    group: "The DOM",
    title: "Selecting and traversing the DOM",
    brief: "The page has a table of shipments. markOverdue(today) should add the class 'overdue' to every body row due before today, keeping the class the rows already have, and return their ids. rowOf(button) should return the table row a Details button sits in. destinationOf(id) should return the destination text of that shipment's row, or null when there is none. The starter overwrites classes, stops one level short of the row, and walks into a whitespace text node.",
    teaches: "querySelector and querySelectorAll take CSS selectors, so '#shipments tbody tr' skips the header row. closest walks up to the nearest ancestor that matches, which is sturdier than counting parentElement steps. children holds only elements; childNodes, firstChild and nextSibling include the text nodes the indentation in the HTML creates. classList.add keeps existing classes; assigning className replaces them.",
    dom: SHIPMENTS_TABLE,
    starter: `function markOverdue(today) {
  const ids = [];
  for (const row of document.querySelectorAll("#shipments tbody tr")) {
    if (row.dataset.due < today) {
      row.className = "overdue";
      ids.push(row.dataset.id);
    }
  }
  return ids;
}

function rowOf(button) {
  return button.parentElement;
}

function destinationOf(id) {
  const row = document.querySelector(\`tr[data-id="\${id}"]\`);
  return row.firstChild.nextSibling.textContent;
}

markOverdue("2026-10-05");
`,
    solution: `function markOverdue(today) {
  const overdue = [...document.querySelectorAll("#shipments tbody tr")].filter((row) => row.dataset.due < today);
  for (const row of overdue) row.classList.add("overdue");
  return overdue.map((row) => row.dataset.id);
}

function rowOf(button) {
  return button.closest("tr");
}

function destinationOf(id) {
  const row = document.querySelector(\`#shipments tr[data-id="\${id}"]\`);
  return row ? row.children[1].textContent.trim() : null;
}

markOverdue("2026-10-05");
`,
    tests: [
      { id: "overdue", label: "markOverdue returns S-100 and S-102", code: 'resetDom();\nassertEqual(markOverdue("2026-10-05"), ["S-100", "S-102"])' },
      { id: "classes", label: "overdue rows keep their existing class", code: 'resetDom();\nmarkOverdue("2026-10-05");\nassertEqual($$("tr.overdue").map((r) => r.className), ["row overdue", "row overdue"])' },
      { id: "row", label: "rowOf finds the button's row", code: 'resetDom();\nassertEqual(rowOf($$(".details")[1])?.dataset?.id, "S-101")' },
      { id: "destination", label: "destinationOf reads the second cell, or null", code: 'resetDom();\nassertEqual(destinationOf("S-101"), "Bristol");\nassertEqual(destinationOf("S-999"), null, "an unknown id should give null")' },
    ],
    hints: [
      "className = 'overdue' replaces 'row'; classList.add('overdue') adds to it. The parentElement of the button is its cell, not its row.",
      "button.closest('tr') walks up to the row. row.children[1] is the second cell; row.firstChild is the whitespace before the first cell.",
      "markOverdue: classList.add('overdue'); rowOf: return button.closest('tr'); destinationOf: return row ? row.children[1].textContent.trim() : null;",
    ],
  },
  {
    id: "dom-02-render",
    group: "The DOM",
    title: "Creating, changing and removing nodes",
    brief: "render(shipments) should fill the empty list with one item per shipment, 'S-1 to Leeds', each with a data-id, and set the count line to '2 shipments' (or '1 shipment'). Rendering again must replace the list, not add to it. removeShipment(id) should remove that item and update the count. One destination in the tests is an attack: it must show as text and never become an element. The starter builds HTML strings with innerHTML.",
    teaches: "createElement plus textContent builds nodes whose text is always text, so data can never inject markup; innerHTML parses whatever it is given, which is how cross-site scripting gets in. replaceChildren swaps a node's contents in one step, and element.remove() takes a node out of the page, where emptying it leaves a blank element behind.",
    dom: `<ul id="list"></ul>
<p id="count"></p>`,
    starter: `function render(shipments) {
  const list = document.getElementById("list");
  for (const s of shipments) {
    list.innerHTML += \`<li data-id="\${s.id}">\${s.id} to \${s.destination}</li>\`;
  }
  document.getElementById("count").innerHTML = shipments.length + " shipments";
}

function removeShipment(id) {
  document.querySelector(\`#list li[data-id="\${id}"]\`).innerHTML = "";
}

render([{ id: "S-1", destination: "Leeds" }, { id: "S-2", destination: "Hull" }]);
`,
    solution: `function setCount() {
  const n = document.querySelectorAll("#list li").length;
  document.getElementById("count").textContent = \`\${n} shipment\${n === 1 ? "" : "s"}\`;
}

function render(shipments) {
  const items = shipments.map((s) => {
    const li = document.createElement("li");
    li.dataset.id = s.id;
    li.textContent = \`\${s.id} to \${s.destination}\`;
    return li;
  });
  document.getElementById("list").replaceChildren(...items);
  setCount();
}

function removeShipment(id) {
  document.querySelector(\`#list li[data-id="\${id}"]\`)?.remove();
  setCount();
}

render([{ id: "S-1", destination: "Leeds" }, { id: "S-2", destination: "Hull" }]);
`,
    tests: [
      { id: "twice", label: "rendering twice replaces the list", code: 'resetDom();\nconst data = [{ id: "S-1", destination: "Leeds" }, { id: "S-2", destination: "Hull" }];\nrender(data);\nrender(data);\nassertEqual($$("#list li").map((li) => li.dataset.id), ["S-1", "S-2"])' },
      { id: "text", label: "a hostile destination stays text", code: 'resetDom();\nrender([{ id: "S-9", destination: \'<img src=x onerror="alert(1)">\' }]);\nassertEqual([$$("#list img").length, $("#list li")?.textContent], [0, \'S-9 to <img src=x onerror="alert(1)">\'])' },
      { id: "count", label: "the count line says '2 shipments'", code: 'resetDom();\nrender([{ id: "S-1", destination: "Leeds" }, { id: "S-2", destination: "Hull" }]);\nassertEqual($("#count").textContent, "2 shipments")' },
      { id: "remove", label: "removeShipment removes the item and updates the count", code: 'resetDom();\nrender([{ id: "S-1", destination: "Leeds" }, { id: "S-2", destination: "Hull" }]);\nremoveShipment("S-2");\nassertEqual([$$("#list li").map((li) => li.dataset.id), $("#count").textContent], [["S-1"], "1 shipment"])' },
    ],
    hints: [
      "innerHTML += adds to what is there and parses the destination as HTML. Build each li with document.createElement and set its textContent.",
      "list.replaceChildren(...items) replaces the contents; li.remove() takes the item out; set the count with textContent.",
      "Map the shipments to li elements (dataset.id, textContent), call replaceChildren on the list, then set the count text; removeShipment calls .remove() on the li and recounts.",
    ],
  },
  {
    id: "dom-03-delegation",
    group: "The DOM",
    title: "Events: bubbling, delegation and preventDefault",
    brief: "wire() should make every Remove button remove its whole row, including rows added later with addRow(id), using one listener on the table body. Clicking elsewhere in a row removes nothing. The Export link should log 'export requested' and stop the browser following the link. The starter puts a listener on each existing button, removes only the cell, and lets the link navigate.",
    teaches: "A click on a button travels up through every ancestor (bubbling), so one listener on a container can handle all its buttons, including ones added later: that is event delegation, and event.target.closest(selector) finds which button was hit. preventDefault stops the browser's default action, such as following a link or submitting a form. This lab's DOM does not model the capture phase, which runs down the tree before bubbling.",
    dom: PARCELS_TABLE,
    starter: `// Adds a row like the others (the page uses it; do not change it).
function addRow(id) {
  const tr = document.createElement("tr");
  tr.dataset.id = id;
  tr.innerHTML = \`<td>\${id}</td><td><button class="remove">Remove</button></td>\`;
  document.querySelector("#parcels tbody").append(tr);
}

function wire() {
  for (const button of document.querySelectorAll(".remove")) {
    button.addEventListener("click", () => button.parentElement.remove());
  }
  document.getElementById("export").addEventListener("click", () => {
    console.log("export requested");
  });
}
`,
    solution: `// Adds a row like the others (the page uses it; do not change it).
function addRow(id) {
  const tr = document.createElement("tr");
  tr.dataset.id = id;
  tr.innerHTML = \`<td>\${id}</td><td><button class="remove">Remove</button></td>\`;
  document.querySelector("#parcels tbody").append(tr);
}

function wire() {
  document.querySelector("#parcels tbody").addEventListener("click", (event) => {
    const button = event.target.closest(".remove");
    if (button) button.closest("tr").remove();
  });
  document.getElementById("export").addEventListener("click", (event) => {
    event.preventDefault();
    console.log("export requested");
  });
}
`,
    tests: [
      { id: "existing", label: "Remove takes out the whole row", code: 'resetDom();\nwire();\nclick(\'tr[data-id="P-1"] .remove\');\nassertEqual($$("#parcels tbody tr").map((r) => r.dataset.id), ["P-2"])' },
      { id: "later", label: "rows added after wire() can be removed too", code: 'resetDom();\nwire();\naddRow("P-9");\nclick(\'tr[data-id="P-9"] .remove\');\nassertEqual($$("#parcels tbody tr").map((r) => r.dataset.id), ["P-1", "P-2"], "a row added after wire() should still be removable")' },
      { id: "elsewhere", label: "clicking a cell removes nothing", code: 'resetDom();\nwire();\nclick(\'tr[data-id="P-2"] td\');\nassertEqual($$("#parcels tbody tr").length, 2)' },
      { id: "export", label: "Export is handled without following the link", code: 'resetDom();\nwire();\nassert(click("#export").defaultPrevented, "call event.preventDefault() in the link\'s listener")' },
    ],
    hints: [
      "Listeners on the existing buttons know nothing about rows added later. Listen on the tbody instead: clicks on its buttons bubble up to it.",
      "In the tbody listener, event.target.closest('.remove') is the button (or null) and .closest('tr') is its row. The link's listener calls event.preventDefault().",
      "tbody.addEventListener('click', (event) => { const button = event.target.closest('.remove'); if (button) button.closest('tr').remove(); }); and event.preventDefault() in the export listener.",
    ],
  },
  {
    id: "dom-04-form",
    group: "The DOM",
    title: "Form validation the accessible way",
    brief: "wireForm(onBook) should handle the booking form's submit: stop the browser submitting it, check the destination is not blank and the weight is a number above 0, and for each problem mark the field aria-invalid='true', point aria-describedby at its error paragraph and show the error text. Fixed fields lose those marks. When everything is valid, call onBook({ destination, weightKg }) with the destination trimmed and the weight as a number, and announce 'Booked: ...' in the status region. The starter shows nothing a screen reader or a sighted user would notice.",
    teaches: "A submit listener must call preventDefault or the browser navigates away. Errors need to be visible (the hidden attribute removed) and tied to their field: aria-invalid tells assistive technology the field is wrong, aria-describedby makes it read the error text, and a role='status' region announces the outcome without moving focus. Input values are always strings: trim them and convert numbers explicitly. This lab's DOM has no built-in validity API, so the checks are written in code, which is what custom messages need anyway.",
    dom: BOOKING_FORM,
    starter: `function wireForm(onBook) {
  const form = document.getElementById("booking");
  form.addEventListener("submit", () => {
    const destination = document.getElementById("dest").value;
    const weightKg = Number(document.getElementById("weight").value);
    if (!destination) document.getElementById("dest-error").textContent = "Enter a destination";
    if (!weightKg) document.getElementById("weight-error").textContent = "Enter a weight";
    if (destination && weightKg) onBook({ destination, weightKg });
  });
}
`,
    solution: `function setError(input, message) {
  const error = document.getElementById(\`\${input.id}-error\`);
  if (message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", error.id);
    error.textContent = message;
    error.hidden = false;
  } else {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
    error.textContent = "";
    error.hidden = true;
  }
}

function wireForm(onBook) {
  document.getElementById("booking").addEventListener("submit", (event) => {
    event.preventDefault();
    const dest = document.getElementById("dest");
    const weight = document.getElementById("weight");
    const destination = dest.value.trim();
    const weightKg = Number(weight.value);
    const weightOk = weight.value.trim() !== "" && weightKg > 0;
    setError(dest, destination ? "" : "Enter a destination");
    setError(weight, weightOk ? "" : "Enter a weight above 0 kg");
    if (destination && weightOk) {
      onBook({ destination, weightKg });
      document.getElementById("status").textContent = \`Booked: \${destination}, \${weightKg} kg\`;
    }
  });
}
`,
    tests: [
      { id: "prevent", label: "the form does not submit to the browser", code: 'resetDom();\nwireForm(() => {});\nassert(submit("#booking").defaultPrevented, "call event.preventDefault() in the submit listener")' },
      { id: "errors", label: "invalid fields are marked and described, errors visible", code: 'resetDom();\nwireForm(() => {});\ntype("#weight", "-3");\nsubmit("#booking");\nassertEqual([$("#dest").getAttribute("aria-invalid"), $("#dest").getAttribute("aria-describedby"), $("#dest-error").hidden, $("#dest-error").textContent.length > 0, $("#weight").getAttribute("aria-invalid")], ["true", "dest-error", false, true, "true"])' },
      { id: "books", label: "a valid booking is passed on and announced", code: 'resetDom();\nconst booked = [];\nwireForm((b) => booked.push(b));\ntype("#dest", "  Leeds ");\ntype("#weight", "12");\nsubmit("#booking");\nassertEqual(booked, [{ destination: "Leeds", weightKg: 12 }]);\nassert($("#status").textContent.includes("Leeds"), "announce the booking in the status region")' },
      { id: "clears", label: "fixing a field clears its error", code: 'resetDom();\nwireForm(() => {});\nsubmit("#booking");\ntype("#dest", "York");\ntype("#weight", "2");\nsubmit("#booking");\nassertEqual([$("#dest").getAttribute("aria-invalid"), $("#dest-error").hidden], [null, true])' },
    ],
    hints: [
      "Start the listener with event.preventDefault(). The error paragraphs start hidden, so setting their text is not enough.",
      "Write one setError(input, message) that sets or removes aria-invalid and aria-describedby and shows or hides the error, and call it for both fields on every submit.",
      "setError(input, message) toggles aria-invalid, aria-describedby, the error text and hidden; the submit listener prevents the default, trims, converts the weight, calls setError for both fields, then onBook and the status text when both are valid.",
    ],
  },
  {
    id: "dom-05-disclosure",
    group: "The DOM",
    title: "An accessible show/hide control",
    brief: "The 'Show filters' control is a div with a click handler: a keyboard cannot reach it, and a screen reader does not know it is a control or whether it is open. enhance() should replace it with a real <button type='button'> with the same id and text, aria-controls='filters' and aria-expanded='false', hide the filters with the hidden attribute, and toggle both aria-expanded and hidden on each click.",
    teaches: "Native elements carry their behaviour: a button is focusable, works with Enter and Space and is announced as a button, none of which a div with a click handler does. aria-expanded tells assistive technology whether the thing it controls is open, aria-controls says which thing that is, and the hidden attribute removes content for everyone, not just visually.",
    dom: `<div class="toggle" id="toggle">Show filters</div>
<div id="filters">
  <label><input type="checkbox" name="late"> Late only</label>
</div>`,
    starter: `function enhance() {
  const toggle = document.getElementById("toggle");
  const filters = document.getElementById("filters");
  filters.setAttribute("style", "display: none");
  toggle.addEventListener("click", () => {
    const open = filters.getAttribute("style") === "display: block";
    filters.setAttribute("style", open ? "display: none" : "display: block");
  });
}

enhance();
`,
    solution: `function enhance() {
  const old = document.getElementById("toggle");
  const filters = document.getElementById("filters");
  const button = document.createElement("button");
  button.setAttribute("type", "button");
  button.id = "toggle";
  button.textContent = old.textContent;
  button.setAttribute("aria-controls", "filters");
  button.setAttribute("aria-expanded", "false");
  filters.hidden = true;
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    filters.hidden = open;
  });
  old.replaceWith(button);
}

enhance();
`,
    tests: [
      { id: "button", label: "the control is a real button with the same text", code: 'resetDom();\nenhance();\nconst b = $("#toggle");\nassertEqual([b.tagName, b.getAttribute("type"), b.textContent.trim()], ["BUTTON", "button", "Show filters"])' },
      { id: "state", label: "starts closed: aria-expanded false, filters hidden", code: 'resetDom();\nenhance();\nassertEqual([$("#toggle").getAttribute("aria-expanded"), $("#toggle").getAttribute("aria-controls"), $("#filters").hidden], ["false", "filters", true])' },
      { id: "toggle", label: "each click toggles both", code: 'resetDom();\nenhance();\nclick("#toggle");\nconst opened = [$("#toggle").getAttribute("aria-expanded"), $("#filters").hidden];\nclick("#toggle");\nassertEqual([opened, [$("#toggle").getAttribute("aria-expanded"), $("#filters").hidden]], [["true", false], ["false", true]])' },
      { id: "nodiv", label: "no clickable div is left", code: 'resetDom();\nenhance();\nassertEqual($$("div.toggle").length, 0, "a div with a click handler is not reachable by keyboard; replace it with a button")' },
    ],
    hints: [
      "Create a button with document.createElement('button'), copy the id and text, and put it where the div was with old.replaceWith(button).",
      "Set aria-controls='filters' and aria-expanded='false' and filters.hidden = true; on click, flip aria-expanded and hidden together.",
      "const button = document.createElement('button'); button.setAttribute('type', 'button'); button.id = 'toggle'; button.textContent = old.textContent; set the two aria attributes, hide the filters, add a click listener that flips both, then old.replaceWith(button).",
    ],
  },
  {
    id: "test-01-reproduce",
    group: "Testing",
    title: "Write the test that catches the bug, then fix it",
    brief: "A customer with a 10 kg parcel and a 5 kg box limit was charged for three boxes. In ship.test.js, write tests with test(name, fn) and expect(...) that fail on the current ship.js because of that bug, including one that uses mock() to check that notifyIfSplit calls notify with the box count only when the parcel is split. Then fix ship.js; a box limit of 0 or less should also throw a RangeError. Your tests are checked three ways: they must fail on the original ship.js, pass on a correct one, and pass on your fix.",
    teaches: "A bug report becomes a test first: a failing test proves you reproduced it and stops it coming back. Good tests name a behaviour, cover the edges (an exact multiple, zero, an invalid limit) and use a mock to check a call your code makes to something else. This lab's test(), expect() and mock() follow Jest's shape (toBe, toEqual, toThrow, toHaveBeenCalledWith, .not, .resolves, .rejects) without being Jest.",
    starterFiles: {
      "ship.test.js": `import { boxesNeeded, notifyIfSplit } from "./ship.js";

test("one box when the parcel fits", () => {
  expect(boxesNeeded(3, 5)).toBe(1);
});
`,
      "ship.js": SHIP_BUGGY,
    },
    solutionFiles: {
      "ship.test.js": `import { boxesNeeded, notifyIfSplit } from "./ship.js";

test("one box when the parcel fits", () => {
  expect(boxesNeeded(3, 5)).toBe(1);
});

test("an exact multiple needs no extra box", () => {
  expect(boxesNeeded(10, 5)).toBe(2);
});

test("anything over a multiple needs one more box", () => {
  expect(boxesNeeded(11, 5)).toBe(3);
});

test("a box limit of 0 is refused", () => {
  expect(() => boxesNeeded(4, 0)).toThrow(RangeError);
});

test("notify hears about a split, with the box count", () => {
  const notify = mock();
  notifyIfSplit(10, 5, notify);
  expect(notify).toHaveBeenCalledWith(2);
});

test("notify stays quiet when one box is enough", () => {
  const notify = mock();
  notifyIfSplit(3, 5, notify);
  expect(notify).not.toHaveBeenCalled();
});
`,
      "ship.js": SHIP_FIXED,
    },
    entry: "ship.test.js",
    suite: true,
    tests: [
      { id: "count", label: "at least three of your tests ran", code: 'assert(suiteResults().length >= 3, suiteResults().length + " test(s) registered: write at least three")' },
      { id: "catches", label: "your tests fail on the original ship.js", code: `const r = ${runAgainst(SHIP_BUGGY)};\nassert(r.length > 0 && r.some((t) => !t.passed), "none of your tests fails on the original ship.js, so they do not reproduce the bug")` },
      { id: "agree", label: "your tests pass on a correct ship.js", code: `const r = ${runAgainst(SHIP_FIXED)};\nassertEqual(r.filter((t) => !t.passed).map((t) => t.name + ": " + t.error), [], "these tests fail even on a correct implementation")` },
      { id: "fixed", label: "your ship.js passes your tests", code: 'const own = suiteResults();\nassert(own.length > 0 && own.every((t) => t.passed), "fix ship.js until your own tests pass")' },
      { id: "right", label: "the fix is right (exact multiples, zero, a bad limit)", code: 'const { boxesNeeded } = modules["ship.js"];\nassertEqual([boxesNeeded(3, 5), boxesNeeded(10, 5), boxesNeeded(11, 5), boxesNeeded(0, 5)], [1, 2, 3, 0]);\nassertThrows(() => boxesNeeded(4, 0), RangeError)' },
      { id: "mock", label: "a test uses mock()", code: 'assert(/\\bmock\\(/.test($source["ship.test.js"]), "check notifyIfSplit with a mock: const notify = mock(); ... expect(notify).toHaveBeenCalledWith(2)")' },
    ],
    hints: [
      "Reproduce the report first: test('an exact multiple needs no extra box', () => expect(boxesNeeded(10, 5)).toBe(2)) fails on the original ship.js. Run it and watch it fail.",
      "Floor plus one is wrong on exact multiples and for zero; Math.ceil is the rule. Guard the limit with if (!(maxPerBoxKg > 0)) throw new RangeError(...). For the mock: const notify = mock(); notifyIfSplit(10, 5, notify); expect(notify).toHaveBeenCalledWith(2).",
      "Tests: fits (3, 5) is 1; exact multiple (10, 5) is 2; over (11, 5) is 3; a limit of 0 throws RangeError; notify is called with 2 for (10, 5) and not at all for (3, 5). Fix: guard the limit and return Math.ceil(weightKg / maxPerBoxKg).",
    ],
  },
  {
    id: "node-01-handler",
    group: "Server",
    title: "A JSON endpoint: routes, validation and status codes",
    brief: "handle(req) receives { method, path, headers, body } and returns { status, headers, body }, the shape server frameworks give a request handler. GET /health should return 200 with { ok: true, env }, where env comes from process.env.APP_ENV (this run sets it to 'staging'). POST /shipments should validate a JSON body (a non-blank destination, a positive weightKg) and return 201 with the stored shipment and its new id, or 400 with { error } for bad JSON or bad fields. GET /shipments/:id returns the shipment or 404. Other methods on /shipments get 405, unknown paths 404. Every reply is JSON with a content-type header. The starter trusts its input.",
    teaches: "An endpoint's contract is its status codes: 201 for something created, 400 when the client sent something wrong, 404 when the thing is not there, 405 when the method is not allowed, and a JSON body with an error message in each failure case. Never trust a request body: parse it inside try/catch and check every field. Configuration such as the environment name comes from process.env, so the same code runs everywhere. There are no sockets here: the lab calls the handler directly.",
    env: { APP_ENV: "staging" },
    starter: `const shipments = new Map();
let nextId = 1;

async function handle(req) {
  if (req.path === "/health") return { status: 200, headers: {}, body: "ok" };
  const data = JSON.parse(req.body);
  const id = \`S-\${nextId++}\`;
  shipments.set(id, data);
  return { status: 200, headers: {}, body: JSON.stringify({ id, ...data }) };
}
`,
    solution: `const shipments = new Map();
let nextId = 1;

const json = (status, data, headers = {}) => ({
  status,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(data),
});

async function handle(req) {
  const { method, path } = req;
  if (path === "/health" && method === "GET") {
    return json(200, { ok: true, env: process.env.APP_ENV ?? "development" });
  }
  if (path === "/shipments") {
    if (method !== "POST") return json(405, { error: "method not allowed" }, { allow: "POST" });
    let data;
    try {
      data = JSON.parse(req.body);
    } catch {
      return json(400, { error: "body must be JSON" });
    }
    if (typeof data?.destination !== "string" || !data.destination.trim()) return json(400, { error: "destination is required" });
    if (typeof data.weightKg !== "number" || !(data.weightKg > 0)) return json(400, { error: "weightKg must be a positive number" });
    const shipment = { id: \`S-\${nextId++}\`, destination: data.destination.trim(), weightKg: data.weightKg };
    shipments.set(shipment.id, shipment);
    return json(201, shipment);
  }
  const match = /^\\/shipments\\/([\\w-]+)$/.exec(path);
  if (match && method === "GET") {
    const shipment = shipments.get(match[1]);
    return shipment ? json(200, shipment) : json(404, { error: \`no shipment \${match[1]}\` });
  }
  return json(404, { error: \`no route \${method} \${path}\` });
}
`,
    tests: [
      { id: "health", label: "GET /health is JSON with the environment", code: `${CALL}const r = await call("GET", "/health");\nassertEqual([r.status, r.headers?.["content-type"], r.json], [200, "application/json", { ok: true, env: "staging" }])` },
      { id: "create", label: "POST /shipments creates (201) and GET reads it back", code: `${CALL}const r = await call("POST", "/shipments", { destination: "Leeds", weightKg: 12 });\nassertEqual([r.status, r.json?.destination, typeof r.json?.id], [201, "Leeds", "string"]);\nconst back = await call("GET", "/shipments/" + r.json.id);\nassertEqual([back.status, back.json], [200, r.json])` },
      { id: "badjson", label: "a body that is not JSON gets 400 with an error", code: `${CALL}const r = await call("POST", "/shipments", "{not json");\nassertEqual([r.status, typeof r.json?.error], [400, "string"])` },
      { id: "invalid", label: "a blank destination or a negative weight gets 400", code: `${CALL}const a = await call("POST", "/shipments", { destination: " ", weightKg: 2 });\nconst b = await call("POST", "/shipments", { destination: "York", weightKg: -1 });\nassertEqual([a.status, b.status], [400, 400])` },
      { id: "routes", label: "405 for a wrong method, 404 for unknown ids and paths", code: `${CALL}const r = await call("DELETE", "/shipments");\nconst m = await call("GET", "/shipments/S-999");\nconst u = await call("GET", "/nowhere");\nassertEqual([r.status, m.status, u.status], [405, 404, 404])` },
    ],
    hints: [
      "A small json(status, data) helper that sets the content-type header and stringifies the body keeps every branch honest.",
      "Route on method and path first; parse the body inside try/catch and return 400 on failure; check destination and weightKg before storing; read process.env.APP_ENV for /health.",
      "Branches in order: GET /health is 200; /shipments: anything but POST is 405, bad JSON 400, bad fields 400, otherwise store and return 201; GET /shipments/:id is 200 or 404; anything else 404.",
    ],
  },
  {
    id: "node-02-race",
    group: "Server",
    title: "Two requests at once: a race at the await",
    brief: "reserve(req) takes { sku, qty } and reserves stock in db, the lab's async datastore, where every call takes about 10 ms. Run on its own it is correct. But two requests for the last five boxes arriving together both read 5, both pass the check and both reserve: the stock is sold twice. Make reservations for the same product happen one at a time, while reservations for different products still run in parallel.",
    teaches: "Node runs your JavaScript on one thread, yet two requests still interleave: each await hands control to whatever is ready next, so a read, an await, then a write is a race whenever another request can run in between. The fixes are an atomic operation in the datastore (a conditional update) or serialising work on the same key, for example by chaining each reservation onto the previous one's promise. A single global lock would also be correct, but it makes every product wait for every other.",
    store: true,
    starter: `// db is the lab's simulated datastore: every call takes about 10 ms.
async function reserve(req) {
  const { sku, qty } = JSON.parse(req.body);
  const stock = (await db.get(\`stock:\${sku}\`)) ?? 0;
  if (stock < qty) return { status: 409, body: JSON.stringify({ error: "not enough stock" }) };
  await db.set(\`stock:\${sku}\`, stock - qty);
  return { status: 200, body: JSON.stringify({ sku, reserved: qty, left: stock - qty }) };
}
`,
    solution: `// db is the lab's simulated datastore: every call takes about 10 ms.
const queues = new Map();

// Run fn after every earlier task for the same key has finished.
function oneAtATime(key, fn) {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  queues.set(key, run.catch(() => {}));
  return run;
}

async function reserve(req) {
  const { sku, qty } = JSON.parse(req.body);
  return oneAtATime(sku, async () => {
    const stock = (await db.get(\`stock:\${sku}\`)) ?? 0;
    if (stock < qty) return { status: 409, body: JSON.stringify({ error: "not enough stock" }) };
    await db.set(\`stock:\${sku}\`, stock - qty);
    return { status: 200, body: JSON.stringify({ sku, reserved: qty, left: stock - qty }) };
  });
}
`,
    tests: [
      { id: "alone", label: "one request at a time works", code: 'await db.set("stock:BOX-M", 3);\nconst req = { body: JSON.stringify({ sku: "BOX-M", qty: 2 }) };\nconst a = await reserve(req);\nconst b = await reserve(req);\nassertEqual([a.status, b.status, await db.get("stock:BOX-M")], [200, 409, 1])' },
      { id: "lastfive", label: "two requests for the last five: one wins, one gets 409", code: 'await db.set("stock:BOX-S", 5);\nconst req = { body: JSON.stringify({ sku: "BOX-S", qty: 5 }) };\nconst results = await Promise.all([reserve(req), reserve(req)]);\nassertEqual([results.map((r) => r.status).sort(), await db.get("stock:BOX-S")], [[200, 409], 0], "both requests read the same stock before either wrote")' },
      { id: "many", label: "ten requests for seven boxes: exactly seven succeed", code: 'await db.set("stock:BOX-L", 7);\nconst results = await Promise.all(Array.from({ length: 10 }, () => reserve({ body: JSON.stringify({ sku: "BOX-L", qty: 1 }) })));\nassertEqual([results.filter((r) => r.status === 200).length, await db.get("stock:BOX-L")], [7, 0])' },
      { id: "parallel", label: "different products do not wait for each other", code: 'await db.set("stock:A", 1);\nawait db.set("stock:B", 1);\nconst t0 = Date.now();\nawait Promise.all([reserve({ body: JSON.stringify({ sku: "A", qty: 1 }) }), reserve({ body: JSON.stringify({ sku: "B", qty: 1 }) })]);\nconst took = Date.now() - t0;\nassert(took < 35, "took " + took + " ms: two products one after the other take about 40, in parallel about 20")' },
    ],
    hints: [
      "Between db.get and db.set there is an await: the second request runs its db.get there and sees the same stock.",
      "Keep a Map from sku to the promise of the last reservation for that sku, and start each new one with .then on it, so same-sku reservations queue and different skus do not.",
      "function oneAtATime(key, fn) { const previous = queues.get(key) ?? Promise.resolve(); const run = previous.then(fn, fn); queues.set(key, run.catch(() => {})); return run; } and wrap reserve's body in oneAtATime(sku, async () => { ... }).",
    ],
  },
];
