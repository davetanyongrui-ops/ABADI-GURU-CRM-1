const API_BASE = '/api';

export async function fetchJson(endpoint, options = {}) {
  const token = localStorage.getItem('alfa_crm_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const crmApi = {
  // Users
  getUsers: () => fetchJson('/users'),

  // Search
  search: (query) => fetchJson(`/search?q=${encodeURIComponent(query)}`),

  // Dashboard
  getDashboardStats: () => fetchJson('/dashboard/stats'),

  // Leads
  getLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/leads${q ? `?${q}` : ''}`);
  },
  getLead: (id) => fetchJson(`/leads/${id}`),
  createLead: (data) => fetchJson('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id, data) => fetchJson(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: (id) => fetchJson(`/leads/${id}`, { method: 'DELETE' }),
  convertLead: (id, data) => fetchJson(`/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  // Accounts
  getAccounts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/accounts${q ? `?${q}` : ''}`);
  },
  getAccount: (id) => fetchJson(`/accounts/${id}`),
  createAccount: (data) => fetchJson('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => fetchJson(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => fetchJson(`/accounts/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/contacts${q ? `?${q}` : ''}`);
  },
  getContact: (id) => fetchJson(`/contacts/${id}`),
  createContact: (data) => fetchJson('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) => fetchJson(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => fetchJson(`/contacts/${id}`, { method: 'DELETE' }),

  // Deals
  getDeals: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/deals${q ? `?${q}` : ''}`);
  },
  getDeal: (id) => fetchJson(`/deals/${id}`),
  createDeal: (data) => fetchJson('/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id, data) => fetchJson(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateDealStage: (id, stage) => fetchJson(`/deals/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
  deleteDeal: (id) => fetchJson(`/deals/${id}`, { method: 'DELETE' }),

  // Activities
  getActivities: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/activities${q ? `?${q}` : ''}`);
  },
  createActivity: (data) => fetchJson('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id, data) => fetchJson(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleActivityStatus: (id) => fetchJson(`/activities/${id}/toggle-status`, { method: 'PUT' }),
  deleteActivity: (id) => fetchJson(`/activities/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => fetchJson('/products'),
  createProduct: (data) => fetchJson('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => fetchJson(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => fetchJson('/products/${id}', { method: 'DELETE' }),

  // Quotes, Delivery Orders & Invoices
  getQuotes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/quotes${q ? `?${q}` : ''}`);
  },
  getQuote: (id) => fetchJson(`/quotes/${id}`),
  createQuote: (data) => fetchJson('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  convertQuoteToDo: (id, data = {}) => fetchJson(`/quotes/${id}/convert-do`, { method: 'POST', body: JSON.stringify(data) }),
  convertQuoteToInvoice: (id, data = {}) => fetchJson(`/quotes/${id}/convert-invoice`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuoteStage: (id, quote_stage) => fetchJson(`/quotes/${id}/stage`, { method: 'PUT', body: JSON.stringify({ quote_stage }) }),
  deleteQuote: (id) => fetchJson(`/quotes/${id}`, { method: 'DELETE' }),
  emailQuote: (id, data = {}) => fetchJson(`/quotes/${id}/email`, { method: 'POST', body: JSON.stringify(data) }),
  getQuotePdfUrl: (id) => {
    const token = localStorage.getItem('alfa_crm_token') || localStorage.getItem('alfa_auth_token');
    return `${API_BASE}/quotes/${id}/pdf${token ? `?token=${token}` : ''}`;
  },

  // Notes
  getNotes: (type, id) => fetchJson(`/notes?related_to_type=${type}&related_to_id=${id}`),
  createNote: (data) => fetchJson('/notes', { method: 'POST', body: JSON.stringify(data) }),
  deleteNote: (id) => fetchJson(`/notes/${id}`, { method: 'DELETE' }),

  // Workflows
  getWorkflows: () => fetchJson('/workflows'),
  createWorkflow: (data) => fetchJson('/workflows', { method: 'POST', body: JSON.stringify(data) }),
  toggleWorkflow: (id) => fetchJson(`/workflows/${id}/toggle`, { method: 'PUT' }),

  // Custom Fields
  getCustomFields: (entity) => fetchJson(`/custom-fields${entity ? `?entity=${entity}` : ''}`),
  createCustomField: (data) => fetchJson('/custom-fields', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomField: (id) => fetchJson(`/custom-fields/${id}`, { method: 'DELETE' }),

  // Export / Import
  getExportUrl: (entity) => {
    const token = localStorage.getItem('alfa_crm_token') || localStorage.getItem('alfa_auth_token');
    return `${API_BASE}/export/${entity}${token ? `?token=${token}` : ''}`;
  },
  importLeads: (leads) => fetchJson('/import/leads', { method: 'POST', body: JSON.stringify({ leads }) }),

  // Reports & BI Analytics
  getFunnelReport: () => fetchJson('/reports/funnel'),
  getMonthlyTrendReport: () => fetchJson('/reports/monthly-trend'),
  getQuotasReport: () => fetchJson('/reports/quotas'),
  getInsightsReport: () => fetchJson('/reports/insights'),

  // Emails (Zoho SalesInbox Simulator)
  getEmailTemplates: () => fetchJson('/email-templates'),
  getEmails: (type, id) => fetchJson(`/emails${type && id ? `?related_to_type=${type}&related_to_id=${id}` : ''}`),
  sendEmail: (data) => fetchJson('/emails/send', { method: 'POST', body: JSON.stringify(data) }),

  // Reset System
  resetDemoData: () => fetchJson('/system/reset-demo', { method: 'POST' }),

  // AI & Hermes Model Integration
  getAISettings: () => fetchJson('/settings/ai'),
  saveAISettings: (data) => fetchJson('/settings/ai', { method: 'POST', body: JSON.stringify(data) }),
  chatWithAI: (message, history = []) => fetchJson('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),
  testAIConnection: (data) => fetchJson('/ai/test', { method: 'POST', body: JSON.stringify(data) }),

  // Document Branding & Presets
  getBrandingSettings: () => fetchJson('/settings/branding'),
  saveBrandingSettings: (data) => fetchJson('/settings/branding', { method: 'POST', body: JSON.stringify(data) }),
  getCompanySettings: () => fetchJson('/settings/company'),
  saveCompanySettings: (data) => fetchJson('/settings/company', { method: 'POST', body: JSON.stringify(data) }),

  // Outbound Email (SMTP / Resend)
  getEmailSettings: () => fetchJson('/settings/email'),
  saveEmailSettings: (data) => fetchJson('/settings/email', { method: 'POST', body: JSON.stringify(data) }),
  testEmailSettings: (toEmail) => fetchJson('/settings/email/test', { method: 'POST', body: JSON.stringify({ toEmail }) }),

  // 1-Click Database Backup
  getDatabaseBackupUrl: () => {
    const token = localStorage.getItem('alfa_crm_token') || localStorage.getItem('alfa_auth_token');
    return `${API_BASE}/backup/database${token ? `?token=${token}` : ''}`;
  },

  // Telegram Bot Remote Control
  getTelegramStatus: () => fetchJson('/telegram/status'),
  startTelegramBot: () => fetchJson('/telegram/start', { method: 'POST' }),
  stopTelegramBot: () => fetchJson('/telegram/stop', { method: 'POST' }),
  testTelegramBot: (chatId, text) => fetchJson('/telegram/test', { method: 'POST', body: JSON.stringify({ chatId, text }) }),
  getTelegramLogs: (limit = 30) => fetchJson(`/telegram/logs?limit=${limit}`),

  // Upcoming Birthdays & Client Special Days
  getSpecialDays: () => fetchJson('/dashboard/special-days'),

  // Sales Team & Agent Management (Multi-User Company Workspace)
  getSalesAgents: () => fetchJson('/team/agents'),
  createSalesAgent: (data) => fetchJson('/team/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateSalesAgent: (id, data) => fetchJson(`/team/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSalesAgent: (id) => fetchJson(`/team/agents/${id}`, { method: 'DELETE' }),
  getAgentPermissions: (id) => fetchJson(`/team/agents/${id}/permissions`),
  updateAgentPermissions: (id, data) => fetchJson(`/team/agents/${id}/permissions`, { method: 'PUT', body: JSON.stringify(data) }),
  resetTelegramCode: (id) => fetchJson(`/team/agents/${id}/telegram-code/reset`, { method: 'POST' }),

  // Authentication & Multi-Company Workspace System
  login: (email, password) => fetchJson('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (data) => fetchJson('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  createCompanyWorkspace: (data) => fetchJson('/companies/create', { method: 'POST', body: JSON.stringify(data) }),
  getCurrentUser: () => fetchJson('/auth/me'),
  logout: () => fetchJson('/auth/logout', { method: 'POST' }),
  getSubscriptionPlans: () => fetchJson('/subscription/plans'),
  upgradeSubscription: (tier, billingCycle = 'monthly') => fetchJson('/subscription/upgrade', { method: 'POST', body: JSON.stringify({ tier, billingCycle }) }),
  getAdminUsers: () => fetchJson('/admin/users'),
  updateUserSubscription: (id, data) => fetchJson(`/admin/users/${id}/subscription`, { method: 'PUT', body: JSON.stringify(data) }),
};
