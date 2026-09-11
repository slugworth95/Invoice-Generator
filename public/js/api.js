// Thin fetch wrapper around the Invoice Generator API.
// Stores the bearer token in localStorage.

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearAuthCookie() {
  document.cookie = "slugworth_token=; Path=/; SameSite=Lax; Max-Age=0";
}

const API = {
  token: localStorage.getItem("invoice-generator.token") || getCookie("slugworth_token") || null,

  async request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(path, { ...options, headers });

    if (res.status === 401) {
      this.setToken(null);
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
    }
    return data;
  },

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem("invoice-generator.token", token);
    else {
      localStorage.removeItem("invoice-generator.token");
      clearAuthCookie();
    }
  },

  register(name, email, password) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  login(email, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return this.request("/api/auth/me");
  },

  logout() {
    return this.request("/api/auth/logout", { method: "POST" }).catch(() => null);
  },

  listInvoices(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const q = qs.toString();
    return this.request(`/api/invoices${q ? `?${q}` : ""}`);
  },

  listOverdueInvoices() {
    return this.request("/api/invoices/overdue");
  },

  getInvoice(id) {
    return this.request(`/api/invoices/${id}`);
  },

  nextNumber() {
    return this.request("/api/invoices/next-number");
  },

  createInvoice(invoice) {
    return this.request("/api/invoices", { method: "POST", body: JSON.stringify(invoice) });
  },

  updateInvoice(id, invoice) {
    return this.request(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(invoice) });
  },

  deleteInvoice(id) {
    return this.request(`/api/invoices/${id}`, { method: "DELETE" });
  },

  duplicateInvoice(id) {
    return this.request(`/api/invoices/${id}/duplicate`, { method: "POST" });
  },

  listReminders(id) {
    return this.request(`/api/invoices/${id}/reminders`);
  },

  recordReminder(id, note) {
    return this.request(`/api/invoices/${id}/reminders`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
  },

  // Server-side PDF generation. Returns the PDF as a Blob and triggers a download.
  async downloadInvoicePdf(id, filename) {
    const headers = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    const res = await fetch(`/api/invoices/${id}/pdf`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, (data && data.error) || `PDF download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "invoice.pdf";
    a.click();
    URL.revokeObjectURL(url);
  },

  // Generate a PDF from unsaved form state (POST /api/invoices/pdf).
  async generateInvoicePdf(invoice, filename) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch("/api/invoices/pdf", {
      method: "POST",
      headers,
      body: JSON.stringify(invoice),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, (data && data.error) || `PDF generation failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "invoice.pdf";
    a.click();
    URL.revokeObjectURL(url);
  },
};