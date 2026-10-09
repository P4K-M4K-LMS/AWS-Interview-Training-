import type { CheckResult } from "../../domain/types";
import { planScans, planUsesIndex, sameRowsOrdered, sameRowsUnordered, type SqlRunResult } from "../../engine/sql/harness";

/**
 * SQL exercises on a fictional order-management database. Each has a schema
 * and seed (real SQLite), a brief, a starting program that fails in an
 * instructive way, checks over the run result, hints, and a reference
 * solution the tests run. `expected` rows are produced by the reference
 * solution and verified by the tests against real SQLite.
 */
export interface SqlExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  setup: string;
  start: string;
  hints: string[];
  checks: (r: SqlRunResult) => CheckResult[];
  solution: string;
}

const check = (id: string, label: string, passed: boolean, detail?: string): CheckResult => ({ id, label, passed, detail });
const noError = (r: SqlRunResult) => check("runs", "The program runs without an error", r.error === null, r.error ? `statement ${r.errorStatement}: ${r.error}` : undefined);

/** Orders schema: customers, products, orders and order lines; 400 orders over 60 customers. */
const ORDERS_SCHEMA = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL, email TEXT NOT NULL);
CREATE TABLE products (id INTEGER PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, unit_price REAL NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), placed_at TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE order_lines (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, PRIMARY KEY (order_id, product_id));
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
INSERT INTO customers SELECT i, 'Customer ' || i, CASE i % 4 WHEN 0 THEN 'north' WHEN 1 THEN 'south' WHEN 2 THEN 'east' ELSE 'west' END, 'customer' || i || '@example.test' FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 12)
INSERT INTO products SELECT i, 'SKU-' || printf('%03d', i), 'Product ' || i, 5.0 * i FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT INTO orders SELECT i, (i * 7) % 60 + 1, date('2026-01-01', '+' || ((i * 13) % 180) || ' days'), CASE i % 10 WHEN 0 THEN 'cancelled' WHEN 1 THEN 'pending' ELSE 'shipped' END FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT INTO order_lines SELECT i, (i * 5) % 12 + 1, (i % 3) + 1 FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT INTO order_lines SELECT i, (i * 11 + 3) % 12 + 1, (i % 4) + 1 FROM n WHERE (i * 11 + 3) % 12 + 1 <> (i * 5) % 12 + 1;
`;

/** The denormalised shipments table for the normalisation exercise. */
const SHIPMENTS_SCHEMA = `
CREATE TABLE shipments (id INTEGER PRIMARY KEY, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_region TEXT NOT NULL, product_sku TEXT NOT NULL, product_name TEXT NOT NULL, quantity INTEGER NOT NULL, shipped_on TEXT NOT NULL);
INSERT INTO shipments (customer_name, customer_email, customer_region, product_sku, product_name, quantity, shipped_on) VALUES
('Acme Ltd', 'ops@acme.test', 'north', 'SKU-001', 'Product 1', 2, '2026-03-01'),
('Acme Ltd', 'ops@acme.test', 'north', 'SKU-002', 'Product 2', 1, '2026-03-02'),
('Acme Ltd', 'ops@acme.test', 'NORTH', 'SKU-001', 'Product 1', 5, '2026-03-09'),
('Birch Co', 'hello@birch.test', 'south', 'SKU-002', 'Product 2', 3, '2026-03-03'),
('Birch Co', 'hello@birch.test', 'south', 'SKU-003', 'Product 3', 1, '2026-03-05'),
('Birch Co', 'hello@birch.test', 'south', 'SKU-003', 'Product three', 2, '2026-03-11'),
('Cedar GmbH', 'cedar@cedar.test', 'east', 'SKU-001', 'Product 1', 1, '2026-03-04');
`;

const LEDGER_SCHEMA = `
CREATE TABLE accounts (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, balance INTEGER NOT NULL CHECK (balance >= 0));
INSERT INTO accounts VALUES (1, 'alice', 100), (2, 'bob', 20);
CREATE TABLE transfers (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, amount INTEGER NOT NULL);
`;

export const SQL_EXERCISES: SqlExercise[] = [
  {
    id: "sql-01-join",
    title: "Revenue per region, from four tables",
    brief: "Orders, their lines, products and customers are four tables. Report the shipped revenue (quantity × unit price) per customer region, highest first, with the region and the revenue rounded to two decimals. The starting query sums quantities instead of revenue and forgets to exclude cancelled and pending orders.",
    teaches: "A relational schema keeps each fact once and joins them back together at query time: the price lives on the product, the region on the customer, and an order line carries only the keys. Filters go in WHERE before the GROUP BY; aggregates go in SELECT.",
    setup: ORDERS_SCHEMA,
    start: "SELECT c.region, SUM(l.quantity) AS revenue\nFROM orders o\nJOIN order_lines l ON l.order_id = o.id\nJOIN customers c ON c.id = o.customer_id\nGROUP BY c.region\nORDER BY revenue DESC;",
    hints: ["Join products as well: the unit price is there, not on the line.", "Only shipped orders count: WHERE o.status = 'shipped'.", "SELECT c.region, ROUND(SUM(l.quantity * p.unit_price), 2) AS revenue FROM orders o JOIN order_lines l ON l.order_id = o.id JOIN products p ON p.id = l.product_id JOIN customers c ON c.id = o.customer_id WHERE o.status = 'shipped' GROUP BY c.region ORDER BY revenue DESC;"],
    checks: (r) => [
      noError(r),
      check("columns", "Two columns: region and revenue", r.columns.length === 2 && r.columns[0] === "region" && r.columns[1] === "revenue", r.columns.length ? `columns: ${r.columns.join(", ")}` : "no rows returned"),
      check("rows", "The four regions with their shipped revenue, highest first", sameRowsOrdered(r.rows, EXPECTED["sql-01-join"]), r.rows.length ? `${r.rows.length} rows; first ${JSON.stringify(r.rows[0])}` : "no rows"),
    ],
    solution: "SELECT c.region, ROUND(SUM(l.quantity * p.unit_price), 2) AS revenue\nFROM orders o\nJOIN order_lines l ON l.order_id = o.id\nJOIN products p ON p.id = l.product_id\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'shipped'\nGROUP BY c.region\nORDER BY revenue DESC;",
  },
  {
    id: "sql-02-index",
    title: "A lookup that scans the whole table",
    brief: "The support tool looks up a customer's orders by customer_id many times a second, and the plan says SCAN orders: every lookup reads all 400 rows. Create the index that turns it into a search, then run the lookup for customer 17 ordered by placed_at. The plan must use your index.",
    teaches: "An index is a sorted copy of one or more columns with a pointer back to the row, kept in a B-tree so a lookup is a few page reads instead of a scan. It is worth its write cost when the column is in the WHERE of a frequent query; a composite index on (customer_id, placed_at) also serves the ORDER BY.",
    setup: ORDERS_SCHEMA,
    start: "SELECT id, placed_at, status\nFROM orders\nWHERE customer_id = 17\nORDER BY placed_at;",
    hints: ["Read the plan line: SCAN orders means no index helped. The query filters on customer_id.", "CREATE INDEX name ON orders (customer_id); then the same SELECT. The plan should say SEARCH orders USING INDEX.", "CREATE INDEX idx_orders_customer ON orders (customer_id, placed_at); SELECT id, placed_at, status FROM orders WHERE customer_id = 17 ORDER BY placed_at;"],
    checks: (r) => [
      noError(r),
      check("index", "An index on orders that includes customer_id exists", r.indexes.some((i) => i.table === "orders" && /customer_id/i.test(i.sql)), r.indexes.length ? `indexes: ${r.indexes.map((i) => i.name).join(", ")}` : "no index created"),
      check("plan", "The lookup's plan uses the index (SEARCH, not SCAN)", r.lastQuery !== null && planUsesIndex(r.plan, "orders") && !planScans(r.plan, "orders"), r.plan.length ? r.plan.join(" | ") : "no query plan"),
      check("rows", "The orders of customer 17, by date", sameRowsOrdered(r.rows, EXPECTED["sql-02-index"]), `${r.rows.length} rows`),
    ],
    solution: "CREATE INDEX idx_orders_customer ON orders (customer_id, placed_at);\nSELECT id, placed_at, status\nFROM orders\nWHERE customer_id = 17\nORDER BY placed_at;",
  },
  {
    id: "sql-03-normalise",
    title: "One table that repeats everything",
    brief: "The shipments table repeats the customer's name, email and region and the product's name on every row, and the repeats already disagree (NORTH against north, 'Product three' against 'Product 3'). Create a customers table keyed by email and a products table keyed by SKU, fill them from shipments with one row per customer and per product, and show the customer count and the product count.",
    teaches: "Normalisation puts each fact in exactly one place so it cannot disagree with itself. Third normal form: every non-key column depends on the key, the whole key, and nothing but the key. The customer's region depends on the customer, not on the shipment, so it moves to a customers table keyed by what identifies a customer.",
    setup: SHIPMENTS_SCHEMA,
    start: "-- Build the two tables and fill them from shipments.\nCREATE TABLE customers (email TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL);\nINSERT INTO customers SELECT customer_email, customer_name, customer_region FROM shipments;\nSELECT (SELECT COUNT(*) FROM customers) AS customers, 0 AS products;",
    hints: ["The insert fails on the second Acme row: the email is the key and it is repeated. Group the rows per email and pick one value per column (MIN or LOWER).", "Same shape for products: CREATE TABLE products (sku TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT ... SELECT product_sku, MIN(product_name) FROM shipments GROUP BY product_sku.", "CREATE TABLE customers (email TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL); INSERT INTO customers SELECT customer_email, MIN(customer_name), LOWER(MIN(customer_region)) FROM shipments GROUP BY customer_email; CREATE TABLE products (sku TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO products SELECT product_sku, MIN(product_name) FROM shipments GROUP BY product_sku; SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM products) AS products;"],
    checks: (r) => {
      const customers = r.tables.find((t) => t.name === "customers");
      const products = r.tables.find((t) => t.name === "products");
      return [
        noError(r),
        check("customers", "A customers table with one row per customer (3)", customers?.rowCount === 3, customers ? `${customers.rowCount} rows` : "no customers table"),
        check("products", "A products table with one row per SKU (3)", products?.rowCount === 3, products ? `${products.rowCount} rows` : "no products table"),
        check("counts", "The final query reports customers = 3 and products = 3", sameRowsUnordered(r.rows, [[3, 3]]), r.rows.length ? `got ${JSON.stringify(r.rows[0])}` : "no rows"),
      ];
    },
    solution: "CREATE TABLE customers (email TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL);\nINSERT INTO customers SELECT customer_email, MIN(customer_name), LOWER(MIN(customer_region)) FROM shipments GROUP BY customer_email;\nCREATE TABLE products (sku TEXT PRIMARY KEY, name TEXT NOT NULL);\nINSERT INTO products SELECT product_sku, MIN(product_name) FROM shipments GROUP BY product_sku;\nSELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM products) AS products;",
  },
  {
    id: "sql-04-transaction",
    title: "A transfer that must not half-happen",
    brief: "Move 50 from alice to bob and record it in transfers, as one transaction. The starting program debits alice 50, credits bob 500 and records 50, so the books no longer balance. Make the transfer atomic and consistent: both accounts change by 50, one transfer row records it, and the total of all balances stays 120.",
    teaches: "A transaction makes several statements one unit: all of them happen or none (atomicity), the data obeys its rules at the end (consistency, here a CHECK that balances never go negative), and other readers never see the half-done state (isolation). A failed statement rolls the whole unit back.",
    setup: LEDGER_SCHEMA,
    start: "BEGIN;\nUPDATE accounts SET balance = balance - 50 WHERE id = 1;\nUPDATE accounts SET balance = balance + 500 WHERE id = 2;\nINSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 50);\nCOMMIT;\nSELECT id, owner, balance FROM accounts ORDER BY id;",
    hints: ["Both updates must use the same amount as the transfer row.", "Try moving 500 instead: the CHECK on balance rejects the debit and nothing else in the transaction should survive.", "BEGIN; UPDATE accounts SET balance = balance - 50 WHERE id = 1; UPDATE accounts SET balance = balance + 50 WHERE id = 2; INSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 50); COMMIT; SELECT id, owner, balance FROM accounts ORDER BY id;"],
    checks: (r) => {
      const transfers = r.tables.find((t) => t.name === "transfers");
      return [
        noError(r),
        check("balances", "alice has 50 and bob has 70", sameRowsOrdered(r.rows, [[1, "alice", 50], [2, "bob", 70]]), r.rows.length ? `got ${JSON.stringify(r.rows)}` : "no rows: end with SELECT id, owner, balance FROM accounts ORDER BY id"),
        check("recorded", "Exactly one transfer row records it", transfers?.rowCount === 1, transfers ? `${transfers.rowCount} rows` : "no transfers table"),
      ];
    },
    solution: "BEGIN;\nUPDATE accounts SET balance = balance - 50 WHERE id = 1;\nUPDATE accounts SET balance = balance + 50 WHERE id = 2;\nINSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 50);\nCOMMIT;\nSELECT id, owner, balance FROM accounts ORDER BY id;",
  },
  {
    id: "sql-05-view",
    title: "A view for the report everyone re-types",
    brief: "Three teams paste the same shipped-revenue-per-customer query into their tools. Create a view named customer_revenue with the columns customer_id, name and revenue (shipped orders only, revenue rounded to two decimals), then use it to list the five customers with the highest revenue, highest first, ties by customer id.",
    teaches: "A view is a saved query that behaves like a table: the logic lives once, in the database, and every reader gets the same definition. It costs nothing to store and runs the underlying query each time; a materialised view would trade freshness for speed.",
    setup: ORDERS_SCHEMA,
    start: "SELECT c.id AS customer_id, c.name, ROUND(SUM(l.quantity * p.unit_price), 2) AS revenue\nFROM orders o\nJOIN order_lines l ON l.order_id = o.id\nJOIN products p ON p.id = l.product_id\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'shipped'\nGROUP BY c.id\nORDER BY revenue DESC, customer_id\nLIMIT 5;",
    hints: ["CREATE VIEW customer_revenue AS SELECT ... (the query without ORDER BY and LIMIT).", "Then SELECT customer_id, name, revenue FROM customer_revenue ORDER BY revenue DESC, customer_id LIMIT 5;", "CREATE VIEW customer_revenue AS SELECT c.id AS customer_id, c.name, ROUND(SUM(l.quantity * p.unit_price), 2) AS revenue FROM orders o JOIN order_lines l ON l.order_id = o.id JOIN products p ON p.id = l.product_id JOIN customers c ON c.id = o.customer_id WHERE o.status = 'shipped' GROUP BY c.id; SELECT customer_id, name, revenue FROM customer_revenue ORDER BY revenue DESC, customer_id LIMIT 5;"],
    checks: (r) => [
      noError(r),
      check("view", "A view named customer_revenue exists", r.views.includes("customer_revenue"), r.views.length ? `views: ${r.views.join(", ")}` : "no view created"),
      check("uses", "The final query reads from the view", r.lastQuery !== null && /from\s+customer_revenue/i.test(r.lastQuery), r.lastQuery ? undefined : "no query"),
      check("rows", "The top five customers by revenue, highest first", sameRowsOrdered(r.rows, EXPECTED["sql-05-view"]), r.rows.length ? `${r.rows.length} rows; first ${JSON.stringify(r.rows[0])}` : "no rows"),
    ],
    solution: "CREATE VIEW customer_revenue AS\nSELECT c.id AS customer_id, c.name, ROUND(SUM(l.quantity * p.unit_price), 2) AS revenue\nFROM orders o\nJOIN order_lines l ON l.order_id = o.id\nJOIN products p ON p.id = l.product_id\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'shipped'\nGROUP BY c.id;\nSELECT customer_id, name, revenue FROM customer_revenue ORDER BY revenue DESC, customer_id LIMIT 5;",
  },
  {
    id: "sql-06-plan",
    title: "Reading the plan: an index the query cannot use",
    brief: "An index on orders (placed_at) exists, yet the query for March orders still scans the table, because it wraps the column in a function: strftime('%m', placed_at) = '03'. Rewrite the WHERE as a range on the column itself so the plan searches the index, and return the count of March orders.",
    teaches: "A query plan is the database's chosen path through the data. An index on a column can only be used when the query compares that column directly: wrapping it in a function (a date part, LOWER, arithmetic) hides it from the index, so the planner falls back to a scan. A range on the raw column keeps the index usable.",
    setup: ORDERS_SCHEMA + "\nCREATE INDEX idx_orders_placed ON orders (placed_at);\n",
    start: "SELECT COUNT(*) AS march_orders\nFROM orders\nWHERE strftime('%m', placed_at) = '03';",
    hints: ["The plan says SCAN orders even though idx_orders_placed exists: the function on the column hides it.", "Compare the column itself: placed_at >= '2026-03-01' AND placed_at < '2026-04-01'.", "SELECT COUNT(*) AS march_orders FROM orders WHERE placed_at >= '2026-03-01' AND placed_at < '2026-04-01';"],
    checks: (r) => [
      noError(r),
      check("plan", "The plan searches the index on placed_at (no scan of orders)", r.lastQuery !== null && planUsesIndex(r.plan, "orders") && !planScans(r.plan, "orders"), r.plan.length ? r.plan.join(" | ") : "no query plan"),
      check("rows", "The count of March orders", sameRowsUnordered(r.rows, EXPECTED["sql-06-plan"]), r.rows.length ? `got ${JSON.stringify(r.rows[0])}` : "no rows"),
    ],
    solution: "SELECT COUNT(*) AS march_orders\nFROM orders\nWHERE placed_at >= '2026-03-01' AND placed_at < '2026-04-01';",
  },
];

/** Rows the reference solutions produce in SQLite; the tests regenerate and compare them. */
export const EXPECTED: Record<string, SqlRunResult["rows"]> = {
  "sql-01-join": [["east", 14640], ["west", 13390], ["north", 9330], ["south", 7715]],
  "sql-02-index": [[28, "2026-01-05", "shipped"], [208, "2026-01-05", "shipped"], [388, "2026-01-05", "shipped"], [88, "2026-03-06", "shipped"], [268, "2026-03-06", "shipped"], [148, "2026-05-05", "shipped"], [328, "2026-05-05", "shipped"]],
  "sql-05-view": [[14, "Customer 14", 2100], [50, "Customer 50", 2100], [2, "Customer 2", 1800], [26, "Customer 26", 1800], [6, "Customer 6", 1540]],
  "sql-06-plan": [[68]],
};

export const SQL_EXERCISE_BY_ID = new Map(SQL_EXERCISES.map((e) => [e.id, e]));
