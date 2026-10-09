import type { PythonMission } from "../../domain/types";

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are a trainee on the operations team.";

const COMMON_ERROR_HELP: PythonMission["errorHelp"] = [
  { match: /IndentationError|unexpected indent|expected an indented block/, explanation: "Python uses indentation (spaces at the start of a line) to group code. Every line inside a function, loop or if-block must be indented by the same amount, usually 4 spaces." },
  { match: /NameError: name '(\w+)' is not defined/, explanation: "You used a name that Python has not seen yet. Check spelling and capitalisation, and make sure the variable or function is defined before (above) the line that uses it." },
  { match: /TypeError: can only concatenate str/, explanation: "You tried to join a string and a number with +. Convert the number first: str(number), or use an f-string: f\"{value}\"." },
  { match: /TypeError: .*unsupported operand/, explanation: "The two values have types that cannot be combined with that operator. Print their types with print(type(x)) to see what you really have." },
  { match: /SyntaxError/, explanation: "Python could not parse the line. Common causes: a missing colon at the end of def/if/for lines, unbalanced parentheses or quotes." },
  { match: /ZeroDivisionError/, explanation: "You divided by zero. Guard the division with an if, or handle the exception with try/except." },
  { match: /KeyError: (.*)/, explanation: "The dictionary has no such key. Use dict.get(key, default) or check `if key in d` first." },
  { match: /IndexError/, explanation: "You asked for a position beyond the end of the list. Remember indexes start at 0 and the last valid index is len(items) - 1." },
  { match: /ValueError: invalid literal for int\(\)/, explanation: "int() received text that is not a whole number. Strip whitespace, check for empty strings, or validate before converting." },
  { match: /AttributeError/, explanation: "That object does not have the attribute or method you asked for. Check the type and the exact method name (for example .append on a list, .items() on a dict)." },
  { match: /AssertionError/, explanation: "A test assertion failed: the value your code produced is not what was expected. Read the expected vs actual values in the message." },
  { match: /FileNotFoundError/, explanation: "The file path does not exist. In this lab, files are provided in memory by the mission; check the exact filename in the briefing." },
];

export const pythonMissions: PythonMission[] = [
  {
    id: "python-01-uptime-report",
    kind: "python",
    trackId: "python",
    stage: 1,
    title: "Your first script: an uptime report",
    summary: "Variables, arithmetic, strings and print: turn seconds of uptime into a human-readable report.",
    briefing: `${COMPANY_INTRO}\n\nThe monitoring system reports server uptime as a plain number of seconds, which nobody can read at a glance. Write a function that turns seconds into "Xd Yh Zm" and prints a report line for a server.`,
    objectives: [
      "Define a function format_uptime(seconds) that returns a string like '3d 4h 5m'",
      "Use integer division (//) and modulo (%) to split seconds into days, hours and minutes",
      "Define report(name, seconds) that returns 'NAME: up 3d 4h 5m'",
      "Print the report for 'fleet-api-02' with 273900 seconds",
    ],
    skills: ["python.basics", "python.functions"],
    prerequisites: [],
    estimatedMinutes: 15,
    lesson: [
      {
        title: "Variables and numbers",
        body: "A variable is a name for a value: `seconds = 273900`. Python has whole numbers (`int`) and decimals (`float`). `//` divides and throws away the remainder (`7 // 2` is `3`), and `%` gives the remainder (`7 % 2` is `1`). These two together split a big number into units.",
      },
      {
        title: "Strings and f-strings",
        body: "Text lives in strings: `name = \"fleet-api-02\"`. To build text from values use an f-string: `f\"{name}: up {days}d\"`. Everything inside `{}` is evaluated and converted to text for you.",
      },
      {
        title: "Functions",
        body: "A function packages logic so you can reuse it:\n```\ndef format_uptime(seconds):\n    days = seconds // 86400\n    return f\"{days}d\"\n```\n`def` starts the function, the indented body runs when you call it, and `return` hands a value back. The tests call your functions directly, so names and return values matter.",
      },
    ],
    glossary: [
      { term: "function", definition: "A named, reusable block of code that takes inputs (parameters) and can return a value." },
      { term: "return value", definition: "The result a function hands back to whoever called it. print() shows text; return gives the value to code." },
      { term: "integer division", definition: "The // operator: division that drops the fractional part." },
    ],
    hints: [
      { level: 1, title: "Units", body: "There are 86400 seconds in a day, 3600 in an hour and 60 in a minute. Peel off days first, then hours from what is left, then minutes." },
      { level: 2, title: "Remainders", body: "`days = seconds // 86400`, then `remaining = seconds % 86400`, then `hours = remaining // 3600`, and so on." },
      { level: 3, title: "Return, don't just print", body: "The tests check what format_uptime returns. Build the string with an f-string and `return` it. report() should return f\"{name}: up {format_uptime(seconds)}\"." },
      { level: 4, title: "Guided example", body: "```\ndef format_uptime(seconds):\n    days = seconds // 86400\n    hours = (seconds % 86400) // 3600\n    minutes = (seconds % 3600) // 60\n    return f\"{days}d {hours}h {minutes}m\"\n\ndef report(name, seconds):\n    return f\"{name}: up {format_uptime(seconds)}\"\n\nprint(report(\"fleet-api-02\", 273900))\n```" },
    ],
    reflectionPrompts: ["Explain how you split the seconds into days, hours and minutes, and how you checked your function was correct."],
    transferNote: "Converting machine units into human units is everywhere in operations tooling: bytes to GB, seconds to durations, timestamps to local time.",
    starterCode: `# Nimbus Freight uptime report
# 1 day = 86400 seconds, 1 hour = 3600 seconds, 1 minute = 60 seconds

def format_uptime(seconds):
    # TODO: return a string like "3d 4h 5m"
    pass

def report(name, seconds):
    # TODO: return "NAME: up 3d 4h 5m"
    pass

print(report("fleet-api-02", 273900))
`,
    referenceSolution: `def format_uptime(seconds):
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    return f"{days}d {hours}h {minutes}m"

def report(name, seconds):
    return f"{name}: up {format_uptime(seconds)}"

print(report("fleet-api-02", 273900))
`,
    tests: [
      { id: "t1", label: "format_uptime(273900) == '3d 4h 5m'", code: "assert format_uptime(273900) == '3d 4h 5m', f'got {format_uptime(273900)!r}'" },
      { id: "t2", label: "format_uptime(59) == '0d 0h 0m'", code: "assert format_uptime(59) == '0d 0h 0m', f'got {format_uptime(59)!r}'" },
      { id: "t3", label: "format_uptime(90061) == '1d 1h 1m'", code: "assert format_uptime(90061) == '1d 1h 1m', f'got {format_uptime(90061)!r}'" },
      { id: "t4", label: "report('db-01', 3600) == 'db-01: up 0d 1h 0m'", code: "assert report('db-01', 3600) == 'db-01: up 0d 1h 0m', f'got {report(\"db-01\", 3600)!r}'" },
    ],
    errorHelp: COMMON_ERROR_HELP,
  },
  {
    id: "python-02-log-parser",
    kind: "python",
    trackId: "python",
    stage: 1,
    title: "Parse a log with loops, conditions and dictionaries",
    summary: "Loop over log lines, filter by level, and count errors per message with a dict.",
    briefing: `${COMPANY_INTRO}\n\nThe shell pipeline from the log-detective mission works, but the team wants it as a reusable Python tool. Write functions that take the raw log text and return the error counts.`,
    objectives: [
      "parse_line(line) returns a (level, message) tuple, dropping the timestamp",
      "count_errors(text) returns a dict mapping each ERROR message to how many times it appears",
      "top_error(text) returns the most frequent error message (or None if there are no errors)",
    ],
    skills: ["python.control", "python.collections"],
    prerequisites: ["python-01-uptime-report"],
    estimatedMinutes: 20,
    lesson: [
      {
        title: "Splitting strings",
        body: "`line.split(\" \", 2)` splits on the first two spaces only, giving `[timestamp, level, rest]`. `text.splitlines()` turns a block of text into a list of lines. `.strip()` removes surrounding whitespace.",
      },
      {
        title: "Loops and conditions",
        body: "```\nfor line in text.splitlines():\n    if not line.strip():\n        continue\n    level, message = parse_line(line)\n    if level == \"ERROR\":\n        ...\n```\n`continue` skips to the next loop iteration. `==` compares values.",
      },
      {
        title: "Dictionaries count things",
        body: "A dict maps keys to values: `counts = {}`; `counts[msg] = counts.get(msg, 0) + 1` adds one to the count for msg, starting at 0 if it is new. `max(counts, key=counts.get)` returns the key with the largest value.",
      },
    ],
    glossary: [
      { term: "tuple", definition: "An immutable, ordered pair (or group) of values, e.g. (\"ERROR\", \"disk full\")." },
      { term: "dictionary (dict)", definition: "A mapping from keys to values, like a lookup table." },
      { term: "None", definition: "Python's value for 'nothing'. Functions return None when they have nothing to report." },
    ],
    hints: [
      { level: 1, title: "One line first", body: "Make parse_line work on a single line: split it into at most 3 parts and return parts 1 and 2." },
      { level: 2, title: "Loop over lines", body: "In count_errors, loop over text.splitlines(), skip blank lines, parse, and only count when level == 'ERROR'." },
      { level: 3, title: "Most frequent", body: "If the dict is empty return None; otherwise `return max(counts, key=counts.get)`." },
      { level: 4, title: "Guided example", body: "```\ndef parse_line(line):\n    parts = line.strip().split(\" \", 2)\n    return parts[1], parts[2]\n\ndef count_errors(text):\n    counts = {}\n    for line in text.splitlines():\n        if not line.strip():\n            continue\n        level, message = parse_line(line)\n        if level == \"ERROR\":\n            counts[message] = counts.get(message, 0) + 1\n    return counts\n\ndef top_error(text):\n    counts = count_errors(text)\n    if not counts:\n        return None\n    return max(counts, key=counts.get)\n```" },
    ],
    reflectionPrompts: ["Why did you choose a dictionary to count errors? What would break if two different lines had the same message but different timestamps?"],
    transferNote: "Almost every ops script is parse -> filter -> aggregate. The same shape handles metrics, billing records and deploy histories.",
    starterCode: `SAMPLE = """2026-03-09T03:00:09Z ERROR database timeout after 5000ms connecting to db-primary
2026-03-09T03:00:10Z INFO GET /v1/positions 200 12ms
2026-03-09T03:00:17Z ERROR cache miss storm: 412 keys expired simultaneously
2026-03-09T03:00:23Z ERROR database timeout after 5000ms connecting to db-primary
2026-03-09T03:00:31Z WARN slow query 1200ms
"""

def parse_line(line):
    """Return (level, message) for one log line, dropping the timestamp."""
    # TODO
    pass

def count_errors(text):
    """Return a dict: error message -> number of occurrences."""
    # TODO
    pass

def top_error(text):
    """Return the most common error message, or None if there are no errors."""
    # TODO
    pass

print(count_errors(SAMPLE))
print("Top error:", top_error(SAMPLE))
`,
    referenceSolution: `SAMPLE = """2026-03-09T03:00:09Z ERROR database timeout after 5000ms connecting to db-primary
2026-03-09T03:00:10Z INFO GET /v1/positions 200 12ms
2026-03-09T03:00:17Z ERROR cache miss storm: 412 keys expired simultaneously
2026-03-09T03:00:23Z ERROR database timeout after 5000ms connecting to db-primary
2026-03-09T03:00:31Z WARN slow query 1200ms
"""

def parse_line(line):
    parts = line.strip().split(" ", 2)
    return parts[1], parts[2]

def count_errors(text):
    counts = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        level, message = parse_line(line)
        if level == "ERROR":
            counts[message] = counts.get(message, 0) + 1
    return counts

def top_error(text):
    counts = count_errors(text)
    if not counts:
        return None
    return max(counts, key=counts.get)

print(count_errors(SAMPLE))
print("Top error:", top_error(SAMPLE))
`,
    tests: [
      { id: "t1", label: "parse_line splits level and message", code: "assert parse_line('2026-03-09T03:00:09Z ERROR disk full on /var') == ('ERROR', 'disk full on /var'), parse_line('2026-03-09T03:00:09Z ERROR disk full on /var')" },
      { id: "t2", label: "count_errors counts each message", code: "c = count_errors(SAMPLE)\nassert c == {'database timeout after 5000ms connecting to db-primary': 2, 'cache miss storm: 412 keys expired simultaneously': 1}, c" },
      { id: "t3", label: "count_errors ignores INFO/WARN and blank lines", code: "assert count_errors('2026-01-01T00:00:00Z INFO ok\\n\\n2026-01-01T00:00:01Z WARN meh\\n') == {}" },
      { id: "t4", label: "top_error returns the most frequent", code: "assert top_error(SAMPLE) == 'database timeout after 5000ms connecting to db-primary'" },
      { id: "t5", label: "top_error returns None when there are no errors", code: "assert top_error('2026-01-01T00:00:00Z INFO ok\\n') is None" },
    ],
    errorHelp: COMMON_ERROR_HELP,
  },
  {
    id: "python-03-config-validator",
    kind: "python",
    trackId: "python",
    stage: 2,
    title: "Harden a config loader with error handling and tests",
    summary: "Raise and catch exceptions deliberately, validate input, and make a failing test suite pass.",
    briefing: `${COMPANY_INTRO}\n\nA deploy went wrong because api.conf had 'port=eighty'. The service crashed with a confusing traceback. Write a validator that turns bad config into clear error messages, and make all the provided tests pass. Two of the starter functions contain bugs to find.`,
    objectives: [
      "parse_config(text) returns a dict of key -> value from KEY=VALUE lines, ignoring comments (#) and blank lines",
      "validate(config) raises ConfigError with a clear message when 'port' is missing, not an integer, or outside 1-65535",
      "validate(config) returns the port as an int when valid",
      "load(text) combines both, and returns None (printing the error) instead of crashing on bad input",
    ],
    skills: ["python.errors", "python.testing"],
    prerequisites: ["python-02-log-parser"],
    estimatedMinutes: 25,
    lesson: [
      {
        title: "Exceptions are signals",
        body: "When something cannot continue, Python raises an exception. You can define your own: `class ConfigError(Exception): pass`, and raise it with a helpful message: `raise ConfigError(\"port must be a whole number, got 'eighty'\")`.",
      },
      {
        title: "try / except",
        body: "```\ntry:\n    port = int(value)\nexcept ValueError:\n    raise ConfigError(f\"port must be a whole number, got {value!r}\")\n```\nCatch the narrowest exception type you can. Catching everything (`except:`) hides real bugs.",
      },
      {
        title: "Tests tell you when you are done",
        body: "An `assert` statement checks a fact and raises AssertionError when it is false. The mission tests call your functions with good and bad input. Read each failing test's message: it tells you exactly which behaviour is still missing. Also read the tracebacks: the last line names the error, the lines above show where.",
      },
    ],
    glossary: [
      { term: "exception", definition: "An error object that interrupts normal flow until something catches it." },
      { term: "raise", definition: "Deliberately trigger an exception." },
      { term: "traceback", definition: "The report Python prints when an exception is not caught, listing each call that led to it." },
    ],
    hints: [
      { level: 1, title: "Find the planted bugs", body: "Run the code as-is and read the test failures. One bug is in how comments are skipped; another is in the port range check." },
      { level: 2, title: "Convert carefully", body: "int('eighty') raises ValueError. Catch it and raise ConfigError with a message that includes the bad value." },
      { level: 3, title: "Range and missing", body: "If 'port' not in config: raise ConfigError('port is required'). After converting, check 1 <= port <= 65535." },
      { level: 4, title: "Guided example", body: "```\nclass ConfigError(Exception):\n    pass\n\ndef parse_config(text):\n    config = {}\n    for line in text.splitlines():\n        line = line.strip()\n        if not line or line.startswith('#'):\n            continue\n        key, _, value = line.partition('=')\n        config[key.strip()] = value.strip()\n    return config\n\ndef validate(config):\n    if 'port' not in config:\n        raise ConfigError('port is required')\n    try:\n        port = int(config['port'])\n    except ValueError:\n        raise ConfigError(f\"port must be a whole number, got {config['port']!r}\")\n    if not 1 <= port <= 65535:\n        raise ConfigError(f'port must be between 1 and 65535, got {port}')\n    return port\n\ndef load(text):\n    try:\n        return validate(parse_config(text))\n    except ConfigError as e:\n        print(f'config error: {e}')\n        return None\n```" },
    ],
    reflectionPrompts: ["Describe a bug you found in the starter code, how the tests pointed you to it, and how you confirmed the fix."],
    transferNote: "Turning crashes into clear, early validation errors is what separates a script from a tool other people can trust.",
    starterCode: `class ConfigError(Exception):
    """Raised when the configuration is invalid."""
    pass


def parse_config(text):
    """Parse KEY=VALUE lines into a dict. Skip blank lines and # comments."""
    config = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        key, _, value = line.partition("=")
        config[key.strip()] = value.strip()
    return config


def validate(config):
    """Return the port as an int, or raise ConfigError with a clear message."""
    port = int(config["port"])
    if port < 1 or port > 65536:
        raise ConfigError(f"port must be between 1 and 65535, got {port}")
    return port


def load(text):
    """Parse + validate. On bad config, print the error and return None."""
    return validate(parse_config(text))


print(load("port=8080\\nworkers=4"))
print(load("# comment\\nport=eighty"))
`,
    referenceSolution: `class ConfigError(Exception):
    pass

def parse_config(text):
    config = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, _, value = line.partition('=')
        config[key.strip()] = value.strip()
    return config

def validate(config):
    if 'port' not in config:
        raise ConfigError('port is required')
    try:
        port = int(config['port'])
    except ValueError:
        raise ConfigError(f"port must be a whole number, got {config['port']!r}")
    if not 1 <= port <= 65535:
        raise ConfigError(f'port must be between 1 and 65535, got {port}')
    return port

def load(text):
    try:
        return validate(parse_config(text))
    except ConfigError as e:
        print(f'config error: {e}')
        return None

print(load("port=8080\\nworkers=4"))
print(load("# comment\\nport=eighty"))
`,
    tests: [
      { id: "t1", label: "parse_config skips comments and blanks", code: "assert parse_config('# c\\n\\nport=80\\nname = api\\n') == {'port': '80', 'name': 'api'}, parse_config('# c\\n\\nport=80\\nname = api\\n')" },
      { id: "t2", label: "validate returns an int port", code: "assert validate({'port': '8080'}) == 8080" },
      { id: "t3", label: "validate raises ConfigError for a missing port", code: "try:\n    validate({})\n    raise AssertionError('expected ConfigError for missing port')\nexcept ConfigError as e:\n    assert 'port' in str(e)" },
      { id: "t4", label: "validate raises ConfigError (not ValueError) for non-numeric port", code: "try:\n    validate({'port': 'eighty'})\n    raise AssertionError('expected ConfigError')\nexcept ConfigError as e:\n    assert 'eighty' in str(e), str(e)" },
      { id: "t5", label: "validate rejects 65536 and 0", code: "for bad in ('65536', '0'):\n    try:\n        validate({'port': bad})\n        raise AssertionError(f'expected ConfigError for {bad}')\n    except ConfigError:\n        pass" },
      { id: "t6", label: "load returns None instead of crashing on bad config", code: "assert load('port=eighty') is None\nassert load('port=22') == 22" },
    ],
    errorHelp: COMMON_ERROR_HELP,
  },
  {
    id: "python-04-fleet-report",
    kind: "python",
    trackId: "python",
    stage: 2,
    title: "From CSV to JSON: a fuel-efficiency report",
    summary: "Parse a CSV export with the csv module, aggregate per vehicle with dicts, skip bad rows deliberately, and emit a stable JSON document.",
    briefing: `${COMPANY_INTRO}\n\nFinance exports vehicle trips as CSV (vehicle_id,date,km,fuel_l) and wants a JSON summary per vehicle: trips, total km, total fuel and litres per 100 km. The export sometimes contains blank lines and corrupted rows; those must be skipped and counted, never crash the report.`,
    objectives: [
      "parse_trips(text) returns (trips, skipped): a list of dicts with vehicle_id (str), date (str), km (float), fuel_l (float), and the number of rows skipped",
      "A row is skipped when it has the wrong number of columns or km / fuel_l is not a number or is negative",
      "summarize(trips) returns {vehicle_id: {'trips': n, 'km': total, 'fuel_l': total, 'l_per_100km': litres per 100 km rounded to 1 decimal}} (0.0 when km is 0)",
      "to_json(summary) returns json.dumps with sorted keys and 2-space indentation so two runs produce identical text",
    ],
    skills: ["python.data", "python.collections"],
    prerequisites: ["python-03-config-validator"],
    estimatedMinutes: 25,
    lesson: [
      {
        title: "Do not split CSV by hand",
        body: "A CSV field may contain commas inside quotes, so `line.split(',')` breaks on real exports. The `csv` module handles quoting: `csv.DictReader(io.StringIO(text))` yields one dict per row keyed by the header. Convert types yourself: every value arrives as a string, so `float(row['km'])` and `int(...)` are your job, and they raise `ValueError` on junk.",
      },
      {
        title: "Skip bad rows on purpose",
        body: "A report that crashes on one corrupted line helps nobody; a report that silently swallows errors is worse. Do both halves: `try: ... except (ValueError, KeyError, TypeError): skipped += 1; continue`, and return the count so the caller can see data quality. DictReader fills missing columns with `None` and puts extra columns under the key `None`, so check for those too.",
      },
      {
        title: "Aggregate with dicts, then make the output stable",
        body: "`totals.setdefault(vehicle_id, {'trips': 0, 'km': 0.0, 'fuel_l': 0.0})` creates the entry on first sight. Compute derived numbers at the end (`round(fuel / km * 100, 1)`). `json.dumps(summary, indent=2, sort_keys=True)` produces the same text for the same data every run, which makes diffs and tests meaningful.",
      },
    ],
    glossary: [
      { term: "CSV", definition: "Comma-separated values: one record per line, fields separated by commas, with quoting rules for commas inside fields." },
      { term: "JSON", definition: "A text format for nested data (objects, arrays, strings, numbers) that nearly every language can read." },
      { term: "DictReader", definition: "A csv reader that uses the first row as keys and yields a dict per record." },
      { term: "stable output", definition: "Identical input produces byte-identical output (sorted keys, fixed indentation), so diffs show real changes only." },
    ],
    hints: [
      { level: 1, title: "Read with DictReader", body: "`reader = csv.DictReader(io.StringIO(text))` then `for row in reader:`. Blank lines are skipped by the reader itself. Validate `len(row) == 4` style conditions by checking that no value is None and `None not in row`." },
      { level: 2, title: "Convert and guard", body: "`km = float(row['km']); fuel = float(row['fuel_l'])` inside a try/except ValueError. If km < 0 or fuel < 0, skip too. Append `{'vehicle_id': row['vehicle_id'], 'date': row['date'], 'km': km, 'fuel_l': fuel}`." },
      { level: 3, title: "Aggregate", body: "Loop over trips, `entry = totals.setdefault(t['vehicle_id'], {...})`, add to the three numbers; afterwards set `l_per_100km = round(fuel / km * 100, 1) if km else 0.0`." },
      { level: 4, title: "Guided example", body: "```\ndef parse_trips(text):\n    trips, skipped = [], 0\n    for row in csv.DictReader(io.StringIO(text)):\n        if None in row or None in row.values():\n            skipped += 1\n            continue\n        try:\n            km, fuel = float(row['km']), float(row['fuel_l'])\n        except ValueError:\n            skipped += 1\n            continue\n        if km < 0 or fuel < 0:\n            skipped += 1\n            continue\n        trips.append({'vehicle_id': row['vehicle_id'], 'date': row['date'], 'km': km, 'fuel_l': fuel})\n    return trips, skipped\n```" },
    ],
    reflectionPrompts: ["Explain how your parser treats a corrupted row and why you chose to count skipped rows rather than raise or ignore them."],
    transferNote: "Turning messy exports into stable structured output is the bread and butter of operations tooling; csv + json + dict aggregation covers most of it.",
    starterCode: `import csv
import io
import json

SAMPLE = """vehicle_id,date,km,fuel_l
V-100,2026-03-01,120.5,9.8
V-200,2026-03-01,80.0,7.1
V-100,2026-03-02,200.0,15.9

V-300,2026-03-02,abc,4.0
V-200,2026-03-02,95.5,8.2,extra
V-100,2026-03-03,-5,1.0
"""


def parse_trips(text):
    """Return (trips, skipped). Each trip: dict with vehicle_id, date, km (float), fuel_l (float)."""
    trips = []
    skipped = 0
    # TODO: use csv.DictReader(io.StringIO(text)); convert km and fuel_l; skip bad rows
    return trips, skipped


def summarize(trips):
    """Return {vehicle_id: {"trips": n, "km": total, "fuel_l": total, "l_per_100km": x}}."""
    totals = {}
    # TODO
    return totals


def to_json(summary):
    """Stable JSON text: sorted keys, 2-space indent."""
    # TODO
    return ""


if __name__ == "__main__":
    trips, skipped = parse_trips(SAMPLE)
    print(f"{len(trips)} trips, {skipped} skipped")
    print(to_json(summarize(trips)))
`,
    referenceSolution: `import csv
import io
import json

SAMPLE = """vehicle_id,date,km,fuel_l
V-100,2026-03-01,120.5,9.8
V-200,2026-03-01,80.0,7.1
V-100,2026-03-02,200.0,15.9

V-300,2026-03-02,abc,4.0
V-200,2026-03-02,95.5,8.2,extra
V-100,2026-03-03,-5,1.0
"""


def parse_trips(text):
    trips = []
    skipped = 0
    for row in csv.DictReader(io.StringIO(text)):
        if None in row or None in row.values():
            skipped += 1
            continue
        try:
            km = float(row["km"])
            fuel = float(row["fuel_l"])
        except ValueError:
            skipped += 1
            continue
        if km < 0 or fuel < 0:
            skipped += 1
            continue
        trips.append({"vehicle_id": row["vehicle_id"], "date": row["date"], "km": km, "fuel_l": fuel})
    return trips, skipped


def summarize(trips):
    totals = {}
    for t in trips:
        entry = totals.setdefault(t["vehicle_id"], {"trips": 0, "km": 0.0, "fuel_l": 0.0})
        entry["trips"] += 1
        entry["km"] += t["km"]
        entry["fuel_l"] += t["fuel_l"]
    for entry in totals.values():
        entry["l_per_100km"] = round(entry["fuel_l"] / entry["km"] * 100, 1) if entry["km"] else 0.0
    return totals


def to_json(summary):
    return json.dumps(summary, indent=2, sort_keys=True)


if __name__ == "__main__":
    trips, skipped = parse_trips(SAMPLE)
    print(f"{len(trips)} trips, {skipped} skipped")
    print(to_json(summarize(trips)))
`,
    tests: [
      { id: "t1", label: "parse_trips keeps 3 valid rows from SAMPLE and skips 3 bad ones with correct types", code: `trips, skipped = parse_trips(SAMPLE)\nassert skipped == 3, f"skipped {skipped}, expected 3"\nassert len(trips) == 3, f"{len(trips)} trips, expected 3"\nassert trips[0] == {"vehicle_id": "V-100", "date": "2026-03-01", "km": 120.5, "fuel_l": 9.8}, trips[0]\nassert all(isinstance(t["km"], float) and isinstance(t["fuel_l"], float) for t in trips)` },
      { id: "t2", label: "parse_trips handles quoted commas and an empty export", code: `trips, skipped = parse_trips('vehicle_id,date,km,fuel_l\\n"V-1,North",2026-03-05,10,1\\n')\nassert skipped == 0 and trips == [{"vehicle_id": "V-1,North", "date": "2026-03-05", "km": 10.0, "fuel_l": 1.0}], (trips, skipped)\nassert parse_trips("vehicle_id,date,km,fuel_l\\n") == ([], 0)` },
      { id: "t3", label: "summarize totals per vehicle and computes litres per 100 km", code: `s = summarize([{"vehicle_id": "A", "date": "d", "km": 100.0, "fuel_l": 8.0}, {"vehicle_id": "A", "date": "d", "km": 50.0, "fuel_l": 4.5}, {"vehicle_id": "B", "date": "d", "km": 0.0, "fuel_l": 0.0}])\nassert s["A"] == {"trips": 2, "km": 150.0, "fuel_l": 12.5, "l_per_100km": 8.3}, s["A"]\nassert s["B"] == {"trips": 1, "km": 0.0, "fuel_l": 0.0, "l_per_100km": 0.0}, s["B"]` },
      { id: "t4", label: "to_json is stable: sorted keys, 2-space indent, round-trips", code: `out = to_json({"b": {"trips": 1, "km": 1.0, "fuel_l": 0.1, "l_per_100km": 10.0}, "a": {"trips": 0, "km": 0.0, "fuel_l": 0.0, "l_per_100km": 0.0}})\nassert out.startswith('{\\n  "a": {'), out[:20]\nassert json.loads(out)["b"]["l_per_100km"] == 10.0\nassert out.index('"fuel_l"') < out.index('"km"') < out.index('"l_per_100km"') < out.index('"trips"')` },
    ],
    errorHelp: COMMON_ERROR_HELP,
  },
];
