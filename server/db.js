import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
export const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
const MASTER_DB_FILE = path.join(DATA_DIR, 'master.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(TENANTS_DIR)) {
  fs.mkdirSync(TENANTS_DIR, { recursive: true });
}

// Master Auth and Users Database
export const masterDb = new DatabaseSync(MASTER_DB_FILE);

masterDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'Sales Rep',
    avatar TEXT,
    company TEXT DEFAULT 'Abadi Guru Enterprise Inc.',
    subscription_tier TEXT DEFAULT 'Professional',
    subscription_status TEXT DEFAULT 'trial',
    trial_ends_at TEXT,
    subscription_expires_at TEXT,
    is_superadmin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Master DB Migration for Multi-User & Sales Agents
try {
  const userCols = masterDb.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userCols.includes('tenant_id')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN tenant_id INTEGER").run();
  }
  if (!userCols.includes('phone')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
  }
  if (!userCols.includes('quota_target')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN quota_target REAL DEFAULT 50000").run();
  }
  if (!userCols.includes('status')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
  }
  if (!userCols.includes('created_by')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN created_by INTEGER").run();
  }
  if (!userCols.includes('permissions')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN permissions TEXT").run();
  }
  if (!userCols.includes('telegram_chat_id')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT").run();
  }
  if (!userCols.includes('telegram_link_code')) {
    masterDb.prepare("ALTER TABLE users ADD COLUMN telegram_link_code TEXT").run();
  }

  // Backfill telegram link codes for existing users
  const usersWithoutCode = masterDb.prepare("SELECT id, role FROM users WHERE telegram_link_code IS NULL OR telegram_link_code = ''").all();
  for (const u of usersWithoutCode) {
    const isAdm = (u.role || '').toLowerCase().includes('admin') || (u.role || '').toLowerCase().includes('owner');
    const prefix = isAdm ? 'ADM' : 'AGT';
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    masterDb.prepare("UPDATE users SET telegram_link_code = ? WHERE id = ?").run(code, u.id);
  }

  masterDb.prepare("UPDATE users SET tenant_id = id WHERE tenant_id IS NULL").run();
  masterDb.prepare("UPDATE users SET tenant_id = 1 WHERE id IN (1, 2, 3) AND (tenant_id IS NULL OR tenant_id = id)").run();
} catch (e) {
  console.error('[Master DB Migration]', e.message);
}

export function generateTelegramLinkCode(role = 'agent') {
  const isAdm = (role || '').toLowerCase().includes('admin') || (role || '').toLowerCase().includes('owner');
  const prefix = isAdm ? 'ADM' : 'AGT';
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}`;
}

export const DEFAULT_AGENT_PERMISSIONS = {
  leads: 'assigned',      // 'none' | 'assigned' | 'all'
  contacts: 'assigned',   // 'none' | 'assigned' | 'all'
  accounts: 'assigned',   // 'none' | 'assigned' | 'all'
  deals: 'assigned',      // 'none' | 'assigned' | 'all'
  products: 'none',       // 'none' | 'view' | 'manage'
  quotes: 'assigned',     // 'none' | 'assigned' | 'all'
  automation: 'none',     // 'none' | 'full'
  settings: 'none',       // 'none' | 'full'
  reports: 'none'         // 'none' | 'full'
};

export const ADMIN_PERMISSIONS = {
  leads: 'all',
  contacts: 'all',
  accounts: 'all',
  deals: 'all',
  products: 'manage',
  quotes: 'all',
  automation: 'full',
  settings: 'full',
  reports: 'full'
};

export function isCompanyAdmin(user) {
  if (!user) return false;
  if (user.is_superadmin) return true;
  const role = (user.role || '').toLowerCase();
  return role.includes('admin') || role.includes('owner');
}

export function parseUserPermissions(user) {
  if (!user) return DEFAULT_AGENT_PERMISSIONS;
  if (isCompanyAdmin(user)) return ADMIN_PERMISSIONS;
  if (user.permissions) {
    try {
      const parsed = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      return { ...DEFAULT_AGENT_PERMISSIONS, ...parsed };
    } catch (e) {
      return DEFAULT_AGENT_PERMISSIONS;
    }
  }
  return DEFAULT_AGENT_PERMISSIONS;
}

// In-memory cache of tenant database connections
const tenantDbConnections = new Map();

export const TENANT_SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    website TEXT,
    lead_source TEXT DEFAULT 'Web Form',
    lead_status TEXT DEFAULT 'New',
    rating TEXT DEFAULT 'Active',
    annual_revenue REAL DEFAULT 0,
    employees INTEGER DEFAULT 0,
    industry TEXT DEFAULT 'Technology',
    score INTEGER DEFAULT 50, -- Predictive AI Lead Score (0 - 100)
    score_tier TEXT DEFAULT 'Warm', -- 'Hot', 'Warm', 'Cold'
    street TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT,
    description TEXT,
    lead_owner_id INTEGER DEFAULT 1,
    lead_owner_name TEXT DEFAULT 'Sales Rep',
    is_converted INTEGER DEFAULT 0,
    converted_account_id INTEGER,
    converted_contact_id INTEGER,
    converted_deal_id INTEGER,
    converted_at TEXT,
    date_of_birth TEXT,
    special_day_title TEXT,
    special_day_date TEXT,
    personal_interests TEXT,
    preferred_communication TEXT DEFAULT 'WhatsApp',
    current_situation TEXT,
    relationship_health TEXT DEFAULT 'New Prospect',
    what_they_told_us TEXT,
    next_follow_up_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    industry TEXT DEFAULT 'Technology',
    annual_revenue REAL DEFAULT 0,
    employees INTEGER DEFAULT 0,
    rating TEXT DEFAULT 'Active',
    ownership TEXT DEFAULT 'Private',
    ticker_symbol TEXT,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    billing_country TEXT,
    shipping_street TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_zip TEXT,
    shipping_country TEXT,
    description TEXT,
    owner_id INTEGER DEFAULT 1,
    owner_name TEXT DEFAULT 'Sales Rep',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    account_name TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    title TEXT,
    department TEXT,
    lead_source TEXT DEFAULT 'Direct',
    mailing_street TEXT,
    mailing_city TEXT,
    mailing_state TEXT,
    mailing_zip TEXT,
    mailing_country TEXT,
    date_of_birth TEXT,
    special_day_title TEXT,
    special_day_date TEXT,
    personal_interests TEXT,
    preferred_communication TEXT DEFAULT 'WhatsApp',
    current_situation TEXT,
    relationship_health TEXT DEFAULT 'Strong & Warm',
    what_they_told_us TEXT,
    next_follow_up_date TEXT,
    description TEXT,
    owner_id INTEGER DEFAULT 1,
    owner_name TEXT DEFAULT 'Sales Rep',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_id INTEGER,
    account_name TEXT,
    contact_id INTEGER,
    contact_name TEXT,
    amount REAL NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'Qualification',
    probability INTEGER DEFAULT 10,
    closing_date TEXT,
    type TEXT DEFAULT 'New Business',
    lead_source TEXT DEFAULT 'Web Form',
    next_step TEXT,
    description TEXT,
    expected_revenue REAL DEFAULT 0,
    priority TEXT DEFAULT 'High',
    deal_loss_reason TEXT,
    days_in_stage INTEGER DEFAULT 3,
    owner_id INTEGER DEFAULT 1,
    owner_name TEXT DEFAULT 'Sales Rep',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'task', 'call', 'meeting'
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal',
    status TEXT DEFAULT 'Not Started',
    due_date TEXT,
    due_time TEXT,
    duration_minutes INTEGER DEFAULT 15,
    related_to_type TEXT,
    related_to_id INTEGER,
    related_to_name TEXT,
    call_type TEXT DEFAULT 'Outbound',
    call_result TEXT,
    meeting_location TEXT,
    description TEXT,
    owner_id INTEGER DEFAULT 1,
    owner_name TEXT DEFAULT 'Sales Rep',
    is_closed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Software License',
    unit_price REAL NOT NULL DEFAULT 0,
    qty_in_stock INTEGER DEFAULT 100,
    is_active INTEGER DEFAULT 1,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT UNIQUE NOT NULL,
    doc_type TEXT DEFAULT 'Quotation',
    parent_doc_id INTEGER,
    parent_doc_number TEXT,
    subject TEXT NOT NULL,
    account_id INTEGER,
    account_name TEXT,
    contact_id INTEGER,
    contact_name TEXT,
    deal_id INTEGER,
    deal_name TEXT,
    quote_stage TEXT DEFAULT 'Draft',
    valid_until TEXT,
    delivery_date TEXT,
    tracking_number TEXT,
    recipient_address TEXT,
    customer_po_number TEXT,
    subtotal REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    tax_percent REAL DEFAULT 8.0,
    grand_total REAL DEFAULT 0,
    billing_street TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    billing_country TEXT,
    terms_conditions TEXT,
    description TEXT,
    share_token TEXT,
    accepted_at TEXT,
    accepted_by TEXT,
    owner_id INTEGER DEFAULT 1,
    owner_name TEXT DEFAULT 'Sales Rep',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    discount_percent REAL DEFAULT 0,
    line_total REAL NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    related_to_type TEXT NOT NULL,
    related_to_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    note_category TEXT DEFAULT 'general',
    created_by_name TEXT DEFAULT 'Sales Rep',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    execution_count INTEGER DEFAULT 0,
    last_triggered_at TEXT
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(entity_type, field_key)
  );

  CREATE TABLE IF NOT EXISTS custom_field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    field_key TEXT NOT NULL,
    field_value TEXT,
    UNIQUE(entity_type, entity_id, field_key)
  );

  CREATE TABLE IF NOT EXISTS sales_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT NOT NULL,
    period TEXT NOT NULL,
    target_amount REAL NOT NULL,
    achieved_amount REAL DEFAULT 0,
    deal_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    related_to_type TEXT NOT NULL,
    related_to_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    sender_name TEXT DEFAULT 'Sales Rep',
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    template_name TEXT,
    status TEXT DEFAULT 'Delivered',
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    body TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS telegram_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    sender_name TEXT,
    message_text TEXT,
    bot_response TEXT,
    action_taken TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    granted_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(contact_id, user_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lead_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    granted_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(lead_id, user_id),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );
`;

function migrateTenantSchema(tDb, tenantId = 1) {
  try {
    tDb.exec(`
      CREATE TABLE IF NOT EXISTS contact_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        granted_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(contact_id, user_id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lead_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        granted_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(lead_id, user_id),
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
    `);
    const quoteCols = tDb.prepare("PRAGMA table_info(quotes)").all().map(c => c.name);
    if (!quoteCols.includes('doc_type')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN doc_type TEXT DEFAULT 'Quotation'").run();
    }
    if (!quoteCols.includes('parent_doc_id')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN parent_doc_id INTEGER").run();
    }
    if (!quoteCols.includes('parent_doc_number')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN parent_doc_number TEXT").run();
    }
    if (!quoteCols.includes('delivery_date')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN delivery_date TEXT").run();
    }
    if (!quoteCols.includes('tracking_number')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN tracking_number TEXT").run();
    }
    if (!quoteCols.includes('recipient_address')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN recipient_address TEXT").run();
    }
    if (!quoteCols.includes('customer_po_number')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN customer_po_number TEXT").run();
    }
    if (!quoteCols.includes('share_token')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN share_token TEXT").run();
    }
    if (!quoteCols.includes('accepted_at')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN accepted_at TEXT").run();
    }
    if (!quoteCols.includes('accepted_by')) {
      tDb.prepare("ALTER TABLE quotes ADD COLUMN accepted_by TEXT").run();
    }
    // Set doc_type for existing records
    tDb.prepare("UPDATE quotes SET doc_type = 'Invoice' WHERE quote_number LIKE 'INV-%' AND (doc_type IS NULL OR doc_type = 'Quotation')").run();
    tDb.prepare("UPDATE quotes SET doc_type = 'Delivery Order' WHERE quote_number LIKE 'DO-%' AND (doc_type IS NULL OR doc_type = 'Quotation')").run();
    tDb.prepare("UPDATE quotes SET share_token = ? || '_' || lower(hex(randomblob(12))) WHERE share_token IS NULL OR share_token = '' OR instr(share_token, '_') = 0").run(String(tenantId));

    // Migrate Contacts with Personal Data, Special Days, and Situation fields
    const contactCols = tDb.prepare("PRAGMA table_info(contacts)").all().map(c => c.name);
    if (!contactCols.includes('date_of_birth')) tDb.prepare("ALTER TABLE contacts ADD COLUMN date_of_birth TEXT").run();
    if (!contactCols.includes('special_day_title')) tDb.prepare("ALTER TABLE contacts ADD COLUMN special_day_title TEXT").run();
    if (!contactCols.includes('special_day_date')) tDb.prepare("ALTER TABLE contacts ADD COLUMN special_day_date TEXT").run();
    if (!contactCols.includes('personal_interests')) tDb.prepare("ALTER TABLE contacts ADD COLUMN personal_interests TEXT").run();
    if (!contactCols.includes('preferred_communication')) tDb.prepare("ALTER TABLE contacts ADD COLUMN preferred_communication TEXT DEFAULT 'WhatsApp'").run();
    if (!contactCols.includes('current_situation')) tDb.prepare("ALTER TABLE contacts ADD COLUMN current_situation TEXT").run();
    if (!contactCols.includes('relationship_health')) tDb.prepare("ALTER TABLE contacts ADD COLUMN relationship_health TEXT DEFAULT 'Strong & Warm'").run();
    if (!contactCols.includes('what_they_told_us')) tDb.prepare("ALTER TABLE contacts ADD COLUMN what_they_told_us TEXT").run();
    if (!contactCols.includes('next_follow_up_date')) tDb.prepare("ALTER TABLE contacts ADD COLUMN next_follow_up_date TEXT").run();

    // Migrate Leads with Personal Data, Special Days, and Situation fields
    const leadCols = tDb.prepare("PRAGMA table_info(leads)").all().map(c => c.name);
    if (!leadCols.includes('date_of_birth')) tDb.prepare("ALTER TABLE leads ADD COLUMN date_of_birth TEXT").run();
    if (!leadCols.includes('special_day_title')) tDb.prepare("ALTER TABLE leads ADD COLUMN special_day_title TEXT").run();
    if (!leadCols.includes('special_day_date')) tDb.prepare("ALTER TABLE leads ADD COLUMN special_day_date TEXT").run();
    if (!leadCols.includes('personal_interests')) tDb.prepare("ALTER TABLE leads ADD COLUMN personal_interests TEXT").run();
    if (!leadCols.includes('preferred_communication')) tDb.prepare("ALTER TABLE leads ADD COLUMN preferred_communication TEXT DEFAULT 'WhatsApp'").run();
    if (!leadCols.includes('current_situation')) tDb.prepare("ALTER TABLE leads ADD COLUMN current_situation TEXT").run();
    if (!leadCols.includes('relationship_health')) tDb.prepare("ALTER TABLE leads ADD COLUMN relationship_health TEXT DEFAULT 'New Prospect'").run();
    if (!leadCols.includes('what_they_told_us')) tDb.prepare("ALTER TABLE leads ADD COLUMN what_they_told_us TEXT").run();
    if (!leadCols.includes('next_follow_up_date')) tDb.prepare("ALTER TABLE leads ADD COLUMN next_follow_up_date TEXT").run();

    // Migrate Notes table with Category
    const noteCols = tDb.prepare("PRAGMA table_info(notes)").all().map(c => c.name);
    if (!noteCols.includes('note_category')) {
      tDb.prepare("ALTER TABLE notes ADD COLUMN note_category TEXT DEFAULT 'general'").run();
    }
  } catch (err) {
    console.error('[Tenant Migration Notice]:', err.message);
  }
}

/**
 * Returns the isolated SQLite database connection for a specific user/tenant.
 * Ensures complete physical isolation: each tenant has their own .db file.
 */
export function getTenantDb(userId, customInfo = {}) {
  const uid = Number(userId) || 1;
  if (tenantDbConnections.has(uid)) {
    return tenantDbConnections.get(uid);
  }

  const tenantFilePath = path.join(TENANTS_DIR, `tenant_${uid}.db`);
  const isNewFile = !fs.existsSync(tenantFilePath);

  const tDb = new DatabaseSync(tenantFilePath);
  tDb.exec(TENANT_SCHEMA_SQL);
  migrateTenantSchema(tDb, uid);

  if (isNewFile) {
    const isDemo = uid === 1 || Boolean(customInfo.isDemo);
    initTenantSeedData(tDb, uid, customInfo, isDemo);
  }

  tenantDbConnections.set(uid, tDb);
  return tDb;
}

import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantStorage = new AsyncLocalStorage();

/**
 * Proxy for `db`:
 * When running inside a request context (wrapped by tenantStorage.run(tenantDb, ...)),
 * all calls to db.prepare(), db.exec(), etc. automatically route to the user's isolated database.
 * If outside any request, safely defaults to Tenant 1.
 */
export const db = new Proxy({}, {
  get(target, prop) {
    const currentDb = tenantStorage.getStore() || getTenantDb(1);
    const val = currentDb[prop];
    return typeof val === 'function' ? val.bind(currentDb) : val;
  }
});

/**
 * Seeds a clean, isolated starter environment for a new tenant/user.
 * GUARANTEE: Never copies another user's Telegram bot token or AI API key!
 */
export function initTenantSeedData(tDb, userId, customInfo = {}, isDemo = false) {
  const userName = customInfo.name || 'Sales Rep';
  const companyName = customInfo.company || customInfo.company_name || 'My Enterprise';
  const regNo = customInfo.company_reg_no || '2026-CO-8910';
  const phone = customInfo.company_phone || '+1 (555) 019-2834';
  const email = customInfo.company_email || 'billing@abadiguru.com';
  const address = customInfo.company_address || 'Level 28, Tower 1, Business Financial District';
  const website = customInfo.company_website || 'https://abadiguru.com';
  const currency = customInfo.currency_symbol || '$';
  const industry = customInfo.industry || 'Technology';

  // 1. Initial System Settings: BLANK TOKENS & DOCUMENT PRESETS
  tDb.exec(`
    INSERT OR REPLACE INTO system_settings (key, value) VALUES
    ('ai_provider', 'hermes'),
    ('ai_base_url', 'http://localhost:11434/v1'),
    ('ai_api_key', ''),
    ('ai_model', 'ABADI GURU Core AI'),
    ('ai_enabled', '1'),
    ('telegram_token', ''),
    ('telegram_agent_token', ''),
    ('telegram_enabled', '0'),
    ('telegram_chat_id', ''),
    ('company_name', '${companyName.replace(/'/g, "''")}'),
    ('company_reg_no', '${regNo.replace(/'/g, "''")}'),
    ('company_logo', ''),
    ('company_address', '${address.replace(/'/g, "''")}'),
    ('company_phone', '${phone.replace(/'/g, "''")}'),
    ('company_email', '${email.replace(/'/g, "''")}'),
    ('company_website', '${website.replace(/'/g, "''")}'),
    ('company_industry', '${industry.replace(/'/g, "''")}'),
    ('currency_symbol', '${currency.replace(/'/g, "''")}'),
    ('quote_prefix', 'QT-'),
    ('quote_validity_days', '30'),
    ('quote_default_terms', 'Quotation valid for 30 days from date of issue. 50% deposit required on acceptance.'),
    ('quote_footer_note', 'Thank you for your business consideration.'),
    ('do_prefix', 'DO-'),
    ('do_default_terms', 'Goods received in good order and satisfactory condition. Please sign and chop duplicate copy for acknowledgement.'),
    ('do_show_prices', '1'),
    ('do_footer_note', 'Official delivery order receipt.'),
    ('invoice_prefix', 'INV-'),
    ('invoice_payment_terms', 'Net 30 Days'),
    ('invoice_default_tax', '8.0'),
    ('invoice_bank_name', 'JPMorgan Chase / Maybank'),
    ('invoice_bank_account_no', '4819-2049-1928'),
    ('invoice_bank_account_name', '${companyName.replace(/'/g, "''")} LLC'),
    ('invoice_swift_code', 'CHASUS33'),
    ('invoice_default_terms', 'Payment due within 30 days. Please include invoice number in payment description.'),
    ('invoice_footer_note', 'Thank you for your partnership!'),
    ('email_delivery_provider', 'none'),
    ('smtp_host', ''),
    ('smtp_port', '587'),
    ('smtp_secure', '0'),
    ('smtp_user', ''),
    ('smtp_pass', ''),
    ('smtp_from_email', ''),
    ('smtp_from_name', '${userName.replace(/'/g, "''")}'),
    ('resend_api_key', '');
  `);

  // 2. Standard Products
  tDb.exec(`
    INSERT OR IGNORE INTO products (product_code, name, category, unit_price, qty_in_stock, description) VALUES
    ('PRD-CRM-ENT', 'ABADI GURU CRM Enterprise Edition (Annual)', 'Software License', 1200.00, 999, 'Full enterprise CRM access including unlimited pipelines, workflows, and custom fields.'),
    ('PRD-CRM-PRO', 'ABADI GURU CRM Professional Edition (Annual)', 'Software License', 720.00, 999, 'Standard CRM license for mid-market teams up to 50 users.'),
    ('PRD-SLA-PLAT', 'Platinum 24/7 Priority Support Retainer', 'Support & Services', 15000.00, 50, '15-minute response time SLA, dedicated technical account manager, and weekend emergency escalation.'),
    ('PRD-MIG-SERV', 'Enterprise Data Migration & Onboarding Pack', 'Professional Services', 8500.00, 40, 'End-to-end data cleaning, legacy CRM data migration, team training and custom workflow setup.');
  `);

  // 3. Email Templates
  tDb.exec(`
    INSERT OR IGNORE INTO email_templates (name, subject, category, body) VALUES
    ('Executive Introduction', 'Introduction to ABADI GURU CRM Enterprise Solutions', 'Sales Outreach', 'Hi {{name}},\n\nIt was great connecting with your team. At ABADI GURU CRM, we help high-growth organizations streamline their pipeline and close deals 35% faster.\n\nWould you have 15 minutes this Thursday for a brief walkthrough?\n\nBest regards,\n${userName}'),
    ('Proposal Delivery', 'Your Customized ABADI GURU CRM Proposal & Pricing Scope', 'Deals', 'Hi {{name}},\n\nPlease find attached the official price quote and SLA roadmap tailored for {{company}}.\n\nWe have incorporated the agreed multi-tier licensing and dedicated implementation package.\n\nLooking forward to your feedback.\n\nWarm regards,\n${userName}');
  `);

  // 4. Default Workflows
  tDb.exec(`
    INSERT OR IGNORE INTO workflows (name, trigger_event, description, is_active, execution_count, last_triggered_at) VALUES
    ('Instant Welcome Task on New Lead', 'lead_created', 'Automatically generates a high-priority discovery call task assigned to the lead owner whenever a new lead enters the system.', 1, 0, NULL),
    ('Deal Won Celebration & Quote Lock', 'deal_won', 'When a deal moves to "Closed Won", automatically marks the corresponding quote as Accepted and creates a client onboarding task.', 1, 0, NULL),
    ('High Value Deal Alert', 'deal_created', 'Triggers executive notification whenever a deal with amount > $50,000 is created or updated.', 1, 0, NULL);
  `);

  // 5. Starter records ONLY for demo workspaces (isDemo === true)
  if (isDemo) {
    tDb.prepare(`
      INSERT OR REPLACE INTO accounts (id, name, phone, website, industry, annual_revenue, employees, billing_city, billing_state, billing_country, description, owner_name)
      VALUES (1, ?, '+1 (555) 789-0100', 'https://example.com', 'Technology', 5000000, 150, 'San Francisco', 'CA', 'USA', 'Initial enterprise client account.', ?)
    `).run(`${companyName} Partners`, userName);

    tDb.prepare(`
      INSERT OR REPLACE INTO contacts (
        id, account_id, account_name, first_name, last_name, email, phone, title, department,
        date_of_birth, special_day_title, special_day_date, personal_interests,
        preferred_communication, current_situation, relationship_health, what_they_told_us, next_follow_up_date,
        owner_name
      ) VALUES (
        1, 1, ?, 'John', 'Doe', 'john.doe@example.com', '+1 (555) 789-0101', 'VP of Operations', 'Operations',
        '1988-10-24', 'Corporate Founding Anniversary', '2026-11-15', 'Avid tennis player, specialty pour-over coffee, vintage mechanical watches',
        'WhatsApp', 'Evaluating enterprise licensing pilot. Executive board meeting next Tuesday to approve budget.', 'VIP Champion',
        'Mentioned they want their sales team to make quotes on the go without logging into a clunky web portal. Loves fast WhatsApp/Telegram response times.', '2026-10-14',
        ?
      )
    `).run(`${companyName} Partners`, userName);

    tDb.prepare(`
      INSERT OR REPLACE INTO leads (
        id, first_name, last_name, company, title, email, phone, lead_source, lead_status, rating,
        annual_revenue, employees, industry, score, score_tier, city, state, country, description,
        date_of_birth, special_day_title, special_day_date, personal_interests,
        preferred_communication, current_situation, relationship_health, what_they_told_us, next_follow_up_date,
        lead_owner_name
      ) VALUES (
        1, 'Sarah', 'Connor', 'Cyberdyne Innovations', 'Chief Technology Officer', 'sconnor@cyberdyne.io', '+1 (555) 888-9900', 'Web Form', 'Qualified', 'Active',
        7500000, 120, 'Technology', 92, 'Hot', 'Los Angeles', 'CA', 'USA', 'High priority prospect seeking full sales automation and Telegram remote control.',
        '1992-10-18', 'Annual Tech Innovation Summit', '2026-11-05', 'Trail marathon runner, AI research, smart home automation',
        'WhatsApp', 'Evaluating 50-seat rollout to replace old legacy CRM. Budget already approved by CEO.', 'Warm & Engaged',
        'Told us their previous CRM was too confusing for their sales reps. Specifically requested ability to capture personal customer details like birthdays and what clients told them so context is never lost.', '2026-10-12',
        ?
      )
    `).run(userName);

    tDb.prepare(`
      INSERT OR REPLACE INTO notes (id, related_to_type, related_to_id, content, note_category, created_by_name)
      VALUES
      (1, 'contact', 1, 'John mentioned during our coffee chat: "We love how easy it is to issue quotes directly from Telegram without opening a laptop."', 'client_said', ?),
      (2, 'contact', 1, 'John celebrated his 10th year at the company. Sent him a warm congratulation message via WhatsApp.', 'personal_update', ?),
      (3, 'lead', 1, 'Sarah told us: "If your system can store our clients personal milestones and what they told us during discovery calls, we are ready to sign."', 'client_said', ?)
    `).run(userName, userName, userName);

    tDb.prepare(`
      INSERT OR REPLACE INTO deals (id, name, account_id, account_name, contact_id, contact_name, amount, stage, probability, closing_date, type, description, expected_revenue, priority, owner_name)
      VALUES (1, 'Enterprise Expansion Deal', 1, ?, 1, 'John Doe', 48000, 'Proposal / Price Quote', 60, '2026-11-30', 'New Business', 'Initial pilot deal rollout.', 28800, 'High', ?)
    `).run(`${companyName} Partners`, userName);

    tDb.prepare(`
      INSERT OR REPLACE INTO sales_quotas (id, user_id, user_name, period, target_amount, achieved_amount, deal_count)
      VALUES (1, ?, ?, 'Q4 2026', 100000, 0, 0)
    `).run(userId, userName);
  }
}

export function initDatabase() {
  console.log('[Database] Master database initialized at:', MASTER_DB_FILE);
  console.log('[Database] Tenant storage initialized at:', TENANTS_DIR);
}
