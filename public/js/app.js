// Invoice Generator — UI logic.
const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
const authView = $("auth-view");
const appView = $("app-view");
const authForm = $("auth-form");
const authTitle = $("auth-title");
const authSubmit = $("auth-submit");
const authToggle = $("auth-toggle");
const authStatus = $("auth-status");
const nameField = $("auth-name");
const nameLabel = $("name-label");

let authMode = "login";

function showAuth() {
  authView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  authView.hidden = true;
  appView.hidden = false;
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.hidden = false;
  authStatus.style.color = isError ? "#b91c1c" : "";
}

authToggle.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  authTitle.textContent = authMode === "login" ? "Sign In" : "Create Account";
  authSubmit.textContent = authMode === "login" ? "Sign In" : "Create Account";
  nameField.hidden = nameLabel.hidden = authMode !== "register";
  authStatus.hidden = true;
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  try {
    if (authMode === "register") {
      const name = nameField.value.trim();
      if (!name) return setAuthStatus("Please enter your name.", true);
      const { token } = await API.register(name, email, password);
      API.setToken(token);
    } else {
      const { token } = await API.login(email, password);
      API.setToken(token);
    }
    authForm.reset();
    showApp();
    init();
  } catch (err) {
    setAuthStatus(err.message, true);
  }
});

$("logout-button").addEventListener("click", async () => {
  await API.logout();
  API.setToken(null);
  showAuth();
});

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let lineItems = [];
let itemIdCounter = 0;
let currentSavedId = null;
let isDirty = false;
let savedInvoices = [];
let fetchedClients = [];
let linkedClientId = null;

const STATUS_LABELS = { draft: "Draft", sent: "Sent", paid: "Paid" };

// ═══════════════════════════════════════════════
// LINE ITEMS
// ═══════════════════════════════════════════════
function addLineItem(description, qty, price) {
  const id = ++itemIdCounter;
  lineItems.push({
    id,
    description: description || "",
    qty: qty || 1,
    price: price !== undefined ? price : 0,
  });
  markDirty();
  renderLineItems();
  updatePreview();
}

function removeLineItem(id) {
  lineItems = lineItems.filter((item) => item.id !== id);
  markDirty();
  renderLineItems();
  updatePreview();
}

function renderLineItems() {
  const container = $("lineItemsContainer");
  container.innerHTML = "";
  lineItems.forEach((item) => {
    const lineTotal = item.qty * item.price;
    const div = document.createElement("div");
    div.className = "line-item";
    div.dataset.id = item.id;
    div.innerHTML = `
      <div class="form-group">
        <label>Description</label>
        <input type="text" class="item-desc" placeholder="e.g. Website design" value="${escAttr(item.description)}">
      </div>
      <div class="form-group">
        <label>Qty</label>
        <input type="number" class="item-qty" min="0" step="0.01" value="${item.qty}">
      </div>
      <div class="form-group">
        <label>Unit Price</label>
        <input type="number" class="item-price" min="0" step="0.01" value="${item.price}">
      </div>
      <div class="form-group">
        <label>Total</label>
        <input type="text" class="item-line-total" value="$${lineTotal.toFixed(2)}" readonly style="background:#eef;">
      </div>
      <button class="remove-btn" title="Remove">✕</button>
    `;
    const descInput = div.querySelector(".item-desc");
    const qtyInput = div.querySelector(".item-qty");
    const priceInput = div.querySelector(".item-price");
    const totalInput = div.querySelector(".item-line-total");
    const sync = () => {
      item.description = descInput.value;
      item.qty = Number(qtyInput.value) || 0;
      item.price = Number(priceInput.value) || 0;
      totalInput.value = "$" + (item.qty * item.price).toFixed(2);
      markDirty();
      updatePreview();
    };
    descInput.addEventListener("input", sync);
    qtyInput.addEventListener("input", sync);
    priceInput.addEventListener("input", sync);
    div.querySelector(".remove-btn").addEventListener("click", () => removeLineItem(item.id));
    container.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// FORM STATE
// ═══════════════════════════════════════════════
function gatherFormState() {
  return {
    number: $("invoiceNumber").value.trim(),
    status: $("invoiceStatus").value,
    issueDate: $("issueDate").value,
    dueDate: $("dueDate").value,
    clientName: $("clientName").value.trim(),
    clientEmail: $("clientEmail").value.trim(),
    clientCompany: $("clientCompany").value.trim(),
    taxRate: Number($("taxRate").value) || 0,
    discountPct: Number($("discountPct").value) || 0,
    notes: $("invoiceNotes").value,
    lineItems: lineItems.map((item) => ({
      description: item.description,
      qty: item.qty,
      price: item.price,
    })),
    clientId: linkedClientId,
  };
}

function applyFormState(state) {
  $("invoiceNumber").value = state.number || "";
  $("invoiceStatus").value = state.status || "draft";
  $("issueDate").value = state.issueDate || "";
  $("dueDate").value = state.dueDate || "";
  $("clientName").value = state.clientName || "";
  $("clientEmail").value = state.clientEmail || "";
  $("clientCompany").value = state.clientCompany || "";
  $("taxRate").value = state.taxRate || 0;
  $("discountPct").value = state.discountPct || 0;
  $("invoiceNotes").value = state.notes || "";
  linkedClientId = state.clientId || null;
  lineItems = (state.lineItems || []).map((item, i) => ({
    id: i + 1,
    description: item.description || "",
    qty: item.qty || 0,
    price: item.price || 0,
  }));
  itemIdCounter = lineItems.length;
  isDirty = false;
  renderLineItems();
  updatePreview();
}

function markDirty() {
  isDirty = true;
}

// ═══════════════════════════════════════════════
// SAVED INVOICES
// ═══════════════════════════════════════════════
async function rebuildSavedSelect() {
  const select = $("savedInvoicesSelect");
  const searchInput = $("searchSaved");
  const currentVal = select.value;
  const searchVal = (searchInput ? searchInput.value : "").toLowerCase().trim();
  try {
    savedInvoices = await API.listInvoices({ search: searchVal });
  } catch {
    savedInvoices = [];
  }
  select.innerHTML = '<option value="">— Saved invoices —</option>';
  if (searchVal && savedInvoices.length === 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "No matches found";
    select.appendChild(opt);
  }
  savedInvoices.forEach((inv) => {
    const opt = document.createElement("option");
    opt.value = inv.id;
    const date = new Date(inv.updatedAt.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "2-digit",
    });
    const label = inv.number + " - " + (inv.clientName || "No client") + " (" + STATUS_LABELS[inv.status] + ")";
    opt.textContent = searchVal ? label + " (" + date + ") 🔍" : label + " (" + date + ")";
    select.appendChild(opt);
  });
  const availableValues = [...select.options].map((o) => o.value).filter(Boolean);
  if (currentVal && availableValues.includes(currentVal)) {
    select.value = currentVal;
  } else if (savedInvoices.length > 0) {
    select.value = savedInvoices[0].id;
  } else {
    select.value = "";
  }
  updateSaveStatus();
}

function updateSaveStatus() {
  const el = $("saveStatus");
  if (!el) return;
  const count = savedInvoices.length;
  el.textContent = count > 0 ? count + " saved invoice" + (count > 1 ? "s" : "") : "";
  el.className = "save-status" + (count > 0 ? " ok" : "");
}

async function saveCurrentInvoice() {
  const state = gatherFormState();
  try {
    if (currentSavedId) {
      await API.updateInvoice(currentSavedId, state);
      showStatus("Invoice updated!", "ok");
    } else {
      const created = await API.createInvoice(state);
      currentSavedId = created.id;
      showStatus("Invoice saved!", "ok");
    }
    isDirty = false;
    await rebuildSavedSelect();
    $("savedInvoicesSelect").value = currentSavedId;
    await refreshReminderHistory(currentSavedId);
  } catch (err) {
    alert(err.message);
  }
}

async function loadSelectedInvoice() {
  const select = $("savedInvoicesSelect");
  const id = select.value;
  if (!id) { showStatus("Select an invoice to load.", "warn"); return; }
  if (isDirty && !confirm("You have unsaved changes. Load anyway?")) return;
  try {
    const full = await API.getInvoice(id);
    applyFormState(full);
    currentSavedId = id;
    await refreshReminderHistory(id);
    showStatus("Invoice loaded!", "ok");
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSelectedInvoice() {
  const select = $("savedInvoicesSelect");
  const id = select.value;
  if (!id) { showStatus("Select an invoice to delete.", "warn"); return; }
  if (!confirm("Delete this saved invoice?")) return;
  try {
    await API.deleteInvoice(id);
    if (currentSavedId === id) {
      currentSavedId = null;
    }
    await rebuildSavedSelect();
    await refreshReminderHistory(null);
    await refreshOverdueList();
    showStatus("Invoice deleted.", "ok");
  } catch (err) {
    alert(err.message);
  }
}

async function duplicateInvoice() {
  if (!currentSavedId) { showStatus("Load an invoice first to duplicate it.", "warn"); return; }
  try {
    const copy = await API.duplicateInvoice(currentSavedId);
    currentSavedId = copy.id;
    applyFormState(copy);
    await rebuildSavedSelect();
    $("savedInvoicesSelect").value = copy.id;
    showStatus("Duplicated as " + copy.number, "ok");
  } catch (err) {
    alert(err.message);
  }
}

function showStatus(msg, type) {
  const bar = document.querySelector(".save-load-bar");
  let statusEl = $("saveStatus");
  if (!statusEl) {
    statusEl = document.createElement("span");
    statusEl.id = "saveStatus";
    statusEl.className = "save-status";
    bar.appendChild(statusEl);
  }
  statusEl.textContent = msg;
  statusEl.className = "save-status " + (type || "ok");
  setTimeout(() => updateSaveStatus(), 3000);
}

// ═══════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════
function computeTotals() {
  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountPct = Number($("discountPct").value) || 0;
  const taxRate = Number($("taxRate").value) || 0;
  const discount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (taxRate / 100);
  return {
    subtotal,
    discount,
    tax,
    total: afterDiscount + tax,
    discountPct,
    taxRate,
  };
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function updatePreview() {
  $("previewNumber").textContent = $("invoiceNumber").value || "INV-____";
  const status = $("invoiceStatus").value;
  const badge = $("previewStatus");
  badge.textContent = STATUS_LABELS[status] || status;
  badge.className = "status-badge " + (status === "draft" ? "" : status);
  $("previewClientName").textContent = $("clientName").value || "—";
  $("previewClientCompany").textContent = $("clientCompany").value || "";
  $("previewClientEmail").textContent = $("clientEmail").value || "";
  $("previewIssueDate").textContent = formatDate($("issueDate").value);
  $("previewDueDate").textContent = formatDate($("dueDate").value);

  const tbody = $("previewTableBody");
  tbody.innerHTML = "";
  lineItems.forEach((item) => {
    const total = item.qty * item.price;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escHtml(item.description || "(no description)")}</td>
      <td>${item.qty}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>$${total.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
  if (lineItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#999;text-align:center;padding:1rem 0;">No line items added yet</td></tr>';
  }

  const totals = computeTotals();
  $("previewSubtotal").textContent = "$" + totals.subtotal.toFixed(2);
  $("previewDiscountLabel").textContent = totals.discountPct + "%";
  $("previewDiscount").textContent = "-$" + totals.discount.toFixed(2);
  $("previewTaxLabel").textContent = totals.taxRate + "%";
  $("previewTax").textContent = "$" + totals.tax.toFixed(2);
  $("previewTotal").textContent = "$" + totals.total.toFixed(2);
  $("previewNotes").textContent = $("invoiceNotes").value || "";
}

// ═══════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════
function exportInvoiceJSON() {
  const state = gatherFormState();
  state.exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Invoice-" + (state.number || "export") + ".json";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("JSON exported!", "ok");
}

function importInvoiceJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const state = JSON.parse(e.target.result);
      if (!state.number && !state.clientName) {
        alert("This doesn't appear to be a valid invoice file.");
        return;
      }
      applyFormState(state);
      currentSavedId = null;
      $("savedInvoicesSelect").value = "";
      showStatus("Invoice imported from file!", "ok");
    } catch {
      alert("Failed to parse JSON file.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function exportInvoiceCSV() {
  const state = gatherFormState();
  const totals = computeTotals();
  const rows = [
    ["Invoice", state.number || ""],
    ["Client", state.clientName || ""],
    ["Company", state.clientCompany || ""],
    ["Status", state.status || ""],
    [],
    ["Description", "Qty", "Unit Price", "Total"],
    ...state.lineItems.map((item) => [
      item.description,
      item.qty,
      item.price.toFixed(2),
      (item.qty * item.price).toFixed(2),
    ]),
    [],
    ["Subtotal", "", "", totals.subtotal.toFixed(2)],
    ["Discount (" + totals.discountPct + "%)", "", "", "-" + totals.discount.toFixed(2)],
    ["Tax (" + totals.taxRate + "%)", "", "", totals.tax.toFixed(2)],
    ["Total", "", "", totals.total.toFixed(2)],
  ];
  const csv = rows
    .map((r) => r.map((c) => '"' + String(c === undefined || c === null ? "" : c).replace(/"/g, '""') + '"').join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Invoice-" + (state.number || "export") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("CSV exported!", "ok");
}

// ═══════════════════════════════════════════════
// CLIENT TRACKER INTEGRATION
// ═══════════════════════════════════════════════
function loadTrackerSettings() {
  $("ctUrl").value = localStorage.getItem("invoice-generator.ctUrl") || "http://localhost:3000";
  // Auto-fill the token from the shared SSO cookie (current session first).
  $("ctToken").value = getCookie("slugworth_token") || localStorage.getItem("invoice-generator.ctToken") || "";
}

async function fetchClientsFromTracker() {
  const url = $("ctUrl").value.trim().replace(/\/+$/, "");
  const token = $("ctToken").value.trim();
  if (!url || !token) {
    alert("Enter the Client Tracker URL and API token.");
    return;
  }
  localStorage.setItem("invoice-generator.ctUrl", url);
  localStorage.setItem("invoice-generator.ctToken", token);
  try {
    const res = await fetch(url + "/api/clients", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) throw new Error("Client Tracker returned HTTP " + res.status);
    fetchedClients = await res.json();
    const select = $("ctClientSelect");
    select.innerHTML =
      '<option value="">— Select a client —</option>' +
      fetchedClients
        .map(
          (c) =>
            '<option value="' + escAttr(c.id) + '">' +
            escHtml(c.name) +
            (c.company ? " (" + escHtml(c.company) + ")" : "") +
            "</option>"
        )
        .join("");
    showStatus(fetchedClients.length + " clients loaded from Client Tracker", "ok");
  } catch (err) {
    alert("Could not reach Client Tracker: " + err.message);
  }
}

function applyTrackerClient() {
  const select = $("ctClientSelect");
  const id = select.value;
  if (!id) return;
  const client = fetchedClients.find((c) => String(c.id) === String(id));
  if (!client) return;
  $("clientName").value = client.name || "";
  $("clientEmail").value = client.email || "";
  $("clientCompany").value = client.company || "";
  linkedClientId = client.id;
  markDirty();
  updatePreview();
  showStatus('Client "' + client.name + '" applied to invoice', "ok");
}

// ═══════════════════════════════════════════════
// PRINT / EMAIL
// ═══════════════════════════════════════════════
function printInvoice() {
  const number = $("invoiceNumber").value || "INV-____";
  const previewContent = $("previewPaper").innerHTML;
  const w = window.open("", "_blank");
  w.document.write("<!DOCTYPE html>\n<html><head><title>Invoice — " + number + "</title>\n" +
    "<style>\n" +
    "  @page { margin: 0.5in; }\n" +
    "  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; padding: 0; margin: 0; }\n" +
    "  .print-paper { max-width: 700px; margin: 0 auto; padding: 20px; }\n" +
    "  .preview-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #064e3b; padding-bottom: 1.25rem; margin-bottom: 1.25rem; }\n" +
    "  .invoice-title { font-size: 1.6rem; font-weight: 700; color: #064e3b; letter-spacing: 2px; }\n" +
    "  .invoice-number { font-size: 0.85rem; color: #777; margin-top: 0.2rem; }\n" +
    "  .status-badge { padding: 0.3rem 0.8rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: #e5e7eb; color: #374151; }\n" +
    "  .status-badge.sent { background: #dbeafe; color: #1d4ed8; }\n" +
    "  .status-badge.paid { background: #dcfce7; color: #15803d; }\n" +
    "  .preview-meta { display: flex; justify-content: space-between; margin-bottom: 1.25rem; font-size: 0.85rem; }\n" +
    "  .meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; font-weight: 700; }\n" +
    "  .muted { color: #777; }\n" +
    "  .meta-dates { text-align: right; }\n" +
    "  .preview-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.85rem; }\n" +
    "  .preview-table th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #064e3b; color: #064e3b; font-size: 0.7rem; text-transform: uppercase; }\n" +
    "  .preview-table td { padding: 0.5rem; border-bottom: 1px solid #eee; }\n" +
    "  .preview-table td:last-child, .preview-table th:last-child { text-align: right; }\n" +
    "  .preview-table td:nth-child(2), .preview-table th:nth-child(2), .preview-table td:nth-child(3), .preview-table th:nth-child(3) { text-align: center; }\n" +
    "  .preview-totals { margin-left: auto; width: 220px; margin-bottom: 1.2rem; }\n" +
    "  .preview-totals .row { display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.85rem; }\n" +
    "  .preview-totals .row.total { font-weight: 700; font-size: 1.1rem; border-top: 2px solid #064e3b; padding-top: 0.5rem; margin-top: 0.3rem; color: #064e3b; }\n" +
    "  .preview-notes { font-size: 0.78rem; color: #555; background: #f6f8fa; padding: 0.8rem; border-radius: 6px; margin-bottom: 1.2rem; white-space: pre-wrap; border-left: 3px solid #059669; }\n" +
    "  .preview-footer { display: flex; justify-content: space-between; border-top: 1px solid #dde2e8; padding-top: 1rem; margin-top: 0.5rem; font-size: 0.72rem; color: #888; }\n" +
    "  .sig-line { text-align: right; }\n" +
    "  .sig-line .line { width: 180px; border-top: 1px solid #333; margin-top: 0.3rem; display: inline-block; }\n" +
    "</style></head><body>\n" +
    '<div class="print-paper">' + previewContent + "</div>\n" +
    "<script>window.onload=function(){window.print();window.close();}<\\/script>\n" +
    "</body></html>");
  w.document.close();
}

function emailInvoice() {
  const clientEmail = $("clientEmail").value.trim();
  if (!clientEmail) {
    alert('Please enter a client email address in the "Client Email" field.');
    return;
  }
  const number = $("invoiceNumber").value || "INV-____";
  const clientName = $("clientName").value || "Client";
  const total = $("previewTotal").textContent;
  const dueDate = $("previewDueDate").textContent;
  const notes = $("invoiceNotes").value;
  const subject = encodeURIComponent("Invoice " + number + " — " + total);
  const body = encodeURIComponent(
    "Hi " + clientName + ",\n\n" +
    "Please find invoice " + number + " for " + total + ".\n" +
    (dueDate !== "—" ? "Due date: " + dueDate + "\n" : "") +
    "\n── Details ──\n" + notes + "\n\n" +
    "Thank you for your business!\n"
  );
  window.open("mailto:" + encodeURIComponent(clientEmail) + "?subject=" + subject + "&body=" + body, "_blank");
  showStatus("Email client opened!", "ok");
}

// ═══════════════════════════════════════════════
// PDF DOWNLOAD (server-side)
// ═══════════════════════════════════════════════
async function downloadPdf() {
  const state = gatherFormState();
  const filename = "Invoice-" + (state.number || "invoice").replace(/[^A-Za-z0-9_-]/g, "_") + ".pdf";
  try {
    await API.generateInvoicePdf(state, filename);
    showStatus("PDF generated!", "ok");
  } catch (err) {
    alert(err.message);
  }
}

// ═══════════════════════════════════════════════
// PAYMENT REMINDERS
// ═══════════════════════════════════════════════
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));
}

// Open a pre-filled reminder email and record the reminder.
async function sendReminder(invoice) {
  if (!invoice.clientEmail) {
    alert('This invoice has no client email. Add one in the "Client Email" field first.');
    return;
  }
  const note = $("reminderNote").value.trim();
  const overdue = daysOverdue(invoice.dueDate);
  const subject = encodeURIComponent("Payment reminder: " + invoice.number);
  const body = encodeURIComponent(
    "Hi " + (invoice.clientName || "there") + ",\n\n" +
    "This is a friendly reminder that invoice " + invoice.number +
    " for " + money(invoice.total) + " is " +
    (overdue > 0 ? overdue + " day(s) past due" : "due") +
    (invoice.dueDate ? " (due " + formatDate(invoice.dueDate) + ")." : ".") +
    "\n\nPlease let us know if you have any questions, or if payment has already been sent.\n\n" +
    "Thank you for your business!\n"
  );
  window.open("mailto:" + encodeURIComponent(invoice.clientEmail) + "?subject=" + subject + "&body=" + body, "_blank");
  try {
    await API.recordReminder(invoice.id, note || "Reminder email sent");
    showStatus("Reminder recorded for " + invoice.number, "ok");
    await refreshReminderHistory(invoice.id);
    await refreshOverdueList();
  } catch (err) {
    alert("Reminder email opened, but could not be recorded: " + err.message);
  }
}

// Send a reminder for the currently loaded invoice.
async function sendReminder() {
  if (!currentSavedId) {
    showStatus("Save the invoice first, then send a reminder.", "warn");
    return;
  }
  try {
    const inv = await API.getInvoice(currentSavedId);
    await sendReminder(inv);
  } catch (err) {
    alert(err.message);
  }
}

// Send a reminder for an invoice from the overdue list.
async function sendReminderFor(id) {
  try {
    const inv = await API.getInvoice(id);
    await sendReminder(inv);
  } catch (err) {
    alert(err.message);
  }
}

async function refreshReminderHistory(invoiceId) {
  const container = $("reminderHistory");
  if (!container) return;
  if (!invoiceId) {
    container.innerHTML = '<p class="muted-note">Load or save an invoice to see its reminder history.</p>';
    return;
  }
  try {
    const reminders = await API.listReminders(invoiceId);
    if (reminders.length === 0) {
      container.innerHTML = '<p class="muted-note">No reminders sent for this invoice yet.</p>';
      return;
    }
    container.innerHTML = reminders
      .map((r) => {
        const when = new Date(r.sentAt.replace(" ", "T") + "Z").toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        });
        return '<div class="reminder-item"><span class="reminder-date">' + when + "</span>" +
          '<span class="reminder-note">' + escHtml(r.note || "") + "</span></div>";
      })
      .join("");
  } catch {
    container.innerHTML = '<p class="muted-note">Could not load reminder history.</p>';
  }
}

async function refreshOverdueList() {
  const container = $("overdueList");
  if (!container) return;
  try {
    const overdue = await API.listOverdueInvoices();
    if (overdue.length === 0) {
      container.innerHTML = '<p class="muted-note">No overdue invoices. 🎉</p>';
      return;
    }
    container.innerHTML = overdue
      .map((inv) =>
        '<div class="overdue-item">' +
          '<div class="overdue-info"><strong>' + escHtml(inv.number) + "</strong> — " +
            escHtml(inv.clientName || "No client") +
            ' <span class="overdue-days">' + inv.daysOverdue + "d overdue</span></div>" +
          '<div class="overdue-meta">Due ' + formatDate(inv.dueDate) + " · " +
            escHtml(inv.clientEmail || "no email") + "</div>" +
          '<div class="overdue-actions">' +
            '<span class="overdue-total">' + money(inv.total) + "</span>" +
            '<button class="btn-email btn-sm" onclick="sendReminderFor(' + inv.id + ')">✉️ Remind</button>' +
            '<button class="btn-secondary btn-sm" onclick="loadInvoiceById(' + inv.id + ')">Open</button>' +
          "</div>" +
        "</div>"
      )
      .join("");
  } catch {
    container.innerHTML = '<p class="muted-note">Could not load overdue invoices.</p>';
  }
}

// Load an invoice by id (used by the overdue list's "Open" button).
async function loadInvoiceById(id) {
  try {
    const full = await API.getInvoice(id);
    applyFormState(full);
    currentSavedId = id;
    await rebuildSavedSelect();
    $("savedInvoicesSelect").value = id;
    await refreshReminderHistory(id);
    showStatus("Invoice loaded!", "ok");
  } catch (err) {
    alert(err.message);
  }
}

// ═══════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════
async function resetInvoice() {
  if (!confirm("Reset the form? Unsaved changes will be lost.")) return;
  const t = new Date();
  $("issueDate").value = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  $("dueDate").value = "";
  $("clientName").value = "";
  $("clientEmail").value = "";
  $("clientCompany").value = "";
  $("taxRate").value = 0;
  $("discountPct").value = 0;
  $("invoiceNotes").value = "";
  $("invoiceStatus").value = "draft";
  linkedClientId = null;
  lineItems = [];
  itemIdCounter = 0;
  currentSavedId = null;
  isDirty = false;
  try {
    const { number } = await API.nextNumber();
    $("invoiceNumber").value = number;
  } catch {
    $("invoiceNumber").value = "INV-0001";
  }
  $("savedInvoicesSelect").value = "";
  addLineItem("", 1, 0);
  updatePreview();
  refreshReminderHistory(null);
  refreshOverdueList();
  showStatus("Form reset.", "ok");
}

// ═══════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  const t = new Date();
  $("issueDate").value = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  const searchInput = $("searchSaved");
  if (searchInput) {
    searchInput.addEventListener("input", rebuildSavedSelect);
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        loadSelectedInvoice();
      }
    });
  }
  loadTrackerSettings();
  try {
    const { number } = await API.nextNumber();
    $("invoiceNumber").value = number;
  } catch {
    $("invoiceNumber").value = "INV-0001";
  }
  await rebuildSavedSelect();
  if (lineItems.length === 0) {
    addLineItem("", 1, 0);
  }
  updatePreview();
  markDirty();
  refreshOverdueList();
  refreshReminderHistory(null);

  // Deep link: ?invoice=<id> loads that invoice (used by the Scheduling Tool's
  // "View Invoice" link).
  const params = new URLSearchParams(window.location.search);
  const invoiceParam = params.get("invoice");
  if (invoiceParam) {
    try {
      const full = await API.getInvoice(invoiceParam);
      applyFormState(full);
      currentSavedId = full.id;
      await rebuildSavedSelect();
      $("savedInvoicesSelect").value = full.id;
      await refreshReminderHistory(full.id);
      showStatus("Invoice loaded from link!", "ok");
    } catch {
      showStatus("Could not load linked invoice.", "warn");
    }
  }
}

// ─── Boot ───
async function boot() {
  if (API.token) {
    try {
      await API.me();
      showApp();
      init();
    } catch {
      API.setToken(null);
      showAuth();
    }
  } else {
    showAuth();
  }
}
boot();