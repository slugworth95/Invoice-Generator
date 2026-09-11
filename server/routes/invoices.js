// Invoice CRUD API.
const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_STATUSES = ["draft", "sent", "paid"];

function parseLineItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      description: String(item.description || "").trim(),
      qty: Number(item.qty) || 0,
      price: Number(item.price) || 0,
    }))
    .filter((item) => item.description);
}

function computeTotals(lineItems, taxRate, discountPct) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = subtotal * ((discountPct || 0) / 100);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * ((taxRate || 0) / 100);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((afterDiscount + tax) * 100) / 100,
  };
}

function serializeInvoice(row) {
  if (!row) return null;
  let lineItems = [];
  try {
    lineItems = JSON.parse(row.line_items);
  } catch {
    lineItems = [];
  }
  const totals = computeTotals(lineItems, row.tax_rate, row.discount_pct);
  return {
    id: row.id,
    number: row.number,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientCompany: row.client_company,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    taxRate: row.tax_rate,
    discountPct: row.discount_pct,
    notes: row.notes,
    lineItems,
    clientId: row.client_id,
    ...totals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nextNumber(userId) {
  const rows = db.prepare("SELECT number FROM invoices WHERE user_id = ?").all(userId);
  let max = 0;
  for (const r of rows) {
    const m = String(r.number).match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "INV-" + String(max + 1).padStart(4, "0");
}

// GET /api/invoices/next-number — suggest the next invoice number
router.get("/next-number", (req, res) => {
  res.json({ number: nextNumber(req.user.id) });
});

// GET /api/invoices?search=&status= — list
router.get("/", (req, res) => {
  const { search = "", status } = req.query;
  let sql = "SELECT * FROM invoices WHERE user_id = ?";
  const params = [req.user.id];
  if (status && VALID_STATUSES.includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (search) {
    sql += " AND (number LIKE ? OR client_name LIKE ? OR client_email LIKE ? OR client_company LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += " ORDER BY updated_at DESC";
  res.json(db.prepare(sql).all(...params).map(serializeInvoice));
});

// GET /api/invoices/:id
router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Invoice not found" });
  res.json(serializeInvoice(row));
});

// POST /api/invoices — create
router.post("/", (req, res) => {
  const body = req.body || {};
  const lineItems = parseLineItems(body.lineItems);
  const number = body.number && String(body.number).trim() ? String(body.number).trim() : nextNumber(req.user.id);
  const status = VALID_STATUSES.includes(body.status) ? body.status : "draft";
  const taxRate = Number(body.taxRate) || 0;
  const discountPct = Number(body.discountPct) || 0;

  const result = db
    .prepare(
      `INSERT INTO invoices
       (user_id, number, client_name, client_email, client_company, issue_date, due_date, status, tax_rate, discount_pct, notes, line_items, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      number,
      body.clientName || null,
      body.clientEmail || null,
      body.clientCompany || null,
      body.issueDate || null,
      body.dueDate || null,
      status,
      taxRate,
      discountPct,
      body.notes || null,
      JSON.stringify(lineItems),
      body.clientId || null
    );
  res
    .status(201)
    .json(serializeInvoice(db.prepare("SELECT * FROM invoices WHERE id = ?").get(Number(result.lastInsertRowid))));
});

// PUT /api/invoices/:id — update
router.put("/:id", (req, res) => {
  const existing = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Invoice not found" });

  const body = req.body || {};
  const lineItems = body.lineItems !== undefined ? parseLineItems(body.lineItems) : JSON.parse(existing.line_items || "[]");
  const number = body.number !== undefined && String(body.number).trim() ? String(body.number).trim() : existing.number;
  const status = body.status !== undefined ? (VALID_STATUSES.includes(body.status) ? body.status : existing.status) : existing.status;
  const taxRate = body.taxRate !== undefined ? Number(body.taxRate) || 0 : existing.tax_rate;
  const discountPct = body.discountPct !== undefined ? Number(body.discountPct) || 0 : existing.discount_pct;

  db.prepare(
    `UPDATE invoices
     SET number = ?, client_name = ?, client_email = ?, client_company = ?, issue_date = ?, due_date = ?,
         status = ?, tax_rate = ?, discount_pct = ?, notes = ?, line_items = ?, client_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    number,
    body.clientName !== undefined ? body.clientName : existing.client_name,
    body.clientEmail !== undefined ? body.clientEmail : existing.client_email,
    body.clientCompany !== undefined ? body.clientCompany : existing.client_company,
    body.issueDate !== undefined ? body.issueDate : existing.issue_date,
    body.dueDate !== undefined ? body.dueDate : existing.due_date,
    status,
    taxRate,
    discountPct,
    body.notes !== undefined ? body.notes : existing.notes,
    JSON.stringify(lineItems),
    body.clientId !== undefined ? body.clientId : existing.client_id,
    existing.id
  );
  res.json(serializeInvoice(db.prepare("SELECT * FROM invoices WHERE id = ?").get(existing.id)));
});

// DELETE /api/invoices/:id
router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM invoices WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Invoice not found" });
  res.status(204).end();
});

// POST /api/invoices/:id/duplicate — copy an invoice with a fresh number
router.post("/:id/duplicate", (req, res) => {
  const existing = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Invoice not found" });

  const result = db
    .prepare(
      `INSERT INTO invoices
       (user_id, number, client_name, client_email, client_company, issue_date, due_date, status, tax_rate, discount_pct, notes, line_items, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      nextNumber(req.user.id),
      existing.client_name,
      existing.client_email,
      existing.client_company,
      existing.issue_date,
      existing.due_date,
      "draft",
      existing.tax_rate,
      existing.discount_pct,
      existing.notes,
      existing.line_items,
      existing.client_id
    );
  res
    .status(201)
    .json(serializeInvoice(db.prepare("SELECT * FROM invoices WHERE id = ?").get(Number(result.lastInsertRowid))));
});

module.exports = router;