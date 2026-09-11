// SQLite setup and schema. Uses Node's built-in node:sqlite — no native deps.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "invoice-generator.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = OFF;

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    client_name TEXT,
    client_email TEXT,
    client_company TEXT,
    issue_date TEXT,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
    tax_rate REAL NOT NULL DEFAULT 0,
    discount_pct REAL NOT NULL DEFAULT 0,
    notes TEXT,
    line_items TEXT NOT NULL,
    client_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    note TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON reminders(invoice_id);
`);

module.exports = db;