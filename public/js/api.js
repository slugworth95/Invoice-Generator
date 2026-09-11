// Thin fetch wrapper around the Invoice Generator API.
// Stores the bearer token in localStorage.

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const API = {
  token: localStorage.getItem("invoice-generator.token") || null,

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
    else localStorage.removeItem("invoice-generator.token");
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

  listInvoices(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status) qs.set("status", params.status);
    const q = qs.toString();
    return this.request(`/api/invoices${q ? `?${q}` : ""}`);
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
};