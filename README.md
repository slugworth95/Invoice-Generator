# Invoice-Generator

Create, track, and send invoices. A full-stack app: vanilla JS frontend with live preview, Express API, SQLite database, and token-based auth — with built-in integration with [Client-Tracker](https://github.com/slugworth95/Client-Tracker).

## Features

- **Invoice editor** — client info, line items (description, qty, unit price), tax rate, discount, notes
- **Auto-numbering** — next invoice number suggested automatically (`INV-0001`, `INV-0002`, …)
- **Status tracking** — draft / sent / paid with color-coded badges
- **Save & Load** — invoices persist per-user in SQLite; search by number, client, or company
- **Duplicate** — copy an existing invoice with a fresh number
- **Live preview** — subtotal, discount, tax, and total computed automatically
- **Print / Save as PDF** — print-optimized layout
- **Email to Client** — pre-filled email via mail client
- **Export / Import** — JSON export/import (full backup/restore) + CSV export for spreadsheets
- **Client Tracker integration** — fetch clients and auto-fill the bill-to section

## Run locally

Requires Node.js 22.5+ (uses the built-in `node:sqlite` — no native dependencies).

```bash
npm install
npm start
```

Open http://localhost:3002. The SQLite database is created automatically in `data/` (gitignored).

> Note: runs on port **3002** so it can run alongside Client Tracker (3000) and Proposal Builder (3001).

## Project structure

```
Invoice-Generator/
├── server/
│   ├── index.js          # Express app: static frontend + /api routes
│   ├── db.js             # SQLite schema (users, sessions, invoices)
│   ├── auth.js           # register/login + bearer-token middleware
│   └── routes/invoices.js # Invoice CRUD + duplicate + next-number
├── public/               # Frontend (served by Express)
│   ├── index.html
│   ├── css/styles.css
│   └── js/{api.js,app.js}
├── data/                 # SQLite file (created at runtime, gitignored)
└── package.json
```

## API reference

Base URL: `http://localhost:3002` (override with `PORT` env var).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service discovery |

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | Create account. Returns `{ user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | Returns `{ user, token }` |

All endpoints below require `Authorization: Bearer <token>`.

### Invoices

| Method | Path | Description |
|---|---|---|
| GET | `/api/invoices?search=&status=` | List invoices (newest first) |
| GET | `/api/invoices/next-number` | Suggest the next invoice number |
| GET | `/api/invoices/:id` | Get one invoice |
| POST | `/api/invoices` | Create. Body: `{ number?, clientName?, clientEmail?, clientCompany?, issueDate?, dueDate?, status?, taxRate?, discountPct?, notes?, lineItems?, clientId? }` |
| PUT | `/api/invoices/:id` | Update (partial updates allowed) |
| DELETE | `/api/invoices/:id` | Delete |
| POST | `/api/invoices/:id/duplicate` | Copy with a fresh number, status reset to draft |

Invoice shape:

```json
{
  "id": 1,
  "number": "INV-0001",
  "clientName": "Acme Corp",
  "clientEmail": "billing@acme.com",
  "clientCompany": "Acme Inc.",
  "issueDate": "2026-09-11",
  "dueDate": "2026-10-11",
  "status": "draft",
  "taxRate": 7,
  "discountPct": 0,
  "notes": "Payment due within 30 days.",
  "lineItems": [
    { "description": "Website design", "qty": 1, "price": 1500 }
  ],
  "clientId": 3,
  "subtotal": 1500,
  "discount": 0,
  "tax": 105,
  "total": 1605,
  "createdAt": "2026-09-11 12:00:00",
  "updatedAt": "2026-09-11 12:00:00"
}
```

Totals are computed server-side from `lineItems`, `taxRate`, and `discountPct`.

## Integrating with Client Tracker

1. Run Client Tracker (`npm start` in `Client-Tracker`, port 3000) and create an account.
2. In Invoice Generator, open the **Client Tracker Integration** section.
3. Enter `http://localhost:3000` and paste your Client Tracker API token.
4. Click **Fetch Clients**, then pick a client — the bill-to section auto-fills.

## Roadmap

- [x] Invoice editor with live totals
- [x] Auto-numbering, status tracking, duplicate
- [x] Server-side persistence with auth
- [x] Client Tracker integration
- [x] JSON export/import + CSV export
- [ ] Payment reminders
- [ ] PDF generation (server-side)