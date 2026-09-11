// Server-side PDF generation for invoices.
// Uses pdfkit (pure JS, no native dependencies) with the built-in standard fonts.
const { PDFDocument } = require("pdfkit");

const GREEN = "#064e3b";
const ACCENT = "#059669";
const TEXT = "#1a1a1a";
const MUTED = "#777";
const BORDER = "#dde2e8";
const ROW_BORDER = "#eeeeee";
const NOTE_BG = "#f6f8fa";

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const STATUS_STYLES = {
  draft: { bg: "#e5e7eb", fg: "#374151" },
  sent: { bg: "#dbeafe", fg: "#1d4ed8" },
  paid: { bg: "#dcfce7", fg: "#15803d" },
};

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Start a fresh page if `needed` points won't fit before the footer zone.
function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE_HEIGHT - MARGIN - 40) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

/**
 * Build a PDF for a serialized invoice (the same shape the API returns).
 * Resolves with a Buffer of the finished PDF.
 */
function buildInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: MARGIN,
      info: { Title: "Invoice " + (invoice.number || ""), Author: "Invoice Generator" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = MARGIN;

    // ── Header: title + number (left), status badge (right) ──
    doc.font("Helvetica-Bold").fontSize(26).fillColor(GREEN).text("INVOICE", MARGIN, y, { characterSpacing: 2 });
    y += 34;
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(invoice.number || "INV-____", MARGIN, y);

    const status = invoice.status || "draft";
    const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
    const label = String(status).toUpperCase();
    doc.font("Helvetica-Bold").fontSize(8);
    const badgeW = doc.widthOfString(label) + 24;
    const badgeH = 20;
    const badgeX = PAGE_WIDTH - MARGIN - badgeW;
    doc.roundedRect(badgeX, MARGIN + 6, badgeW, badgeH, 10).fill(style.bg);
    doc.fillColor(style.fg).text(label, badgeX, MARGIN + 6 + 5, { width: badgeW, align: "center" });

    y += 24;
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(2).strokeColor(GREEN).stroke();
    y += 24;

    // ── Bill To (left) + Issue/Due dates (right) ──
    const billToLines = [invoice.clientName || "—"];
    if (invoice.clientCompany) billToLines.push(invoice.clientCompany);
    if (invoice.clientEmail) billToLines.push(invoice.clientEmail);
    const billToText = billToLines.join("\n");

    doc.font("Helvetica-Bold").fontSize(7).fillColor(GREEN).text("BILL TO", MARGIN, y, { characterSpacing: 1 });
    doc.font("Helvetica").fontSize(11).fillColor(TEXT).text(billToText, MARGIN, y + 13, { width: 260 });

    const datesX = PAGE_WIDTH - MARGIN - 200;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GREEN).text("ISSUE DATE", datesX, y, { characterSpacing: 1 });
    doc.font("Helvetica").fontSize(10).fillColor(TEXT).text(formatDate(invoice.issueDate), datesX, y + 12, { width: 200, align: "right" });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GREEN).text("DUE DATE", datesX, y + 30, { characterSpacing: 1 });
    doc.font("Helvetica").fontSize(10).fillColor(TEXT).text(formatDate(invoice.dueDate), datesX, y + 42, { width: 200, align: "right" });

    const billToHeight = doc.heightOfString(billToText, { width: 260 });
    y += Math.max(billToHeight, 62) + 24;

    // ── Line items table ──
    const cols = {
      desc: { x: MARGIN, w: 260, align: "left" },
      qty: { x: MARGIN + 260, w: 50, align: "center" },
      price: { x: MARGIN + 310, w: 80, align: "right" },
      total: { x: MARGIN + 390, w: CONTENT_WIDTH - 340, align: "right" },
    };

    y = ensureSpace(doc, y, 40);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GREEN);
    doc.text("DESCRIPTION", cols.desc.x, y, { width: cols.desc.w, align: cols.desc.align, characterSpacing: 1 });
    doc.text("QTY", cols.qty.x, y, { width: cols.qty.w, align: cols.qty.align, characterSpacing: 1 });
    doc.text("UNIT PRICE", cols.price.x, y, { width: cols.price.w, align: cols.price.align, characterSpacing: 1 });
    doc.text("TOTAL", cols.total.x, y, { width: cols.total.w, align: cols.total.align, characterSpacing: 1 });
    y += 16;
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(2).strokeColor(GREEN).stroke();
    y += 8;

    const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    doc.font("Helvetica").fontSize(10).fillColor(TEXT);
    if (items.length === 0) {
      doc.fillColor(MUTED).text("No line items", MARGIN, y, { width: CONTENT_WIDTH });
      y += 20;
    } else {
      for (const item of items) {
        const desc = String(item.description || "");
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const rowH = doc.heightOfString(desc, { width: cols.desc.w });
        y = ensureSpace(doc, y, rowH + 14);
        doc.text(desc, cols.desc.x, y, { width: cols.desc.w, align: "left" });
        doc.text(String(qty), cols.qty.x, y, { width: cols.qty.w, align: "center" });
        doc.text(money(price), cols.price.x, y, { width: cols.price.w, align: "right" });
        doc.text(money(qty * price), cols.total.x, y, { width: cols.total.w, align: "right" });
        y += Math.max(rowH, 16) + 6;
        doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.5).strokeColor(ROW_BORDER).stroke();
        y += 8;
      }
    }

    // ── Totals ──
    y = ensureSpace(doc, y, 90);
    const totalsX = PAGE_WIDTH - MARGIN - 220;
    const totalsW = 220;
    doc.font("Helvetica").fontSize(10).fillColor(TEXT);
    const totalRows = [
      ["Subtotal", money(invoice.subtotal)],
      ["Discount (" + (invoice.discountPct || 0) + "%)", "-" + money(invoice.discount)],
      ["Tax (" + (invoice.taxRate || 0) + "%)", money(invoice.tax)],
    ];
    for (const [label, value] of totalRows) {
      doc.text(label, totalsX, y, { width: totalsW - 100, align: "left" });
      doc.text(value, totalsX + 100, y, { width: totalsW - 100, align: "right" });
      y += 16;
    }
    y += 4;
    doc.moveTo(totalsX, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(2).strokeColor(GREEN).stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(GREEN);
    doc.text("Total", totalsX, y, { width: totalsW - 100, align: "left" });
    doc.text(money(invoice.total), totalsX + 100, y, { width: totalsW - 100, align: "right" });
    y += 30;

    // ── Notes ──
    if (invoice.notes) {
      const noteH = doc.heightOfString(invoice.notes, { width: CONTENT_WIDTH - 24 });
      y = ensureSpace(doc, y, noteH + 32);
      doc.roundedRect(MARGIN, y, CONTENT_WIDTH, noteH + 20, 6).fill(NOTE_BG);
      doc.fillColor(ACCENT).rect(MARGIN, y, 3, noteH + 20).fill();
      doc.font("Helvetica").fontSize(9).fillColor("#555").text(invoice.notes, MARGIN + 12, y + 10, { width: CONTENT_WIDTH - 24 });
      y += noteH + 32;
    }

    // ── Footer ──
    const footerY = PAGE_HEIGHT - MARGIN - 20;
    doc.moveTo(MARGIN, footerY).lineTo(PAGE_WIDTH - MARGIN, footerY).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#888").text("Thank you for your business!", MARGIN, footerY + 10);
    doc.moveTo(PAGE_WIDTH - MARGIN - 180, footerY + 10).lineTo(PAGE_WIDTH - MARGIN, footerY + 10).lineWidth(0.5).strokeColor(TEXT).stroke();

    doc.end();
  });
}

module.exports = { buildInvoicePdf };