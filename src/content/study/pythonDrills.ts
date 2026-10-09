/**
 * Python drills: short exercises that run in the real Python runtime, each
 * checked by assertions executed in the learner's namespace. Each drill
 * teaches one idea from the Python course; the tests are the contract, the
 * starter fails at least one of them, and `solution` is the reference the
 * tests run. Nothing is simulated: the interpreter's own results decide.
 */
export interface PythonDrill {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  starter: string;
  tests: Array<{ id: string; label: string; code: string }>;
  hints: string[];
  solution: string;
}

export const PYTHON_DRILLS: PythonDrill[] = [
  {
    id: "py-01-truthiness",
    title: "Truthiness and operators",
    brief: "Write classify(cpu, disk_free_gb, tags) returning 'idle' when cpu is below 10, 'hot' when cpu is 80 or more, 'full' when disk_free_gb is under 5 (full beats hot), and 'ok' otherwise; and has_tags(tags) returning True only when tags is a non-empty list. The starter compares with the wrong operators and tests tags against None only.",
    teaches: "Comparison operators chain and combine with and / or / not; precedence puts not before and before or. An empty list, empty string, 0 and None are all false in a condition, which is what makes `if tags:` the Python way to ask whether there is anything in it.",
    starter: `def classify(cpu, disk_free_gb, tags):
    if cpu > 10:
        return "idle"
    if disk_free_gb < 5 or cpu >= 80:
        return "hot"
    return "ok"

def has_tags(tags):
    return tags != None
`,
    tests: [
      { id: "idle", label: "classify(3, 50, []) == 'idle'", code: "assert classify(3, 50, []) == 'idle', f'got {classify(3, 50, [])!r}'" },
      { id: "hot", label: "classify(85, 50, []) == 'hot'", code: "assert classify(85, 50, []) == 'hot', f'got {classify(85, 50, [])!r}'" },
      { id: "full", label: "classify(85, 2, []) == 'full' (full beats hot)", code: "assert classify(85, 2, []) == 'full', f'got {classify(85, 2, [])!r}'" },
      { id: "ok", label: "classify(50, 50, []) == 'ok'", code: "assert classify(50, 50, []) == 'ok', f'got {classify(50, 50, [])!r}'" },
      { id: "tags", label: "has_tags([]) is False, has_tags(['a']) is True, has_tags(None) is False", code: "assert has_tags([]) is False and has_tags(['a']) is True and has_tags(None) is False" },
    ],
    hints: ["'idle' is cpu < 10, not cpu > 10. Check 'full' before 'hot' so it wins.", "An empty list is false: `return bool(tags)` handles [] and None alike.", "def classify(cpu, disk_free_gb, tags):\n    if cpu < 10: return 'idle'\n    if disk_free_gb < 5: return 'full'\n    if cpu >= 80: return 'hot'\n    return 'ok'\n\ndef has_tags(tags):\n    return bool(tags)"],
    solution: `def classify(cpu, disk_free_gb, tags):
    if cpu < 10:
        return "idle"
    if disk_free_gb < 5:
        return "full"
    if cpu >= 80:
        return "hot"
    return "ok"

def has_tags(tags):
    return bool(tags)
`,
  },
  {
    id: "py-02-arguments",
    title: "Positional, keyword, *args and **kwargs",
    brief: "Write build_command(program, *args, sudo=False, **env) returning the command line as a string: the program, then each argument, each separated by one space; prefixed with 'sudo ' when sudo is true; and with every env entry as KEY=value before the program, in the order given. The starter takes a fixed number of arguments.",
    teaches: "A parameter list reads left to right: positional parameters, then *args collecting extra positional values into a tuple, then keyword-only parameters with defaults, then **kwargs collecting extra keyword arguments into a dict. Callers can pass what they have; the function sees a clean shape.",
    starter: `def build_command(program, arg1, arg2):
    return program + " " + arg1 + " " + arg2
`,
    tests: [
      { id: "plain", label: "build_command('ls', '-l', '/tmp') == 'ls -l /tmp'", code: "assert build_command('ls', '-l', '/tmp') == 'ls -l /tmp', f'got {build_command(\"ls\", \"-l\", \"/tmp\")!r}'" },
      { id: "none", label: "build_command('uptime') == 'uptime'", code: "assert build_command('uptime') == 'uptime', f'got {build_command(\"uptime\")!r}'" },
      { id: "sudo", label: "sudo=True prefixes 'sudo '", code: "assert build_command('systemctl', 'restart', 'api', sudo=True) == 'sudo systemctl restart api'" },
      { id: "env", label: "env entries come first as KEY=value", code: "assert build_command('python', 'app.py', PORT='8080', DEBUG='1') == 'PORT=8080 DEBUG=1 python app.py'" },
      { id: "both", label: "env and sudo together", code: "assert build_command('make', sudo=True, CC='gcc') == 'CC=gcc sudo make'" },
    ],
    hints: ["def build_command(program, *args, sudo=False, **env): args is a tuple, env a dict.", "Build a list of parts: env pairs, then 'sudo' if asked, then the program, then the args; return ' '.join(parts).", "def build_command(program, *args, sudo=False, **env):\n    parts = [f'{k}={v}' for k, v in env.items()]\n    if sudo: parts.append('sudo')\n    parts.append(program)\n    parts.extend(args)\n    return ' '.join(parts)"],
    solution: `def build_command(program, *args, sudo=False, **env):
    parts = [f"{k}={v}" for k, v in env.items()]
    if sudo:
        parts.append("sudo")
    parts.append(program)
    parts.extend(args)
    return " ".join(parts)
`,
  },
  {
    id: "py-03-closures",
    title: "Scope and closures",
    brief: "Write make_counter(start=0) returning a function that adds one each time it is called and returns the new count; two counters must not share state. The starter uses a global, so every counter counts the same thing and the inner function cannot assign to it anyway.",
    teaches: "Names resolve Local, Enclosing, Global, Built-in. A nested function can read a variable of the function that made it; to assign to it, declare it nonlocal, otherwise the assignment creates a new local. The inner function keeps the enclosing variable alive after the outer one returns: that is a closure, and each call to the outer function makes a fresh one.",
    starter: `count = 0

def make_counter(start=0):
    count = start
    def next_count():
        count = count + 1
        return count
    return next_count
`,
    tests: [
      { id: "counts", label: "c = make_counter(); c(); c() == 2", code: "c = make_counter()\nassert c() == 1\nassert c() == 2, 'the second call must return 2'" },
      { id: "start", label: "make_counter(10)() == 11", code: "assert make_counter(10)() == 11" },
      { id: "independent", label: "two counters do not share state", code: "a = make_counter()\nb = make_counter()\na(); a()\nassert b() == 1, 'b must start from its own 0'\nassert a() == 3" },
    ],
    hints: ["The assignment inside next_count makes count a new local, so reading it first fails. Declare which variable you mean.", "nonlocal count inside next_count assigns to the enclosing variable.", "def make_counter(start=0):\n    count = start\n    def next_count():\n        nonlocal count\n        count += 1\n        return count\n    return next_count"],
    solution: `def make_counter(start=0):
    count = start
    def next_count():
        nonlocal count
        count += 1
        return count
    return next_count
`,
  },
  {
    id: "py-04-recursion",
    title: "Recursion with a base case",
    brief: "Write flatten(value) that turns arbitrarily nested lists into one flat list, leaving non-list items as they are, and depth(value) returning how many levels of list nesting there are (0 for a non-list, 1 for a flat list). The starter only goes one level down.",
    teaches: "A recursive function handles the smallest case directly (the base case) and reduces every other case to a smaller one of the same shape. Here the base case is an item that is not a list; the recursive case flattens each element and joins the results. Each level is a frame on the call stack, which is why very deep nesting hits a recursion limit.",
    starter: `def flatten(value):
    result = []
    for item in value:
        if isinstance(item, list):
            result.extend(item)
        else:
            result.append(item)
    return result

def depth(value):
    return 1 if isinstance(value, list) else 0
`,
    tests: [
      { id: "flat", label: "flatten([1, [2, 3]]) == [1, 2, 3]", code: "assert flatten([1, [2, 3]]) == [1, 2, 3]" },
      { id: "deep", label: "flatten([1, [2, [3, [4]]], 5]) == [1, 2, 3, 4, 5]", code: "assert flatten([1, [2, [3, [4]]], 5]) == [1, 2, 3, 4, 5], f'got {flatten([1, [2, [3, [4]]], 5])}'" },
      { id: "empty", label: "flatten([]) == [] and flatten([[], [[]]]) == []", code: "assert flatten([]) == [] and flatten([[], [[]]]) == []" },
      { id: "depth", label: "depth(3) == 0, depth([1]) == 1, depth([1, [2, [3]]]) == 3", code: "assert depth(3) == 0 and depth([1]) == 1 and depth([1, [2, [3]]]) == 3, f'got {depth(3)}, {depth([1])}, {depth([1, [2, [3]]])}'" },
      { id: "depthempty", label: "depth([]) == 1", code: "assert depth([]) == 1" },
    ],
    hints: ["When an item is itself a list, flatten it the same way: result.extend(flatten(item)).", "depth of a list is 1 + the greatest depth among its items (0 when it has none).", "def flatten(value):\n    if not isinstance(value, list): return [value]\n    result = []\n    for item in value: result.extend(flatten(item))\n    return result\n\ndef depth(value):\n    if not isinstance(value, list): return 0\n    return 1 + max((depth(item) for item in value), default=0)"],
    solution: `def flatten(value):
    if not isinstance(value, list):
        return [value]
    result = []
    for item in value:
        result.extend(flatten(item))
    return result

def depth(value):
    if not isinstance(value, list):
        return 0
    return 1 + max((depth(item) for item in value), default=0)
`,
  },
  {
    id: "py-05-mutable-default",
    title: "The mutable default argument",
    brief: "add_tag(tag, tags=[]) is meant to return a new list of tags with one added, defaulting to a fresh empty list. As written, every call without a list shares the same list, so the second call returns both tags. Fix it without changing how callers use it.",
    teaches: "Default values are evaluated once, when the def runs, so a mutable default (a list, a dict) is one object shared by every call that relies on it. The idiom is a None default and a fresh object inside the function.",
    starter: `def add_tag(tag, tags=[]):
    tags.append(tag)
    return tags
`,
    tests: [
      { id: "first", label: "add_tag('a') == ['a']", code: "assert add_tag('a') == ['a']" },
      { id: "second", label: "a second call without a list starts fresh: add_tag('b') == ['b']", code: "assert add_tag('b') == ['b'], f'got {add_tag(\"c\")!r}: the default list is shared'" },
      { id: "given", label: "add_tag('x', ['y']) == ['y', 'x']", code: "assert add_tag('x', ['y']) == ['y', 'x']" },
      { id: "signature", label: "the default is None, not a list", code: "import inspect\nassert inspect.signature(add_tag).parameters['tags'].default is None, 'use tags=None'" },
    ],
    hints: ["The default list is created once and reused; look at what the second call returns.", "tags=None, then `if tags is None: tags = []`.", "def add_tag(tag, tags=None):\n    if tags is None:\n        tags = []\n    tags.append(tag)\n    return tags"],
    solution: `def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags
`,
  },
  {
    id: "py-06-slicing",
    title: "Lists, slices and tuples",
    brief: "Write every_other(items) returning every second item starting with the first, last_n(items, n) returning the last n items (all of them when n is larger), reversed_copy(items) returning a reversed copy without changing the original, and endpoint(host, port) returning an immutable pair usable as a dictionary key. The starter mutates its input and returns a list where a tuple is needed.",
    teaches: "A slice items[start:stop:step] makes a new list; negative indexes count from the end, so items[-3:] is the last three and items[::-1] is a reversed copy. list.reverse() changes the list in place and returns None, a common surprise. A tuple is an immutable sequence, which is why it can be a dictionary key and a list cannot.",
    starter: `def every_other(items):
    return items[1::2]

def last_n(items, n):
    return items[n:]

def reversed_copy(items):
    items.reverse()
    return items

def endpoint(host, port):
    return [host, port]
`,
    tests: [
      { id: "every", label: "every_other([1, 2, 3, 4, 5]) == [1, 3, 5]", code: "assert every_other([1, 2, 3, 4, 5]) == [1, 3, 5], f'got {every_other([1, 2, 3, 4, 5])}'" },
      { id: "last", label: "last_n([1, 2, 3, 4], 2) == [3, 4] and last_n([1, 2], 5) == [1, 2]", code: "assert last_n([1, 2, 3, 4], 2) == [3, 4] and last_n([1, 2], 5) == [1, 2], f'got {last_n([1, 2, 3, 4], 2)} and {last_n([1, 2], 5)}'" },
      { id: "reversed", label: "reversed_copy leaves the original alone", code: "orig = [1, 2, 3]\nassert reversed_copy(orig) == [3, 2, 1]\nassert orig == [1, 2, 3], 'the original was changed'" },
      { id: "tuple", label: "endpoint('db', 5432) is a tuple and works as a dict key", code: "e = endpoint('db', 5432)\nassert isinstance(e, tuple) and e == ('db', 5432)\nd = {e: 'primary'}\nassert d[('db', 5432)] == 'primary'" },
    ],
    hints: ["items[::2] starts at index 0 with step 2; items[-n:] is the last n.", "items[::-1] is a new reversed list; a tuple literal is (host, port).", "def every_other(items): return items[::2]\ndef last_n(items, n): return items[-n:]\ndef reversed_copy(items): return items[::-1]\ndef endpoint(host, port): return (host, port)"],
    solution: `def every_other(items):
    return items[::2]

def last_n(items, n):
    return items[-n:]

def reversed_copy(items):
    return items[::-1]

def endpoint(host, port):
    return (host, port)
`,
  },
  {
    id: "py-07-sets",
    title: "Sets: membership and set algebra",
    brief: "Two inventories list hostnames, with duplicates. Write shared(a, b) returning the sorted hosts present in both, only_in(a, b) returning the sorted hosts in a but not in b, and is_known(host, inventory) answering membership. The starter uses nested loops that count duplicates twice and keep order by accident.",
    teaches: "A set holds each value once and answers membership in constant time; and (&), or (|) and minus (-) between sets are intersection, union and difference. Converting a list to a set also removes duplicates. Sets have no order, so sort when the order matters.",
    starter: `def shared(a, b):
    result = []
    for x in a:
        for y in b:
            if x == y:
                result.append(x)
    return result

def only_in(a, b):
    return [x for x in a if x not in b]

def is_known(host, inventory):
    return host in inventory
`,
    tests: [
      { id: "shared", label: "shared(['b', 'a', 'a'], ['a', 'c', 'b', 'a']) == ['a', 'b']", code: "assert shared(['b', 'a', 'a'], ['a', 'c', 'b', 'a']) == ['a', 'b'], f'got {shared([\"b\", \"a\", \"a\"], [\"a\", \"c\", \"b\", \"a\"])}'" },
      { id: "only", label: "only_in(['x', 'y', 'y', 'z'], ['y']) == ['x', 'z']", code: "assert only_in(['x', 'y', 'y', 'z'], ['y']) == ['x', 'z'], f'got {only_in([\"x\", \"y\", \"y\", \"z\"], [\"y\"])}'" },
      { id: "known", label: "is_known works with a list or a set", code: "assert is_known('a', ['a', 'b']) is True and is_known('q', {'a', 'b'}) is False" },
      { id: "sets", label: "shared and only_in use set operations (fast for large inventories)", code: "import time\nbig_a = [f'h{i}' for i in range(20000)]\nbig_b = [f'h{i}' for i in range(10000, 30000)]\nt0 = time.time()\nr = shared(big_a, big_b)\nassert len(r) == 10000\nassert time.time() - t0 < 1.0, 'too slow: use sets, not nested loops'" },
    ],
    hints: ["set(a) & set(b) is the intersection; sorted(...) gives the order the tests expect.", "set(a) - set(b) is the difference.", "def shared(a, b): return sorted(set(a) & set(b))\ndef only_in(a, b): return sorted(set(a) - set(b))\ndef is_known(host, inventory): return host in set(inventory)"],
    solution: `def shared(a, b):
    return sorted(set(a) & set(b))

def only_in(a, b):
    return sorted(set(a) - set(b))

def is_known(host, inventory):
    return host in set(inventory)
`,
  },
  {
    id: "py-08-comprehensions",
    title: "Comprehensions over nested data",
    brief: "records is a list of dicts like {'host': 'web-01', 'region': 'north', 'cpu': 42}. Write hot_hosts(records, threshold) returning the sorted names of hosts at or above the threshold, cpu_by_host(records) returning a dict from host to cpu, and total_by_region(records) returning a dict from region to the sum of cpu. The starter builds everything with append and leaves a bug in the region totals.",
    teaches: "A comprehension builds a list, dict or set from an iterable in one expression: [x.f for x in xs if cond], {k: v for ...}, {x for ...}. Nested data is just dicts inside lists: index with the key you need, and accumulate with dict.get(key, 0) or a defaultdict.",
    starter: `def hot_hosts(records, threshold):
    result = []
    for r in records:
        if r["cpu"] > threshold:
            result.append(r["host"])
    return result

def cpu_by_host(records):
    result = {}
    for r in records:
        result[r["host"]] = r["cpu"]
    return result

def total_by_region(records):
    result = {}
    for r in records:
        result[r["region"]] = r["cpu"]
    return result
`,
    tests: [
      { id: "hot", label: "hot_hosts at or above the threshold, sorted", code: "recs = [{'host': 'b', 'region': 'n', 'cpu': 80}, {'host': 'a', 'region': 's', 'cpu': 95}, {'host': 'c', 'region': 'n', 'cpu': 10}]\nassert hot_hosts(recs, 80) == ['a', 'b'], f'got {hot_hosts(recs, 80)}'" },
      { id: "byhost", label: "cpu_by_host maps host to cpu", code: "recs = [{'host': 'b', 'region': 'n', 'cpu': 80}, {'host': 'a', 'region': 's', 'cpu': 95}]\nassert cpu_by_host(recs) == {'b': 80, 'a': 95}" },
      { id: "region", label: "total_by_region sums per region", code: "recs = [{'host': 'b', 'region': 'n', 'cpu': 80}, {'host': 'a', 'region': 's', 'cpu': 95}, {'host': 'c', 'region': 'n', 'cpu': 10}]\nassert total_by_region(recs) == {'n': 90, 's': 95}, f'got {total_by_region(recs)}'" },
      { id: "empty", label: "all three handle an empty list", code: "assert hot_hosts([], 1) == [] and cpu_by_host([]) == {} and total_by_region([]) == {}" },
    ],
    hints: ["hot_hosts: sorted(r['host'] for r in records if r['cpu'] >= threshold).", "total_by_region: result[r['region']] = result.get(r['region'], 0) + r['cpu'].", "def hot_hosts(records, threshold): return sorted(r['host'] for r in records if r['cpu'] >= threshold)\ndef cpu_by_host(records): return {r['host']: r['cpu'] for r in records}\ndef total_by_region(records):\n    totals = {}\n    for r in records: totals[r['region']] = totals.get(r['region'], 0) + r['cpu']\n    return totals"],
    solution: `def hot_hosts(records, threshold):
    return sorted(r["host"] for r in records if r["cpu"] >= threshold)

def cpu_by_host(records):
    return {r["host"]: r["cpu"] for r in records}

def total_by_region(records):
    totals = {}
    for r in records:
        totals[r["region"]] = totals.get(r["region"], 0) + r["cpu"]
    return totals
`,
  },
  {
    id: "py-09-classes",
    title: "A class with state, methods and dunder methods",
    brief: "Write class Server with __init__(self, name, cpu), a method is_hot(self, threshold=80) returning whether cpu is at or above the threshold, __repr__ returning Server(name='web-01', cpu=42), __eq__ comparing by name only, and a class attribute count that counts how many servers have been created. The starter stores the values on the class instead of the instance.",
    teaches: "self is the instance; attributes assigned through self belong to that instance, attributes assigned in the class body are shared by all of them. Dunder methods plug into the language: __repr__ is what the shell and the debugger show, __eq__ decides what == means, and __len__, __str__, __lt__ follow the same pattern.",
    starter: `class Server:
    name = ""
    cpu = 0

    def __init__(self, name, cpu):
        Server.name = name
        Server.cpu = cpu

    def is_hot(self, threshold=80):
        return self.cpu > threshold
`,
    tests: [
      { id: "instance", label: "two servers keep their own name and cpu", code: "a = Server('web-01', 42)\nb = Server('db-01', 90)\nassert a.name == 'web-01' and a.cpu == 42, f'got {a.name!r}, {a.cpu!r}: attributes must live on the instance'" },
      { id: "hot", label: "is_hot: 80 is hot at the default threshold; 42 is not", code: "assert Server('x', 80).is_hot() is True and Server('y', 42).is_hot() is False and Server('z', 42).is_hot(40) is True" },
      { id: "repr", label: "repr(Server('web-01', 42)) == \"Server(name='web-01', cpu=42)\"", code: "assert repr(Server('web-01', 42)) == \"Server(name='web-01', cpu=42)\", f'got {repr(Server(\"web-01\", 42))!r}'" },
      { id: "eq", label: "equality is by name", code: "assert Server('web-01', 1) == Server('web-01', 99)\nassert Server('web-01', 1) != Server('web-02', 1)" },
      { id: "count", label: "Server.count counts instances", code: "before = Server.count\nServer('p', 1); Server('q', 2)\nassert Server.count == before + 2, 'increment a class attribute in __init__'" },
    ],
    hints: ["self.name = name stores it on the instance; Server.name = name overwrites a shared class attribute.", "__repr__ returns a string; __eq__(self, other) returns self.name == other.name; count = 0 in the class body and Server.count += 1 in __init__.", "class Server:\n    count = 0\n    def __init__(self, name, cpu):\n        self.name = name\n        self.cpu = cpu\n        Server.count += 1\n    def is_hot(self, threshold=80):\n        return self.cpu >= threshold\n    def __repr__(self):\n        return f\"Server(name={self.name!r}, cpu={self.cpu})\"\n    def __eq__(self, other):\n        return isinstance(other, Server) and self.name == other.name"],
    solution: `class Server:
    count = 0

    def __init__(self, name, cpu):
        self.name = name
        self.cpu = cpu
        Server.count += 1

    def is_hot(self, threshold=80):
        return self.cpu >= threshold

    def __repr__(self):
        return f"Server(name={self.name!r}, cpu={self.cpu})"

    def __eq__(self, other):
        return isinstance(other, Server) and self.name == other.name
`,
  },
  {
    id: "py-10-inheritance",
    title: "Inheritance, overriding and super()",
    brief: "class Service has __init__(self, name) and describe() returning 'NAME: service'. Write class WebService(Service) whose __init__(self, name, port) calls the parent's __init__ and stores port, and whose describe() returns the parent's description followed by ' on port PORT'. Also write class Fleet that holds services by composition: add(service) and describe_all() returning a list of their descriptions. The starter re-implements the parent instead of calling it.",
    teaches: "A subclass inherits everything and overrides what it changes; super() reaches the parent's version so the override extends rather than copies it. Composition (a Fleet that has services) is the alternative when the relationship is 'has a', not 'is a'; prefer it when you need the behaviour without the hierarchy.",
    starter: `class Service:
    def __init__(self, name):
        self.name = name

    def describe(self):
        return f"{self.name}: service"

class WebService(Service):
    def __init__(self, name, port):
        self.name = name.upper()
        self.port = port

    def describe(self):
        return f"{self.name}: service"
`,
    tests: [
      { id: "parent", label: "Service('api').describe() == 'api: service'", code: "assert Service('api').describe() == 'api: service'" },
      { id: "child", label: "WebService('api', 8080).describe() == 'api: service on port 8080'", code: "w = WebService('api', 8080)\nassert w.describe() == 'api: service on port 8080', f'got {w.describe()!r}'\nassert w.name == 'api' and w.port == 8080" },
      { id: "isa", label: "a WebService is a Service", code: "assert isinstance(WebService('a', 1), Service)" },
      { id: "super", label: "WebService.describe reuses Service.describe (a change to the parent shows through)", code: "orig = Service.describe\nService.describe = lambda self: 'patched'\ntry:\n    assert WebService('api', 1).describe() == 'patched on port 1', 'call super().describe() instead of rebuilding the parent string'\nfinally:\n    Service.describe = orig" },
      { id: "fleet", label: "Fleet composes services", code: "f = Fleet()\nf.add(Service('db'))\nf.add(WebService('api', 80))\nassert f.describe_all() == ['db: service', 'api: service on port 80'], f'got {f.describe_all()}'" },
    ],
    hints: ["super().__init__(name) runs the parent's initialiser; then self.port = port.", "describe: return super().describe() + f' on port {self.port}'.", "class Service:\n    def __init__(self, name): self.name = name\n    def describe(self): return f'{self.name}: service'\n\nclass WebService(Service):\n    def __init__(self, name, port):\n        super().__init__(name)\n        self.port = port\n    def describe(self):\n        return super().describe() + f' on port {self.port}'\n\nclass Fleet:\n    def __init__(self): self.services = []\n    def add(self, service): self.services.append(service)\n    def describe_all(self): return [s.describe() for s in self.services]"],
    solution: `class Service:
    def __init__(self, name):
        self.name = name

    def describe(self):
        return f"{self.name}: service"

class WebService(Service):
    def __init__(self, name, port):
        super().__init__(name)
        self.port = port

    def describe(self):
        return super().describe() + f" on port {self.port}"

class Fleet:
    def __init__(self):
        self.services = []

    def add(self, service):
        self.services.append(service)

    def describe_all(self):
        return [s.describe() for s in self.services]
`,
  },
  {
    id: "py-11-generators",
    title: "Iterators and generators",
    brief: "Write batches(items, size), a generator that yields consecutive lists of at most size items, and countdown(n), a generator yielding n, n-1, ... 1. Neither may build the whole result in memory: the tests feed batches an iterator of ten million numbers and read only the first batch. The starter returns lists.",
    teaches: "A function with yield is a generator: calling it returns an iterator that runs lazily, one value at a time, keeping its place between next() calls. That is how Python streams a file or a huge sequence without holding it all. Any object with __iter__ and __next__ is an iterator; for loops only ever ask for the next value.",
    starter: `def batches(items, size):
    items = list(items)
    return [items[i:i + size] for i in range(0, len(items), size)]

def countdown(n):
    return list(range(n, 0, -1))
`,
    tests: [
      { id: "batches", label: "list(batches([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]", code: "assert list(batches([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]], f'got {list(batches([1, 2, 3, 4, 5], 2))}'" },
      { id: "lazy", label: "the first batch of ten million numbers arrives without building them all", code: "import types\ng = batches(iter(range(10_000_000)), 3)\nassert isinstance(g, types.GeneratorType), 'batches must be a generator (use yield)'\nassert next(g) == [0, 1, 2]" },
      { id: "countdown", label: "list(countdown(3)) == [3, 2, 1] and it is a generator", code: "import types\nassert isinstance(countdown(3), types.GeneratorType), 'use yield'\nassert list(countdown(3)) == [3, 2, 1] and list(countdown(0)) == []" },
      { id: "protocol", label: "next() on an exhausted generator raises StopIteration", code: "g = countdown(1)\nnext(g)\ntry:\n    next(g)\n    assert False, 'expected StopIteration'\nexcept StopIteration:\n    pass" },
    ],
    hints: ["Collect items into a list; when it reaches size, yield it and start a new one; yield the remainder at the end if any.", "countdown: while n > 0: yield n; n -= 1.", "def batches(items, size):\n    batch = []\n    for item in items:\n        batch.append(item)\n        if len(batch) == size:\n            yield batch\n            batch = []\n    if batch:\n        yield batch\n\ndef countdown(n):\n    while n > 0:\n        yield n\n        n -= 1"],
    solution: `def batches(items, size):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch

def countdown(n):
    while n > 0:
        yield n
        n -= 1
`,
  },
  {
    id: "py-12-decorators",
    title: "First-class functions and decorators",
    brief: "Write logged(fn), a decorator that records each call as (name, args) in the module-level list CALLS and returns whatever the function returns, and apply_twice(fn, value) that calls fn on value and then on the result. Decorate add(a, b) with @logged. The starter's decorator swallows the return value and forgets to return the wrapper.",
    teaches: "Functions are values: they can be passed in, returned and stored. A decorator is a function that takes a function and returns a replacement, usually a wrapper that does something around the call; @name above a def is just name applied to it. functools.wraps keeps the wrapped function's name and docstring.",
    starter: `CALLS = []

def logged(fn):
    def wrapper(*args, **kwargs):
        CALLS.append((fn.__name__, args))
        fn(*args, **kwargs)

def apply_twice(fn, value):
    return fn(value)

@logged
def add(a, b):
    return a + b
`,
    tests: [
      { id: "returns", label: "add(2, 3) == 5 through the decorator", code: "assert add(2, 3) == 5, f'got {add(2, 3)!r}: the wrapper must return the result'" },
      { id: "records", label: "CALLS records ('add', (2, 3))", code: "CALLS.clear()\nadd(2, 3)\nassert CALLS == [('add', (2, 3))], f'got {CALLS}'" },
      { id: "twice", label: "apply_twice(lambda x: x * 2, 3) == 12", code: "assert apply_twice(lambda x: x * 2, 3) == 12" },
      { id: "name", label: "add keeps its name (functools.wraps)", code: "assert add.__name__ == 'add', f'got {add.__name__!r}: use functools.wraps'" },
    ],
    hints: ["The decorator must return wrapper, and wrapper must return fn(...).", "from functools import wraps; @wraps(fn) above def wrapper keeps the name.", "from functools import wraps\nCALLS = []\ndef logged(fn):\n    @wraps(fn)\n    def wrapper(*args, **kwargs):\n        CALLS.append((fn.__name__, args))\n        return fn(*args, **kwargs)\n    return wrapper\n\ndef apply_twice(fn, value):\n    return fn(fn(value))\n\n@logged\ndef add(a, b):\n    return a + b"],
    solution: `from functools import wraps

CALLS = []

def logged(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        CALLS.append((fn.__name__, args))
        return fn(*args, **kwargs)
    return wrapper

def apply_twice(fn, value):
    return fn(fn(value))

@logged
def add(a, b):
    return a + b
`,
  },
  {
    id: "py-13-typing",
    title: "Type hints and a custom exception",
    brief: "Write parse_port(value: str) -> int that returns the port as an integer when value is a whole number from 1 to 65535 and raises InvalidPort (a subclass of ValueError) with a helpful message otherwise, and parse_ports(values: list[str]) -> list[int]. The starter has no annotations, returns None on bad input and lets non-numeric input crash with the wrong error.",
    teaches: "Type hints document what a function expects and returns, and a checker such as mypy can verify callers against them; they do not change what runs. A custom exception that subclasses a built-in one lets callers catch either the specific error or the family, and catching only the exception you expect (ValueError here) keeps real bugs visible.",
    starter: `def parse_port(value):
    port = int(value)
    if port < 1 or port > 65535:
        return None
    return port

def parse_ports(values):
    return [parse_port(v) for v in values]
`,
    tests: [
      { id: "ok", label: "parse_port('8080') == 8080", code: "assert parse_port('8080') == 8080" },
      { id: "range", label: "parse_port('70000') raises InvalidPort", code: "try:\n    parse_port('70000')\n    assert False, 'expected InvalidPort'\nexcept InvalidPort:\n    pass" },
      { id: "nan", label: "parse_port('eighty') raises InvalidPort, a ValueError", code: "try:\n    parse_port('eighty')\n    assert False, 'expected InvalidPort'\nexcept ValueError as e:\n    assert isinstance(e, InvalidPort), 'InvalidPort must subclass ValueError'" },
      { id: "hints", label: "parse_port is annotated: value: str -> int", code: "a = parse_port.__annotations__\nassert a.get('value') is str and a.get('return') is int, f'annotations: {a}'" },
      { id: "list", label: "parse_ports(['1', '65535']) == [1, 65535]", code: "assert parse_ports(['1', '65535']) == [1, 65535]\nassert 'return' in parse_ports.__annotations__" },
    ],
    hints: ["class InvalidPort(ValueError): pass. Catch the ValueError from int() and raise InvalidPort from it.", "def parse_port(value: str) -> int: ... def parse_ports(values: list[str]) -> list[int]: ...", "class InvalidPort(ValueError):\n    pass\n\ndef parse_port(value: str) -> int:\n    try:\n        port = int(value)\n    except ValueError:\n        raise InvalidPort(f'not a number: {value!r}') from None\n    if not 1 <= port <= 65535:\n        raise InvalidPort(f'out of range: {port}')\n    return port\n\ndef parse_ports(values: list[str]) -> list[int]:\n    return [parse_port(v) for v in values]"],
    solution: `class InvalidPort(ValueError):
    pass

def parse_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError:
        raise InvalidPort(f"not a number: {value!r}") from None
    if not 1 <= port <= 65535:
        raise InvalidPort(f"out of range: {port}")
    return port

def parse_ports(values: list[str]) -> list[int]:
    return [parse_port(v) for v in values]
`,
  },
  {
    id: "py-14-stdlib-files",
    title: "Files, with, and the standard library",
    brief: "Write write_report(path, rows) that writes one line per (host, cpu) pair as 'host,cpu' and returns the number of lines written, read_report(path) that reads them back as a list of (host, int) tuples, and top_hosts(rows, n) returning the n hosts with the highest cpu using the standard library. Use with so the file is closed even on error. The starter forgets to close the file, reads cpu as text, and sorts by host.",
    teaches: "with open(...) as f: is a context manager: the file is closed when the block ends, however it ends. The standard library covers most of what operations code needs: collections.Counter and heapq.nlargest for top-n, datetime for time, os and sys for the environment, itertools for iteration patterns.",
    starter: `def write_report(path, rows):
    f = open(path, "w")
    for host, cpu in rows:
        f.write(f"{host},{cpu}\\n")
    return len(rows)

def read_report(path):
    f = open(path)
    return [tuple(line.strip().split(",")) for line in f]

def top_hosts(rows, n):
    return sorted(rows)[:n]
`,
    tests: [
      { id: "roundtrip", label: "write then read gives (host, int) tuples", code: "rows = [('web-01', 42), ('db-01', 90)]\nassert write_report('/tmp/drill_report.csv', rows) == 2\nassert read_report('/tmp/drill_report.csv') == [('web-01', 42), ('db-01', 90)], f'got {read_report(\"/tmp/drill_report.csv\")}'" },
      { id: "closed", label: "every file opened is closed afterwards (with statement)", code: "import builtins\n_opened = []\n_real_open = builtins.open\ndef _spy(*a, **k):\n    f = _real_open(*a, **k)\n    _opened.append(f)\n    return f\nbuiltins.open = _spy\ntry:\n    write_report('/tmp/drill_closed.csv', [('a', 1)])\n    read_report('/tmp/drill_closed.csv')\nfinally:\n    builtins.open = _real_open\nassert _opened and all(f.closed for f in _opened), 'a file was left open: use with open(...) as f:'" },
      { id: "top", label: "top_hosts picks the highest cpu", code: "rows = [('a', 10), ('b', 90), ('c', 50), ('d', 70)]\nassert top_hosts(rows, 2) == ['b', 'd'], f'got {top_hosts(rows, 2)}'" },
      { id: "ties", label: "top_hosts(rows, n) with n larger than the list returns every host, highest first", code: "assert top_hosts([('a', 1), ('b', 3)], 5) == ['b', 'a']" },
    ],
    hints: ["with open(path, 'w') as f: inside the block, write; the file closes itself.", "int(cpu) when reading; top_hosts: heapq.nlargest(n, rows, key=lambda r: r[1]) then take the names.", "import heapq\n\ndef write_report(path, rows):\n    with open(path, 'w') as f:\n        for host, cpu in rows:\n            f.write(f'{host},{cpu}\\n')\n    return len(rows)\n\ndef read_report(path):\n    with open(path) as f:\n        return [(h, int(c)) for h, c in (line.strip().split(',') for line in f if line.strip())]\n\ndef top_hosts(rows, n):\n    return [h for h, _ in heapq.nlargest(n, rows, key=lambda r: r[1])]"],
    solution: `import heapq

def write_report(path, rows):
    with open(path, "w") as f:
        for host, cpu in rows:
            f.write(f"{host},{cpu}\\n")
    return len(rows)

def read_report(path):
    with open(path) as f:
        return [(h, int(c)) for h, c in (line.strip().split(",") for line in f if line.strip())]

def top_hosts(rows, n):
    return [h for h, _ in heapq.nlargest(n, rows, key=lambda r: r[1])]
`,
  },
];

export const PYTHON_DRILL_BY_ID = new Map(PYTHON_DRILLS.map((d) => [d.id, d]));
