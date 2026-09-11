// Invoice Generator — starter app logic.
// Invoices are stored in localStorage so they survive page reloads.

const STORAGE_KEY = "invoice-generator.invoices";

function loadInvoices() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveInvoices(invoices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

function parseLineItems(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description, amount] = line.split("|").map((part) => part.trim());
      return { description: description || "Item", amount: Number(amount) || 0 };
    });
}

function calculateTotals(lineItems, taxRate) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * (taxRate / 100);
  return { subtotal, tax, total: subtotal + tax };
}

function renderInvoices() {
  const list = document.getElementById("invoice-list");
  const invoices = loadInvoices();

  if (invoices.length === 0) {
    list.innerHTML = '<li class="empty">No invoices yet.</li>';
    return;
  }

  list.innerHTML = invoices
    .map(
      (inv) =>
        `<li><strong>${escapeHtml(inv.number)}</strong> — ${escapeHtml(
          inv.client
        )} ($${inv.total.toFixed(2)})</li>`
    )
    .join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

document.getElementById("invoice-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const lineItems = parseLineItems(document.getElementById("line-items").value);
  const taxRate = Number(document.getElementById("tax-rate").value) || 0;
  const totals = calculateTotals(lineItems, taxRate);

  const invoice = {
    client: document.getElementById("client-name").value.trim(),
    number: document.getElementById("invoice-number").value.trim(),
    lineItems,
    taxRate,
    ...totals,
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  const invoices = loadInvoices();
  invoices.push(invoice);
  saveInvoices(invoices);

  const status = document.getElementById("status");
  status.textContent = `Invoice ${invoice.number} created for $${invoice.total.toFixed(2)}.`;
  status.hidden = false;

  event.target.reset();
  renderInvoices();
});

renderInvoices();