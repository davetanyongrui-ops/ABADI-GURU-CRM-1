import crypto from 'node:crypto';
import { getTenantDb } from './db.js';
import { sendOutboundEmail, sendDocumentEmail } from './mailer.js';

// CRM Function Tools Definitions for AI Models
export const CRM_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_pipeline_summary',
      description: 'Get high-level summary of the sales pipeline, total value, won revenue, win rate, and lead counts.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_deals',
      description: 'List current deals/opportunities in the pipeline with their stages, amounts, and accounts.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', description: 'Optional stage filter: Qualification, Needs Analysis, Value Proposition, Proposal / Price Quote, Negotiation / Review, Closed Won, Closed Lost' },
          limit: { type: 'number', description: 'Max records to return (default 10)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new deal or sales opportunity in the CRM pipeline.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Deal title / opportunity name' },
          account_name: { type: 'string', description: 'Company or account name' },
          amount: { type: 'number', description: 'Dollar value of the deal' },
          stage: { type: 'string', description: 'Pipeline stage (default: Qualification)' },
          closing_date: { type: 'string', description: 'Closing date YYYY-MM-DD' }
        },
        required: ['name', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_deal_stage',
      description: 'Move an existing deal to a new pipeline stage (e.g., Closed Won, Proposal / Price Quote, Negotiation / Review).',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'number', description: 'ID of the deal to update' },
          stage: { type: 'string', description: 'Target stage: Qualification, Needs Analysis, Value Proposition, Proposal / Price Quote, Negotiation / Review, Closed Won, Closed Lost' }
        },
        required: ['deal_id', 'stage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'summarize_leads',
      description: 'Get an executive intelligence summary of leads: total counts, conversion rate, Hot/Warm/Cold distribution, total prospect budgets, and top priority prospects.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_leads',
      description: 'Retrieve prospective leads with their status, company, predictive AI score, and contact details.',
      parameters: {
        type: 'object',
        properties: {
          tier: { type: 'string', description: 'Optional tier filter: Hot, Warm, Cold' },
          limit: { type: 'number', description: 'Max leads to return' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Add a new prospective lead into the CRM.',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string', description: 'First name' },
          last_name: { type: 'string', description: 'Last name' },
          company: { type: 'string', description: 'Company name' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          annual_revenue: { type: 'number', description: 'Estimated annual budget or revenue' }
        },
        required: ['first_name', 'last_name', 'company']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task, call reminder, or meeting in the CRM schedule.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title or action summary' },
          type: { type: 'string', description: 'task, call, or meeting' },
          due_date: { type: 'string', description: 'Due date YYYY-MM-DD' },
          related_to_name: { type: 'string', description: 'Client or deal name' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_quotation',
      description: 'Generate an official price quotation for a client or prospective account with line items and validity date.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Client company or prospect name' },
          subject: { type: 'string', description: 'Quotation title / description' },
          amount: { type: 'number', description: 'Total amount or subtotal' },
          items: {
            type: 'array',
            description: 'Optional line items: [{ name: "Item", price: 100, quantity: 2 }]',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'number' }
              }
            }
          },
          validity_days: { type: 'number', description: 'Number of days quote is valid (default 30)' }
        },
        required: ['client_name', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'convert_to_delivery_order',
      description: 'Convert an existing quotation or sales order into an official Delivery Order (DO).',
      parameters: {
        type: 'object',
        properties: {
          quote_id_or_number: { type: 'string', description: 'Quotation ID (e.g. "12") or Quote number (e.g. "QT-2026-1029")' },
          delivery_date: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' },
          tracking_number: { type: 'string', description: 'Courier or internal fleet tracking' },
          recipient_address: { type: 'string', description: 'Delivery destination address' }
        },
        required: ['quote_id_or_number']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'convert_to_invoice',
      description: 'Convert an existing quotation or delivery order into an official Tax Invoice.',
      parameters: {
        type: 'object',
        properties: {
          doc_id_or_number: { type: 'string', description: 'Document ID or number to convert to invoice' },
          due_date: { type: 'string', description: 'Payment due date (YYYY-MM-DD)' }
        },
        required: ['doc_id_or_number']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_invoice',
      description: 'Generate an official sales invoice directly with items, subtotal, and tax in the CRM database.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Client company or account name' },
          subject: { type: 'string', description: 'Invoice subject or purpose' },
          amount: { type: 'number', description: 'Total amount or subtotal' },
          items: {
            type: 'array',
            description: 'Optional array of line items: [{ name: "Service", price: 1000, quantity: 1 }]',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                price: { type: 'number' },
                quantity: { type: 'number' }
              }
            }
          },
          tax_percent: { type: 'number', description: 'Tax percentage (default 8.0)' }
        },
        required: ['client_name', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_invoices',
      description: 'List recent quotes, delivery orders, and invoices with status, grand totals, and client names.',
      parameters: {
        type: 'object',
        properties: {
          doc_type: { type: 'string', description: 'Optional filter: "Quotation", "Delivery Order", or "Invoice"' },
          limit: { type: 'number', description: 'Max records (default 5)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an outbound email to a client or recipient via configured SMTP/Resend, with optional quotation/invoice PDF attached.',
      parameters: {
        type: 'object',
        properties: {
          recipient_email: { type: 'string', description: 'Destination email address' },
          subject: { type: 'string', description: 'Subject line of the email' },
          body: { type: 'string', description: 'Plain text or markdown content of the email' },
          doc_id_or_number: { type: 'string', description: 'Optional Quotation, DO, or Invoice ID/number to generate and attach as branded PDF' }
        },
        required: ['recipient_email', 'subject', 'body']
      }
    }
  }
];

// Helper to get system settings for a specific user tenant
export function getSettings(userId = 1) {
  const tenantDb = getTenantDb(userId);
  const rows = tenantDb.prepare('SELECT key, value FROM system_settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return {
    // AI
    ai_provider: settings.ai_provider || 'hermes',
    ai_base_url: settings.ai_base_url || 'http://localhost:11434/v1',
    ai_api_key: settings.ai_api_key || '',
    ai_model: settings.ai_model || 'ABADI GURU Core AI',
    ai_enabled: settings.ai_enabled === '1',
    // Telegram
    telegram_token: settings.telegram_token || '',
    telegram_agent_token: settings.telegram_agent_token || '',
    telegram_enabled: settings.telegram_enabled === '1',
    telegram_chat_id: settings.telegram_chat_id || '',
    // Company Branding & Document Details
    company_name: settings.company_name || 'Abadi Guru Enterprises',
    company_reg_no: settings.company_reg_no || '2026-CO-8910',
    company_logo: settings.company_logo || '',
    company_address: settings.company_address || 'Level 28, Tower 1, Business Financial District',
    company_phone: settings.company_phone || '+1 (555) 019-2834',
    company_email: settings.company_email || 'billing@abadiguru.com',
    company_website: settings.company_website || 'https://abadiguru.com',
    currency_symbol: settings.currency_symbol || '$',
    // Quotation Presets
    quote_prefix: settings.quote_prefix || 'QT-',
    quote_validity_days: settings.quote_validity_days || '30',
    quote_default_terms: settings.quote_default_terms || 'Quotation valid for 30 days from date of issue. 50% deposit required on acceptance.',
    quote_footer_note: settings.quote_footer_note || 'Thank you for your business consideration.',
    // Delivery Order Presets
    do_prefix: settings.do_prefix || 'DO-',
    do_default_terms: settings.do_default_terms || 'Goods received in good order and satisfactory condition. Please sign and chop duplicate copy for acknowledgement.',
    do_show_prices: settings.do_show_prices !== undefined ? settings.do_show_prices : '1',
    do_footer_note: settings.do_footer_note || 'Official delivery order receipt.',
    // Invoice Presets
    invoice_prefix: settings.invoice_prefix || 'INV-',
    invoice_payment_terms: settings.invoice_payment_terms || 'Net 30 Days',
    invoice_default_tax: settings.invoice_default_tax || '8.0',
    invoice_bank_name: settings.invoice_bank_name || 'JPMorgan Chase / Maybank',
    invoice_bank_account_no: settings.invoice_bank_account_no || '4819-2049-1928',
    invoice_bank_account_name: settings.invoice_bank_account_name || 'Abadi Guru Enterprises Global LLC',
    invoice_swift_code: settings.invoice_swift_code || 'CHASUS33',
    invoice_default_terms: settings.invoice_default_terms || 'Payment due within 30 days. Please include invoice number in payment description.',
    invoice_footer_note: settings.invoice_footer_note || 'Thank you for your partnership!',
    // Outbound Email Delivery
    email_delivery_provider: settings.email_delivery_provider || 'none',
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '587',
    smtp_secure: settings.smtp_secure || '0',
    smtp_user: settings.smtp_user || '',
    smtp_pass: settings.smtp_pass || '',
    smtp_from_email: settings.smtp_from_email || '',
    smtp_from_name: settings.smtp_from_name || '',
    resend_api_key: settings.resend_api_key || '',
  };
}

export function saveSettings(userId = 1, newSettings = {}) {
  const tenantDb = getTenantDb(userId);
  const stmt = tenantDb.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(newSettings)) {
    if (v !== undefined && v !== null) {
      stmt.run(k, String(v));
    }
  }
  if (newSettings.ai_base_url) {
    stmt.run('ai_enabled', '1');
  }
  return getSettings(userId);
}

// Tool execution against a specific user's isolated SQLite database
export async function executeCrmTool(userId = 1, name, args = {}) {
  const tenantDb = getTenantDb(userId);
  try {
    if (name === 'get_pipeline_summary') {
      const open = tenantDb.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val, COALESCE(SUM(expected_revenue), 0) as weighted FROM deals WHERE stage NOT IN ('Closed Won', 'Closed Lost')").get();
      const won = tenantDb.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val FROM deals WHERE stage = 'Closed Won'").get();
      const leads = tenantDb.prepare('SELECT COUNT(*) as count FROM leads WHERE is_converted = 0').get();
      const hotLeads = tenantDb.prepare('SELECT COUNT(*) as count FROM leads WHERE score >= 80 AND is_converted = 0').get();

      return {
        open_deals_count: open.count,
        total_pipeline_value: open.val,
        weighted_forecast: open.weighted,
        won_revenue: won.val,
        won_deals_count: won.count,
        active_leads: leads.count,
        hot_leads_count: hotLeads.count,
      };
    }

    if (name === 'list_deals') {
      let query = "SELECT id, name, account_name, amount, stage, probability, closing_date, owner_name FROM deals WHERE 1=1";
      const params = [];
      if (args.stage) {
        query += " AND stage = ?";
        params.push(args.stage);
      }
      query += " ORDER BY amount DESC LIMIT ?";
      params.push(args.limit || 10);
      return tenantDb.prepare(query).all(...params);
    }

    if (name === 'create_deal') {
      const stage = args.stage || 'Qualification';
      const prob = stage === 'Closed Won' ? 100 : stage === 'Closed Lost' ? 0 : 20;
      const expected = Math.round((args.amount || 0) * (prob / 100));

      const stmt = tenantDb.prepare(`
        INSERT INTO deals (name, account_name, amount, stage, probability, expected_revenue, closing_date, owner_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Sales Rep')
      `);
      const res = stmt.run(
        args.name,
        args.account_name || 'Direct Enterprise Client',
        Number(args.amount) || 0,
        stage,
        prob,
        expected,
        args.closing_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      );
      return { success: true, deal_id: res.lastInsertRowid, message: `Created deal "${args.name}" for $${args.amount}` };
    }

    if (name === 'update_deal_stage') {
      const prob = args.stage === 'Closed Won' ? 100 : args.stage === 'Closed Lost' ? 0 : 60;
      tenantDb.prepare(`
        UPDATE deals
        SET stage = ?, probability = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(args.stage, prob, args.deal_id);
      return { success: true, message: `Deal #${args.deal_id} moved to "${args.stage}"` };
    }

    if (name === 'summarize_leads') {
      const stats = tenantDb.prepare(`
        SELECT 
          COUNT(*) as total_leads,
          COALESCE(SUM(CASE WHEN is_converted = 1 THEN 1 ELSE 0 END), 0) as converted_leads,
          COALESCE(SUM(CASE WHEN is_converted = 0 THEN 1 ELSE 0 END), 0) as active_leads,
          COALESCE(SUM(CASE WHEN score_tier = 'Hot' AND is_converted = 0 THEN 1 ELSE 0 END), 0) as hot_count,
          COALESCE(SUM(CASE WHEN score_tier = 'Warm' AND is_converted = 0 THEN 1 ELSE 0 END), 0) as warm_count,
          COALESCE(SUM(CASE WHEN score_tier = 'Cold' AND is_converted = 0 THEN 1 ELSE 0 END), 0) as cold_count,
          COALESCE(SUM(annual_revenue), 0) as total_budget,
          COALESCE(ROUND(AVG(score)), 0) as avg_score
        FROM leads
      `).get();

      const sources = tenantDb.prepare(`
        SELECT lead_source, COUNT(*) as count 
        FROM leads 
        WHERE is_converted = 0 
        GROUP BY lead_source 
        ORDER BY count DESC 
        LIMIT 5
      `).all();

      const topLeads = tenantDb.prepare(`
        SELECT id, first_name, last_name, company, score, score_tier, annual_revenue, current_situation, what_they_told_us, next_follow_up_date
        FROM leads 
        WHERE is_converted = 0 
        ORDER BY score DESC, annual_revenue DESC 
        LIMIT 3
      `).all();

      const upcomingFollowups = tenantDb.prepare(`
        SELECT id, first_name, last_name, company, next_follow_up_date
        FROM leads 
        WHERE is_converted = 0 AND next_follow_up_date IS NOT NULL AND next_follow_up_date != ''
        ORDER BY next_follow_up_date ASC 
        LIMIT 3
      `).all();

      return {
        success: true,
        stats,
        sources,
        top_leads: topLeads,
        upcoming_followups: upcomingFollowups,
        message: `Found ${stats.active_leads} active leads (${stats.hot_count} Hot) with total potential budget capacity of $${Number(stats.total_budget).toLocaleString()}`
      };
    }

    if (name === 'list_leads') {
      let query = "SELECT id, first_name, last_name, company, email, phone, annual_revenue, score, score_tier, lead_status FROM leads WHERE is_converted = 0";
      const params = [];
      if (args.tier) {
        query += " AND score_tier = ?";
        params.push(args.tier);
      }
      query += " ORDER BY score DESC LIMIT ?";
      params.push(args.limit || 10);
      return tenantDb.prepare(query).all(...params);
    }

    if (name === 'create_lead') {
      const rev = Number(args.annual_revenue) || 0;
      const score = rev > 10000000 ? 92 : rev > 5000000 ? 84 : 65;
      const tier = score >= 80 ? 'Hot' : 'Warm';

      const stmt = tenantDb.prepare(`
        INSERT INTO leads (first_name, last_name, company, email, phone, annual_revenue, score, score_tier, lead_status, lead_source, is_converted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Telegram / AI Copilot', 0)
      `);
      const res = stmt.run(
        args.first_name || 'New',
        args.last_name || 'Prospect',
        args.company || 'Enterprise',
        args.email || '',
        args.phone || '',
        rev,
        score,
        tier
      );
      return {
        success: true,
        lead_id: res.lastInsertRowid,
        message: `Created lead #${res.lastInsertRowid} "${args.first_name} ${args.last_name}" at ${args.company} with AI score ${score} (${tier})`
      };
    }

    if (name === 'create_task') {
      const stmt = tenantDb.prepare(`
        INSERT INTO activities (title, type, due_date, due_time, related_to_name, status, is_closed)
        VALUES (?, ?, ?, '10:00', ?, 'Not Started', 0)
      `);
      const res = stmt.run(
        args.title,
        args.type || 'task',
        args.due_date || new Date().toISOString().split('T')[0],
        args.related_to_name || 'CRM Lead'
      );
      return { success: true, task_id: res.lastInsertRowid, message: `Created ${args.type || 'task'}: "${args.title}"` };
    }

    if (name === 'create_quotation') {
      const settings = getSettings(userId);
      const clientName = args.client_name || 'Valued Prospect';
      const subject = args.subject || `Sales Quotation for ${clientName}`;
      const amount = Number(args.amount) || 0;
      const validityDays = Number(args.validity_days) || Number(settings.quote_validity_days) || 30;
      const taxPct = Number(settings.invoice_default_tax) || 8.0;

      const acc = tenantDb.prepare('SELECT id, name FROM accounts WHERE name LIKE ?').get(`%${clientName}%`);
      const accountId = acc ? acc.id : null;
      const resolvedAccountName = acc ? acc.name : clientName;

      let items = args.items;
      if (!Array.isArray(items) || items.length === 0) {
        items = [{ product_name: subject, unit_price: amount, quantity: 1, line_total: amount }];
      } else {
        items = items.map(itm => {
          const uPrice = Number(itm.price || itm.unit_price) || amount;
          const uQty = Number(itm.quantity) || 1;
          return {
            product_name: itm.name || itm.product_name || 'Item / Service',
            unit_price: uPrice,
            quantity: uQty,
            line_total: uPrice * uQty
          };
        });
      }

      const subtotal = items.reduce((acc, itm) => acc + (Number(itm.line_total) || 0), 0) || amount;
      const taxAmount = Math.round(subtotal * (taxPct / 100) * 100) / 100;
      const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

      const prefix = settings.quote_prefix || 'QT-';
      const quoteNumber = `${prefix}${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString().split('T')[0];
      const shareToken = `${userId}_${crypto.randomBytes(12).toString('hex')}`;

      const stmt = tenantDb.prepare(`
        INSERT INTO quotes (
          quote_number, doc_type, subject, account_id, account_name, quote_stage,
          valid_until, subtotal, tax_percent, grand_total, terms_conditions,
          share_token, owner_name
        ) VALUES (?, 'Quotation', ?, ?, ?, 'Draft', ?, ?, ?, ?, ?, ?, 'Sales Rep')
      `);

      const res = stmt.run(quoteNumber, subject, accountId, resolvedAccountName, validUntil, subtotal, taxPct, grandTotal, settings.quote_default_terms, shareToken);
      const quoteId = res.lastInsertRowid;

      const itemStmt = tenantDb.prepare(`
        INSERT INTO quote_items (quote_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const itm of items) {
        itemStmt.run(quoteId, itm.product_name, itm.unit_price, itm.quantity, itm.line_total);
      }

      return {
        success: true,
        doc_type: 'Quotation',
        quote_id: quoteId,
        quote_number: quoteNumber,
        client: resolvedAccountName,
        subject,
        subtotal,
        tax_percent: taxPct,
        grand_total: grandTotal,
        valid_until: validUntil,
        items,
        message: `Successfully generated Quotation #${quoteNumber} for ${resolvedAccountName} (Total: ${settings.currency_symbol}${grandTotal.toLocaleString()})`
      };
    }

    if (name === 'convert_to_delivery_order') {
      const settings = getSettings(userId);
      const target = String(args.quote_id_or_number || '').trim();
      let sourceQuote = null;
      if (!isNaN(Number(target))) {
        sourceQuote = tenantDb.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(target));
      }
      if (!sourceQuote) {
        sourceQuote = tenantDb.prepare('SELECT * FROM quotes WHERE quote_number LIKE ?').get(`%${target}%`);
      }
      if (!sourceQuote) {
        return { error: `Could not find source quotation matching "${target}"` };
      }

      const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(sourceQuote.id);
      const prefix = settings.do_prefix || 'DO-';
      const doNumber = `${prefix}${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const deliveryDate = args.delivery_date || new Date().toISOString().split('T')[0];
      const trackingNumber = args.tracking_number || 'Standard Fleet / Courier';
      const recipientAddress = args.recipient_address || sourceQuote.recipient_address || sourceQuote.billing_street || 'Recipient Facility / Office';
      const shareToken = `${userId}_${crypto.randomBytes(12).toString('hex')}`;

      const stmt = tenantDb.prepare(`
        INSERT INTO quotes (
          quote_number, doc_type, parent_doc_id, parent_doc_number, subject,
          account_id, account_name, contact_id, contact_name, deal_id, deal_name,
          quote_stage, delivery_date, tracking_number, recipient_address,
          subtotal, tax_percent, grand_total, terms_conditions, share_token, owner_name
        ) VALUES (?, 'Delivery Order', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        doNumber,
        sourceQuote.id,
        sourceQuote.quote_number,
        `Delivery Order - ${sourceQuote.subject}`,
        sourceQuote.account_id,
        sourceQuote.account_name,
        sourceQuote.contact_id,
        sourceQuote.contact_name,
        sourceQuote.deal_id,
        sourceQuote.deal_name,
        deliveryDate,
        trackingNumber,
        recipientAddress,
        sourceQuote.subtotal,
        sourceQuote.tax_percent,
        sourceQuote.grand_total,
        settings.do_default_terms,
        shareToken,
        sourceQuote.owner_name || 'Sales Rep'
      );
      const doId = res.lastInsertRowid;

      const itemStmt = tenantDb.prepare(`
        INSERT INTO quote_items (quote_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const itm of items) {
        itemStmt.run(doId, itm.product_id, itm.product_name, itm.unit_price, itm.quantity, itm.line_total);
      }

      tenantDb.prepare("UPDATE quotes SET quote_stage = 'Delivered', updated_at = datetime('now') WHERE id = ?").run(sourceQuote.id);

      return {
        success: true,
        doc_type: 'Delivery Order',
        do_id: doId,
        do_number: doNumber,
        parent_doc_number: sourceQuote.quote_number,
        client: sourceQuote.account_name,
        delivery_date: deliveryDate,
        items,
        message: `Successfully converted ${sourceQuote.quote_number} into Delivery Order #${doNumber} for ${sourceQuote.account_name}`
      };
    }

    if (name === 'convert_to_invoice') {
      const settings = getSettings(userId);
      const target = String(args.doc_id_or_number || '').trim();
      let sourceDoc = null;
      if (!isNaN(Number(target))) {
        sourceDoc = tenantDb.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(target));
      }
      if (!sourceDoc) {
        sourceDoc = tenantDb.prepare('SELECT * FROM quotes WHERE quote_number LIKE ?').get(`%${target}%`);
      }
      if (!sourceDoc) {
        return { error: `Could not find document matching "${target}"` };
      }

      const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(sourceDoc.id);
      const prefix = settings.invoice_prefix || 'INV-';
      const invNumber = `${prefix}${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const dueDate = args.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const shareToken = `${userId}_${crypto.randomBytes(12).toString('hex')}`;

      const stmt = tenantDb.prepare(`
        INSERT INTO quotes (
          quote_number, doc_type, parent_doc_id, parent_doc_number, subject,
          account_id, account_name, contact_id, contact_name, deal_id, deal_name,
          quote_stage, valid_until, subtotal, discount_percent, tax_percent, grand_total,
          terms_conditions, share_token, owner_name
        ) VALUES (?, 'Invoice', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        invNumber,
        sourceDoc.id,
        sourceDoc.quote_number,
        `Tax Invoice - ${sourceDoc.subject}`,
        sourceDoc.account_id,
        sourceDoc.account_name,
        sourceDoc.contact_id,
        sourceDoc.contact_name,
        sourceDoc.deal_id,
        sourceDoc.deal_name,
        dueDate,
        sourceDoc.subtotal,
        sourceDoc.discount_percent || 0,
        sourceDoc.tax_percent || 8.0,
        sourceDoc.grand_total,
        settings.invoice_default_terms,
        shareToken,
        sourceDoc.owner_name || 'Sales Rep'
      );
      const invId = res.lastInsertRowid;

      const itemStmt = tenantDb.prepare(`
        INSERT INTO quote_items (quote_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const itm of items) {
        itemStmt.run(invId, itm.product_id, itm.product_name, itm.unit_price, itm.quantity, itm.line_total);
      }

      tenantDb.prepare("UPDATE quotes SET quote_stage = 'Confirmed', updated_at = datetime('now') WHERE id = ?").run(sourceDoc.id);

      return {
        success: true,
        doc_type: 'Invoice',
        invoice_id: invId,
        invoice_number: invNumber,
        parent_doc_number: sourceDoc.quote_number,
        client: sourceDoc.account_name,
        grand_total: sourceDoc.grand_total,
        due_date: dueDate,
        items,
        message: `Successfully converted ${sourceDoc.quote_number} into Tax Invoice #${invNumber} (Total: ${settings.currency_symbol}${Number(sourceDoc.grand_total).toLocaleString()})`
      };
    }

    if (name === 'create_invoice') {
      const settings = getSettings(userId);
      const clientName = args.client_name || 'Valued Client';
      const subject = args.subject || `Invoice for ${clientName}`;
      const amount = Number(args.amount) || 0;
      const parsedTax = Number(args.tax_percent);
      const taxPct = !isNaN(parsedTax) && args.tax_percent !== undefined && args.tax_percent !== null ? parsedTax : (Number(settings.invoice_default_tax) || 8.0);

      const acc = tenantDb.prepare('SELECT id, name FROM accounts WHERE name LIKE ?').get(`%${clientName}%`);
      const accountId = acc ? acc.id : null;
      const resolvedAccountName = acc ? acc.name : clientName;

      let items = args.items;
      if (!Array.isArray(items) || items.length === 0) {
        items = [{ product_name: subject, unit_price: amount, quantity: 1, line_total: amount }];
      } else {
        items = items.map(itm => {
          const uPrice = Number(itm.price || itm.unit_price) || amount;
          const uQty = Number(itm.quantity) || 1;
          return {
            product_name: itm.name || itm.product_name || 'Professional Service',
            unit_price: uPrice,
            quantity: uQty,
            line_total: uPrice * uQty
          };
        });
      }

      const subtotal = items.reduce((acc, itm) => acc + (Number(itm.line_total) || 0), 0) || amount;
      const taxAmount = Math.round(subtotal * (taxPct / 100) * 100) / 100;
      const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

      const prefix = settings.invoice_prefix || 'INV-';
      const invoiceNumber = `${prefix}${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const shareToken = `${userId}_${crypto.randomBytes(12).toString('hex')}`;

      const stmt = tenantDb.prepare(`
        INSERT INTO quotes (
          quote_number, doc_type, subject, account_id, account_name, quote_stage,
          valid_until, subtotal, tax_percent, grand_total, terms_conditions,
          share_token, owner_name
        ) VALUES (?, 'Invoice', ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?, ?, 'Sales Rep')
      `);

      const res = stmt.run(invoiceNumber, subject, accountId, resolvedAccountName, dueDate, subtotal, taxPct, grandTotal, settings.invoice_default_terms, shareToken);
      const quoteId = res.lastInsertRowid;

      const itemStmt = tenantDb.prepare(`
        INSERT INTO quote_items (quote_id, product_name, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const itm of items) {
        itemStmt.run(quoteId, itm.product_name, itm.unit_price, itm.quantity, itm.line_total);
      }

      return {
        success: true,
        doc_type: 'Invoice',
        invoice_id: quoteId,
        invoice_number: invoiceNumber,
        client: resolvedAccountName,
        subject,
        subtotal,
        tax_percent: taxPct,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        due_date: dueDate,
        items,
        message: `Successfully generated official invoice #${invoiceNumber} for ${resolvedAccountName} (Total: ${settings.currency_symbol}${grandTotal.toLocaleString()})`
      };
    }

    if (name === 'list_invoices' || name === 'list_documents') {
      let query = 'SELECT id, quote_number, doc_type, parent_doc_number, subject, account_name, grand_total, quote_stage, valid_until, delivery_date FROM quotes';
      const params = [];
      if (args.doc_type && args.doc_type !== 'all') {
        query += ' WHERE doc_type = ?';
        params.push(args.doc_type);
      }
      query += ' ORDER BY id DESC LIMIT ?';
      params.push(args.limit || 10);
      return tenantDb.prepare(query).all(...params);
    }

    if (name === 'send_email') {
      const recipientEmail = args.recipient_email || args.to;
      const subject = args.subject;
      const body = args.body || args.message;
      const docIdOrNumber = args.doc_id_or_number || args.doc_id;

      if (docIdOrNumber) {
        return await sendDocumentEmail({
          userId,
          docIdOrNumber,
          recipientEmail,
          customMessage: body,
        });
      }

      return await sendOutboundEmail({
        userId,
        to: recipientEmail,
        subject,
        body,
      });
    }

    return { error: `Unknown tool: ${name}` };
  } catch (err) {
    return { error: err.message };
  }
}

// Fallback rule-based NLP when remote AI model endpoint is not configured
function fallbackNlpAssistant(userId = 1, userMessage) {
  const tenantDb = getTenantDb(userId);
  const msg = userMessage.toLowerCase().trim();

  if (msg.includes('pipeline') || msg.includes('summary') || msg.includes('how are we doing') || msg.includes('overview') || msg.includes('stats')) {
    const s = executeCrmTool(userId, 'get_pipeline_summary');
    return `[ABADI GURU CRM Executive Summary]:\n\n• Active Pipeline: $${s.total_pipeline_value.toLocaleString()} across ${s.open_deals_count} open opportunities\n• Weighted Forecast: $${s.weighted_forecast.toLocaleString()}\n• Closed Won Revenue: $${s.won_revenue.toLocaleString()} (${s.won_deals_count} deals)\n• Active Leads: ${s.active_leads} (${s.hot_leads_count} Tier-1 Hot)\n\n*Pacing is healthy for this quarter.*`;
  }

  if (msg.includes('deal') || msg.includes('opportunity')) {
    const deals = executeCrmTool(userId, 'list_deals', { limit: 5 });
    if (!deals || deals.length === 0) {
      return `[Sales Pipeline]: No active deals found in pipeline.`;
    }
    let text = `[Top Active Deals in Pipeline]:\n\n`;
    deals.forEach((d, i) => {
      text += `${i + 1}. **${d.name}**\n   • Amount: $${Number(d.amount).toLocaleString()}\n   • Stage: ${d.stage} (${d.probability}% win)\n   • Client: ${d.account_name}\n\n`;
    });
    return text;
  }

  if (msg.includes('lead') || msg.includes('prospect')) {
    const leads = executeCrmTool(userId, 'list_leads', { limit: 5 });
    if (!leads || leads.length === 0) {
      return `[Leads]: No active leads found in this account yet.`;
    }
    let text = `[Top Rated Prospects - ABADI GURU Intelligence]:\n\n`;
    leads.forEach((l, i) => {
      text += `${i + 1}. **${l.first_name} ${l.last_name}** (${l.company})\n   • Score: ${l.score} pts [${l.score_tier}]\n   • Est. Budget: $${Number(l.annual_revenue).toLocaleString()}\n   • Status: ${l.lead_status}\n\n`;
    });
    return text;
  }

  if (msg.includes('task') || msg.includes('call') || msg.includes('meeting') || msg.includes('schedule')) {
    const tasks = tenantDb.prepare("SELECT title, type, due_date, status FROM activities WHERE is_closed = 0 ORDER BY due_date ASC LIMIT 5").all();
    if (!tasks || tasks.length === 0) {
      return `[Activities]: No pending activities scheduled for today.`;
    }
    let text = `[Upcoming Scheduled Activities]:\n\n`;
    tasks.forEach((t, i) => {
      text += `${i + 1}. [${t.type.toUpperCase()}] **${t.title}** (Due: ${t.due_date})\n`;
    });
    return text;
  }

  if (msg.includes('invoice') || msg.includes('quote') || msg.includes('billing')) {
    const quotes = executeCrmTool(userId, 'list_invoices', { limit: 5 });
    if (!quotes || quotes.length === 0) {
      return `[Invoices & Quotes]: No invoices generated yet. You can create one anytime by saying: "Generate invoice for <Client> for $<Amount>".`;
    }
    let text = `[Recent Invoices & Quotes]:\n\n`;
    quotes.forEach((q, i) => {
      text += `${i + 1}. **${q.quote_number}** - ${q.subject}\n   • Client: ${q.account_name}\n   • Total: $${Number(q.grand_total).toLocaleString()} [${q.quote_stage}]\n\n`;
    });
    return text;
  }

  return `[ABADI GURU Intelligence Copilot]\n\nI can help you monitor and control your CRM. Try asking:\n• "Show me our pipeline summary"\n• "List top deals"\n• "Show qualified leads"\n• "Generate invoice for <Client> for $<Amount>"\n• "What tasks are due today?"`;
}

// Main AI chat function (Hermes / OpenAI / Ollama / Custom compatible)
export async function chatWithAI(userId = 1, messages = [], roleInstruction = '') {
  const settings = getSettings(userId);
  const basePrompt = `You are "ABADI GURU Intelligence Copilot", an elite AI sales assistant embedded in ABADI GURU CRM.
You have real-time access to the user's CRM database via tools.
When asked about pipeline, deals, leads, revenue, tasks, or creating invoices/quotes, ALWAYS call the appropriate tool to retrieve accurate figures or generate the records.
When asked to create an invoice or quote, call the "create_invoice" tool and return a clear, formatted breakdown with subtotal, tax, and total.
Do NOT use emojis in your responses. Present professional, executive, concise answers formatted cleanly with numbers, bullet points, dollar signs, and commas.`;

  const systemPrompt = roleInstruction ? `${basePrompt}\n\n${roleInstruction}` : basePrompt;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  if (settings.ai_base_url) {
    try {
      const cleanBase = settings.ai_base_url.replace(/\/+$/, '');
      const url = cleanBase.endsWith('/chat/completions') ? cleanBase : `${cleanBase}/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (settings.ai_api_key) {
        headers['Authorization'] = `Bearer ${settings.ai_api_key}`;
      }

      const payload = {
        model: settings.ai_model || 'hermes-3-llama-3.1-8b',
        messages: formattedMessages,
        tools: CRM_TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(40000),
      });

      if (res.ok) {
        const data = await res.json();
        const choice = data.choices?.[0];

        if (choice?.message?.tool_calls?.length > 0) {
          const toolCalls = choice.message.tool_calls;
          const conversationWithTool = [...formattedMessages, choice.message];

          for (const tc of toolCalls) {
            let parsedArgs = {};
            try {
              parsedArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            } catch (e) {}

            const toolResult = await executeCrmTool(userId, tc.function.name, parsedArgs);
            conversationWithTool.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify(toolResult),
            });
          }

          const secondRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: settings.ai_model,
              messages: conversationWithTool,
              temperature: 0.3,
            }),
            signal: AbortSignal.timeout(40000),
          });

          if (secondRes.ok) {
            const secondData = await secondRes.json();
            return {
              reply: secondData.choices?.[0]?.message?.content || 'Action executed successfully.',
              toolCalls: toolCalls.map(t => t.function.name),
              model: settings.ai_model,
              provider: settings.ai_provider,
            };
          }
        }

        if (choice?.message?.content) {
          return {
            reply: choice.message.content,
            model: settings.ai_model,
            provider: settings.ai_provider,
          };
        }
      }
    } catch (err) {
      console.warn(`[AI Engine] Remote AI endpoint failed (${err.message}). Using local copilot fallback.`);
    }
  }

  // Graceful Built-in Fallback with zero configuration required
  const lastUserMsg = messages[messages.length - 1]?.content || '';
  return {
    reply: fallbackNlpAssistant(userId, lastUserMsg),
    model: 'ABADI GURU Intelligence Copilot',
    provider: 'local-native',
  };
}

// Live Connection Tester
export async function testAIConnection(userId = 1, customConfig = null) {
  const dbSettings = getSettings(userId);
  const settings = { ...dbSettings, ...(customConfig || {}) };
  const baseUrl = settings.ai_base_url;

  if (!baseUrl) {
    return { ok: false, success: false, message: 'AI Base URL is empty.' };
  }

  try {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = cleanBase.endsWith('/chat/completions') ? cleanBase : `${cleanBase}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (settings.ai_api_key) {
      headers['Authorization'] = `Bearer ${settings.ai_api_key}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.ai_model || 'hermes-3-llama-3.1-8b',
        messages: [{ role: 'user', content: 'Say "ABADI GURU Connected" in 3 words.' }],
        max_tokens: 15,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content || 'Connection verified!';
      return {
        ok: true,
        success: true,
        model: settings.ai_model,
        message: `Connected successfully to ${settings.ai_model || 'model'}! Model output: "${answer.trim()}"`
      };
    } else {
      const errText = await res.text();
      return {
        ok: false,
        success: false,
        message: `Endpoint responded with HTTP ${res.status}: ${errText.slice(0, 150)}`
      };
    }
  } catch (err) {
    return {
      ok: false,
      success: false,
      message: `Connection attempt failed (${err.message}). Ensure endpoint URL and API Key are valid.`
    };
  }
}
