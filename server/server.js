import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, masterDb, getTenantDb, initTenantSeedData, tenantStorage, initDatabase, TENANTS_DIR, DEFAULT_AGENT_PERMISSIONS, ADMIN_PERMISSIONS, isCompanyAdmin, parseUserPermissions, generateTelegramLinkCode } from './db.js';
import { getSettings, saveSettings, chatWithAI, testAIConnection, executeCrmTool } from './ai.js';
import { getBotStatus, startTelegramBot, stopTelegramBot, sendTelegramMessage, sendProactiveAlert, initTelegramIfEnabled } from './telegram.js';
import { generateDocumentPdfBuffer, generateInvoicePdfBuffer } from './pdf.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { generateToken, verifyToken, sanitizeUser, authMiddleware, optionalAuthMiddleware, SUBSCRIPTION_PLANS } from './auth.js';
import { sendOutboundEmail, sendDocumentEmail } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize tables and seed data
initDatabase();
initTelegramIfEnabled();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ----------------------------------------------------
// MULTI-TENANT REQUEST ISOLATION & PERMISSION MIDDLEWARE
// Securely routes all queries to the authenticating user's private database
// and attaches role-based module permissions
// ----------------------------------------------------
app.use('/api', (req, res, next) => {
  let targetTenantDb = null;
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const user = masterDb.prepare(`
        SELECT id, name, email, role, avatar, company, subscription_tier,
               subscription_status, is_superadmin, tenant_id, phone,
               quota_target, status, permissions, telegram_chat_id, telegram_link_code, created_at
        FROM users WHERE id = ?
      `).get(decoded.id);

      if (user) {
        const tenantId = user.tenant_id || decoded.id;
        targetTenantDb = getTenantDb(tenantId);
        user.parsedPermissions = parseUserPermissions(user);
        req.user = user;
        req.userPermissions = user.parsedPermissions;
        req.userId = decoded.id;
        req.tenantId = tenantId;
      }
    }
  }

  // If not authenticated, default to Tenant 1 for public demo preview
  if (!targetTenantDb) {
    targetTenantDb = getTenantDb(1);
    req.userId = 1;
    req.tenantId = 1;
    req.userPermissions = ADMIN_PERMISSIONS;
  }

  req.tenantDb = targetTenantDb;
  tenantStorage.run(targetTenantDb, () => {
    next();
  });
});

// Stage probability mapping
const STAGE_PROBABILITIES = {
  'Qualification': 10,
  'Needs Analysis': 20,
  'Value Proposition': 40,
  'Proposal / Price Quote': 60,
  'Negotiation / Review': 80,
  'Closed Won': 100,
  'Closed Lost': 0,
};

// ----------------------------------------------------
// AUTHENTICATION & SUBSCRIPTIONS
// ----------------------------------------------------
app.get('/api/users', optionalAuthMiddleware, (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user ? (req.user.tenant_id || req.user.id) : 1);
    const users = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, subscription_tier,
             subscription_status, trial_ends_at, subscription_expires_at, is_superadmin
      FROM users
      WHERE tenant_id = ? OR (id = ? AND tenant_id IS NULL)
      ORDER BY CASE WHEN role LIKE '%Admin%' OR role LIKE '%Owner%' THEN 1 ELSE 2 END, id ASC
    `).all(tenantId, tenantId);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Registration / Sign Up (Registers New Company Profile & creates isolated database)
app.post('/api/auth/signup', (req, res) => {
  try {
    const {
      name,
      email,
      password,
      company,
      company_name,
      company_reg_no = '',
      company_phone = '',
      company_email = '',
      company_address = '',
      company_website = '',
      industry = 'Technology',
      currency_symbol = '$',
      tier = 'Professional'
    } = req.body;

    const companyLegalName = (company_name || company || req.body.companyName || '').trim();
    if (!companyLegalName) {
      return res.status(400).json({ error: 'Company Name is required. Signing up creates your company profile.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company Administrator full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Administrator work email is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = masterDb.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const trialEnds = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const validTier = ['Starter', 'Professional', 'Enterprise'].includes(tier) ? tier : 'Professional';

    const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=e11d48,4f46e5,0284c7`;

    const cleanCompanyPhone = (company_phone || req.body.companyPhone || '').trim();
    const cleanCompanyRegNo = (company_reg_no || req.body.companyRegNo || '').trim();
    const cleanCompanyEmail = (company_email || req.body.companyEmail || '').trim();
    const cleanCompanyAddress = (company_address || req.body.companyAddress || '').trim();
    const cleanCompanyWebsite = (company_website || req.body.companyWebsite || '').trim();
    const cleanIndustry = (industry || req.body.companyIndustry || 'Technology').trim();
    const cleanCurrency = (currency_symbol || req.body.currencySymbol || '$').trim();

    // 1. Insert new Company Administrator in masterDb
    const adminLinkCode = generateTelegramLinkCode('admin');
    const stmt = masterDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, avatar, company, subscription_tier, subscription_status, trial_ends_at, is_superadmin, phone, quota_target, status, telegram_link_code)
      VALUES (?, ?, ?, 'Company Admin', ?, ?, ?, 'trial', ?, 0, ?, 100000, 'active', ?)
    `);
    const result = stmt.run(
      name.trim(),
      cleanEmail,
      hash,
      defaultAvatar,
      companyLegalName,
      validTier,
      trialEnds,
      cleanCompanyPhone,
      adminLinkCode
    );
    const newUserId = Number(result.lastInsertRowid);

    // Set tenant_id to own newUserId so all company team members point to this tenant
    masterDb.prepare('UPDATE users SET tenant_id = ? WHERE id = ?').run(newUserId, newUserId);

    // 2. Initialize brand brand new, physically separated tenant database with full company profile
    getTenantDb(newUserId, {
      name: name.trim(),
      company: companyLegalName,
      company_name: companyLegalName,
      company_reg_no: cleanCompanyRegNo || '2026-CO-8910',
      company_phone: cleanCompanyPhone || '+1 (555) 019-2834',
      company_email: cleanCompanyEmail || cleanEmail,
      company_address: cleanCompanyAddress || 'Level 28, Financial Business Tower',
      company_website: cleanCompanyWebsite || 'https://abadiguru.com',
      industry: cleanIndustry,
      currency_symbol: cleanCurrency
    });

    const newUser = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, subscription_tier,
             subscription_status, trial_ends_at, subscription_expires_at, is_superadmin,
             tenant_id, phone, quota_target, status, created_at
      FROM users WHERE id = ?
    `).get(newUserId);

    const token = generateToken(newUser);

    res.status(201).json({
      user: newUser,
      token,
      message: `Company profile "${companyLegalName}" created successfully! Welcome to your private CRM workspace.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Sign In / Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = masterDb.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Safety fallback for legacy demo accounts
    if (!user.password_hash) {
      user.password_hash = bcrypt.hashSync('admin123', 10);
      masterDb.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(user.password_hash, user.id);
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check trial expiration
    if (user.subscription_status === 'trial' && user.trial_ends_at) {
      const isExpired = new Date(user.trial_ends_at).getTime() < Date.now();
      if (isExpired) {
        user.subscription_status = 'expired';
        masterDb.prepare("UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = ?").run(user.id);
      }
    }

    const safeUser = sanitizeUser(user);
    const token = generateToken(safeUser);

    res.json({
      user: safeUser,
      token,
      message: 'Signed in successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate current session / Get Logged-in Profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Sign Out
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Signed out.' });
});

// Get Subscription Plans
app.get('/api/subscription/plans', (req, res) => {
  res.json(SUBSCRIPTION_PLANS);
});

// Upgrade / Subscribe Plan
app.post('/api/subscription/upgrade', authMiddleware, (req, res) => {
  try {
    const { tier, billingCycle = 'monthly' } = req.body;
    const validTier = ['Starter', 'Professional', 'Enterprise'].includes(tier) ? tier : 'Professional';
    const days = billingCycle === 'annual' ? 365 : 30;
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

    masterDb.prepare(`
      UPDATE users
      SET subscription_tier = ?,
          subscription_status = 'active',
          subscription_expires_at = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(validTier, expiresAt, req.user.id);

    const updated = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, subscription_tier,
             subscription_status, trial_ends_at, subscription_expires_at, is_superadmin
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({
      user: updated,
      message: `Successfully upgraded to ${validTier} Plan (${billingCycle})!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: View all subscribed users
app.get('/api/admin/users', authMiddleware, (req, res) => {
  try {
    const users = masterDb.prepare(`
      SELECT id, name, email, role, company, subscription_tier, subscription_status,
             trial_ends_at, subscription_expires_at, is_superadmin, created_at
      FROM users
      ORDER BY id ASC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Manage user subscription status & tier
app.put('/api/admin/users/:id/subscription', authMiddleware, (req, res) => {
  try {
    const { subscription_tier, subscription_status, daysToAdd } = req.body;
    const targetUser = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    let expiresAt = targetUser.subscription_expires_at;
    if (daysToAdd) {
      expiresAt = new Date(Date.now() + Number(daysToAdd) * 86400000).toISOString().split('T')[0];
    }

    masterDb.prepare(`
      UPDATE users
      SET subscription_tier = COALESCE(?, subscription_tier),
          subscription_status = COALESCE(?, subscription_status),
          subscription_expires_at = COALESCE(?, subscription_expires_at),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(subscription_tier, subscription_status, expiresAt, req.params.id);

    const updated = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, subscription_tier,
             subscription_status, trial_ends_at, subscription_expires_at, is_superadmin
      FROM users WHERE id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GLOBAL SEARCH (Zoho Global Search Bar)
// ----------------------------------------------------
app.get('/api/search', (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json({ leads: [], accounts: [], contacts: [], deals: [], activities: [] });
    }
    const qWildcard = `%${query}%`;

    const leads = db.prepare(`
      SELECT id, first_name, last_name, company, email, phone, lead_status
      FROM leads
      WHERE (first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR email LIKE ?)
      AND is_converted = 0
      LIMIT 5
    `).all(qWildcard, qWildcard, qWildcard, qWildcard);

    const accounts = db.prepare(`
      SELECT id, name, industry, phone, website
      FROM accounts
      WHERE name LIKE ? OR industry LIKE ?
      LIMIT 5
    `).all(qWildcard, qWildcard);

    const contacts = db.prepare(`
      SELECT id, first_name, last_name, account_name, email, phone, title
      FROM contacts
      WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR account_name LIKE ?
      LIMIT 5
    `).all(qWildcard, qWildcard, qWildcard, qWildcard);

    const deals = db.prepare(`
      SELECT id, name, account_name, amount, stage
      FROM deals
      WHERE name LIKE ? OR account_name LIKE ?
      LIMIT 5
    `).all(qWildcard, qWildcard);

    const activities = db.prepare(`
      SELECT id, type, title, status, due_date, related_to_name
      FROM activities
      WHERE title LIKE ? OR description LIKE ?
      LIMIT 5
    `).all(qWildcard, qWildcard);

    res.json({ leads, accounts, contacts, deals, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DASHBOARD & ANALYTICS
// ----------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    // 1. Lead stats
    let totalLeads = 0;
    let convertedLeads = 0;
    let leadSources = [];

    if (isAdmin || perms.leads === 'all') {
      totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE is_converted = 0').get().count;
      convertedLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE is_converted = 1').get().count;
      leadSources = db.prepare(`
        SELECT lead_source as source, COUNT(*) as count
        FROM leads
        GROUP BY lead_source
        ORDER BY count DESC
        LIMIT 6
      `).all();
    } else if (perms.leads === 'assigned') {
      totalLeads = db.prepare(`
        SELECT COUNT(*) as count FROM leads
        WHERE is_converted = 0 AND (lead_owner_id = ? OR id IN (SELECT lead_id FROM lead_access WHERE user_id = ?))
      `).get(userId, userId).count;
      convertedLeads = db.prepare(`
        SELECT COUNT(*) as count FROM leads
        WHERE is_converted = 1 AND (lead_owner_id = ? OR id IN (SELECT lead_id FROM lead_access WHERE user_id = ?))
      `).get(userId, userId).count;
      leadSources = db.prepare(`
        SELECT lead_source as source, COUNT(*) as count
        FROM leads
        WHERE lead_owner_id = ? OR id IN (SELECT lead_id FROM lead_access WHERE user_id = ?)
        GROUP BY lead_source
        ORDER BY count DESC
        LIMIT 6
      `).all(userId, userId);
    } // If perms.leads === 'none', stays 0 and []

    // 2. Deal stats & Pipeline
    let openDeals = { count: 0, total: 0, weighted: 0 };
    let wonDeals = { count: 0, total: 0 };
    let lostDeals = { count: 0, total: 0 };

    const stages = [
      'Qualification',
      'Needs Analysis',
      'Value Proposition',
      'Proposal / Price Quote',
      'Negotiation / Review',
      'Closed Won',
      'Closed Lost'
    ];
    let pipelineByStage = stages.map(stage => ({
      stage, count: 0, value: 0, probability: STAGE_PROBABILITIES[stage] || 0
    }));

    if (isAdmin || perms.deals === 'all') {
      openDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total, COALESCE(SUM(expected_revenue), 0) as weighted FROM deals WHERE stage NOT IN ('Closed Won', 'Closed Lost')").get();
      wonDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM deals WHERE stage = 'Closed Won'").get();
      lostDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM deals WHERE stage = 'Closed Lost'").get();
      pipelineByStage = stages.map(stage => {
        const row = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as value FROM deals WHERE stage = ?').get(stage);
        return {
          stage,
          count: row.count,
          value: row.value,
          probability: STAGE_PROBABILITIES[stage] || 0
        };
      });
    } else if (perms.deals === 'assigned') {
      openDeals = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total, COALESCE(SUM(expected_revenue), 0) as weighted
        FROM deals
        WHERE stage NOT IN ('Closed Won', 'Closed Lost') AND (owner_id = ? OR contact_id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))
      `).get(userId, userId);
      wonDeals = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM deals
        WHERE stage = 'Closed Won' AND (owner_id = ? OR contact_id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))
      `).get(userId, userId);
      lostDeals = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
        FROM deals
        WHERE stage = 'Closed Lost' AND (owner_id = ? OR contact_id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))
      `).get(userId, userId);
      pipelineByStage = stages.map(stage => {
        const row = db.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as value
          FROM deals
          WHERE stage = ? AND (owner_id = ? OR contact_id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))
        `).get(stage, userId, userId);
        return {
          stage,
          count: row.count,
          value: row.value,
          probability: STAGE_PROBABILITIES[stage] || 0
        };
      });
    }

    const totalClosed = wonDeals.count + lostDeals.count;
    const winRate = totalClosed > 0 ? Math.round((wonDeals.count / totalClosed) * 100) : 0;

    // 3. Sales Rep Performance
    let salesRepPerformance = [];
    if (isAdmin || perms.reports !== 'none') {
      salesRepPerformance = db.prepare(`
        SELECT owner_name as name,
               COUNT(*) as dealCount,
               COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0) as wonAmount,
               COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN amount ELSE 0 END), 0) as pipelineAmount
        FROM deals
        GROUP BY owner_name
        ORDER BY wonAmount DESC
      `).all();
    } else {
      // Rep sees only their own performance
      const selfName = req.user?.name || 'You';
      const selfStats = db.prepare(`
        SELECT COUNT(*) as dealCount,
               COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0) as wonAmount,
               COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN amount ELSE 0 END), 0) as pipelineAmount
        FROM deals
        WHERE owner_id = ?
      `).get(userId) || { dealCount: 0, wonAmount: 0, pipelineAmount: 0 };
      salesRepPerformance = [{ name: selfName, ...selfStats }];
    }

    // 4. Activities upcoming
    const today = new Date().toISOString().split('T')[0];
    let pendingTasks = 0;
    let recentActivities = [];

    if (isAdmin) {
      pendingTasks = db.prepare("SELECT COUNT(*) as count FROM activities WHERE is_closed = 0 AND due_date <= ?").get(today).count;
      recentActivities = db.prepare(`
        SELECT * FROM activities
        ORDER BY created_at DESC
        LIMIT 6
      `).all();
    } else {
      pendingTasks = db.prepare("SELECT COUNT(*) as count FROM activities WHERE is_closed = 0 AND due_date <= ? AND (owner_id = ? OR owner_id = 1)").get(today, userId).count;
      recentActivities = db.prepare(`
        SELECT * FROM activities
        WHERE owner_id = ? OR owner_id = 1
        ORDER BY created_at DESC
        LIMIT 6
      `).all(userId);
    }

    // 5. Top accounts
    let topAccounts = [];
    if (isAdmin || perms.accounts === 'all') {
      topAccounts = db.prepare(`
        SELECT id, name, industry, annual_revenue
        FROM accounts
        ORDER BY annual_revenue DESC
        LIMIT 5
      `).all();
    } else if (perms.accounts === 'assigned') {
      topAccounts = db.prepare(`
        SELECT id, name, industry, annual_revenue
        FROM accounts
        WHERE owner_id = ? OR id IN (SELECT account_id FROM contacts WHERE owner_id = ? OR id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))
        ORDER BY annual_revenue DESC
        LIMIT 5
      `).all(userId, userId, userId);
    }

    // 6. Company Sales Agents Roster & Quotas
    const currentTenantId = req.tenantId || req.userId || 1;
    const teamAgents = masterDb.prepare(`
      SELECT id, name, email, role, avatar, phone, quota_target, status
      FROM users
      WHERE tenant_id = ? OR (id = ? AND tenant_id IS NULL)
      ORDER BY CASE WHEN role LIKE '%Admin%' OR role LIKE '%Owner%' THEN 1 ELSE 2 END, id ASC
    `).all(currentTenantId, currentTenantId);

    let salesAgents = teamAgents.map(agent => {
      const perf = salesRepPerformance.find(p => p.name === agent.name || p.name.includes(agent.name.split(' ')[0])) || {
        dealCount: 0,
        wonAmount: 0,
        pipelineAmount: 0
      };
      const quota = agent.quota_target || 50000;
      const progressPercent = quota > 0 ? Math.min(100, Math.round((Number(perf.wonAmount) / quota) * 100)) : 0;
      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        avatar: agent.avatar,
        phone: agent.phone || '',
        quotaTarget: quota,
        status: agent.status || 'active',
        dealCount: perf.dealCount,
        wonAmount: perf.wonAmount,
        pipelineAmount: perf.pipelineAmount,
        progressPercent,
        isOwner: agent.id === currentTenantId || agent.role.includes('Admin')
      };
    });

    if (!isAdmin && perms.reports === 'none') {
      // Rep sees only their own quota card
      salesAgents = salesAgents.filter(a => a.id === userId);
    }

    res.json({
      summary: {
        activeLeadsCount: totalLeads,
        convertedLeadsCount: convertedLeads,
        pipelineValue: openDeals.total,
        pipelineCount: openDeals.count,
        weightedPipeline: openDeals.weighted,
        wonRevenue: wonDeals.total,
        wonCount: wonDeals.count,
        winRate,
        pendingTasksToday: pendingTasks,
        teamSeatsCount: salesAgents.filter(a => !a.isOwner && !a.role?.toLowerCase().includes('admin') && !a.role?.toLowerCase().includes('owner')).length
      },
      pipelineByStage,
      leadSources,
      salesRepPerformance,
      salesAgents,
      recentActivities,
      topAccounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ADVANCED REPORTS & ANALYTICS
// ----------------------------------------------------
app.get('/api/reports/funnel', (req, res) => {
  try {
    const totalLeads = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(annual_revenue), 0) as val FROM leads').get();
    const qualifiedLeads = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(annual_revenue), 0) as val FROM leads WHERE lead_status IN ('Contacted', 'In Progress', 'Qualified') OR is_converted = 1").get();
    const allDeals = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val FROM deals').get();
    const proposalDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val FROM deals WHERE stage IN ('Proposal / Price Quote', 'Negotiation / Review', 'Closed Won')").get();
    const negotiationDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val FROM deals WHERE stage IN ('Negotiation / Review', 'Closed Won')").get();
    const wonDeals = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as val FROM deals WHERE stage = 'Closed Won'").get();

    const topCount = Math.max(totalLeads.count, 1);

    const funnelStages = [
      {
        step: 1,
        name: 'Inquiries & Leads',
        description: 'New prospects captured via website, partners, events',
        count: totalLeads.count,
        value: totalLeads.val,
        conversionPct: 100,
        color: '#f43f5e',
      },
      {
        step: 2,
        name: 'Qualified Prospects',
        description: 'Leads with confirmed budget & project interest',
        count: qualifiedLeads.count,
        value: qualifiedLeads.val,
        conversionPct: Math.round((qualifiedLeads.count / topCount) * 100),
        color: '#fb7185',
      },
      {
        step: 3,
        name: 'Pipeline Opportunities',
        description: 'Active deals in evaluation & solution discovery',
        count: allDeals.count,
        value: allDeals.val,
        conversionPct: Math.round((allDeals.count / topCount) * 100),
        color: '#3b82f6',
      },
      {
        step: 4,
        name: 'Proposal & Price Quote',
        description: 'Formal quotations submitted for pricing review',
        count: proposalDeals.count,
        value: proposalDeals.val,
        conversionPct: Math.round((proposalDeals.count / topCount) * 100),
        color: '#f59e0b',
      },
      {
        step: 5,
        name: 'Contract Negotiation',
        description: 'Legal review, SLA finalization, executive sign-off',
        count: negotiationDeals.count,
        value: negotiationDeals.val,
        conversionPct: Math.round((negotiationDeals.count / topCount) * 100),
        color: '#ea580c',
      },
      {
        step: 6,
        name: 'Closed Won Customers',
        description: 'Signed enterprise software & services contracts',
        count: wonDeals.count,
        value: wonDeals.val,
        conversionPct: Math.round((wonDeals.count / topCount) * 100),
        color: '#10b981',
      },
    ];

    res.json(funnelStages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/monthly-trend', (req, res) => {
  try {
    const monthsData = [
      { month: 'May 26', won: 42000, pipeline: 110000, target: 45000, deals: 3 },
      { month: 'Jun 26', won: 58000, pipeline: 145000, target: 55000, deals: 4 },
      { month: 'Jul 26', won: 74000, pipeline: 210000, target: 70000, deals: 5 },
      { month: 'Aug 26', won: 92000, pipeline: 295000, target: 85000, deals: 6 },
      { month: 'Sep 26', won: 122000, pipeline: 380000, target: 110000, deals: 8 },
      { month: 'Oct 26 (Current)', won: 190000, pipeline: 480500, target: 150000, deals: 10 },
      { month: 'Nov 26 (Projected)', won: 245000, pipeline: 590000, target: 180000, deals: 12 }
    ];
    res.json(monthsData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/quotas', (req, res) => {
  try {
    const quotas = db.prepare('SELECT * FROM sales_quotas').all();
    const enriched = quotas.map(q => {
      const pct = q.target_amount > 0 ? Math.round((q.achieved_amount / q.target_amount) * 100) : 0;
      return {
        ...q,
        percentage: pct,
        remaining: Math.max(0, q.target_amount - q.achieved_amount),
        status: pct >= 100 ? 'Achieved' : pct >= 70 ? 'On Track' : 'Needs Focus'
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/insights', (req, res) => {
  try {
    const deals = db.prepare("SELECT * FROM deals WHERE stage NOT IN ('Closed Won', 'Closed Lost')").all();
    const wonCount = db.prepare("SELECT COUNT(*) as count FROM deals WHERE stage = 'Closed Won'").get().count;
    const totalPipeline = deals.reduce((acc, d) => acc + d.amount, 0);

    const hotLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE score >= 80 AND is_converted = 0").get().count;

    const insights = [
      {
        id: 1,
        type: 'growth',
        title: 'Quota Coverage Health: 240%',
        summary: `Current active pipeline of $${totalPipeline.toLocaleString()} covers more than 2.4x the quarterly sales quota target.`,
        priority: 'positive'
      },
      {
        id: 2,
        type: 'action',
        title: `${hotLeads} AI-Qualified "Hot" Leads Ready for Conversion`,
        summary: 'High predictive score leads (Arthur Pendleton, Dominic Torres, Maya Lin) have verified budgets and express urgency.',
        priority: 'high'
      },
      {
        id: 3,
        type: 'velocity',
        title: '$223,000 in Late-Stage Deals Closing This Month',
        summary: 'Nova Cloud and Apex Global Logistics are in final contract negotiation. Recommend scheduling legal alignment call.',
        priority: 'urgent'
      },
      {
        id: 4,
        type: 'channel',
        title: 'Partner Referrals Delivering Highest Win Probability',
        summary: 'Deals originating from Strategic Partner networks close with an average 68% win rate vs 42% for Cold Outreach.',
        priority: 'info'
      }
    ];

    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SIMULATED SALES EMAIL & TEMPLATES (Zoho SalesInbox)
// ----------------------------------------------------
app.get('/api/email-templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM email_templates ORDER BY id ASC').all();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/emails', (req, res) => {
  try {
    const { related_to_type, related_to_id } = req.query;
    let query = 'SELECT * FROM emails WHERE 1=1';
    const params = [];
    if (related_to_type && related_to_id) {
      query += ' AND related_to_type = ? AND related_to_id = ?';
      params.push(related_to_type, related_to_id);
    }
    query += ' ORDER BY sent_at DESC';
    const emails = db.prepare(query).all(...params);
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/emails/send', authMiddleware, async (req, res) => {
  try {
    const {
      related_to_type, related_to_id, recipient_email, recipient_name,
      sender_name, subject, body, template_name
    } = req.body;

    const result = await sendOutboundEmail({
      userId: req.user.id,
      to: recipient_email,
      recipientName: recipient_name,
      subject,
      body,
      relatedToType: related_to_type,
      relatedToId: related_to_id,
      templateName: template_name,
      senderName: sender_name,
    });

    const created = req.tenantDb.prepare('SELECT * FROM emails WHERE id = ?').get(result.emailId);
    res.status(201).json({ ...created, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1-Click Outbound Email with Attached Document PDF
app.post('/api/quotes/:id/email', authMiddleware, async (req, res) => {
  try {
    const { recipient_email, custom_message } = req.body;
    const result = await sendDocumentEmail({
      userId: req.user.id,
      docIdOrNumber: req.params.id,
      recipientEmail: recipient_email,
      customMessage: custom_message,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AI MODEL & HERMES COPILOT INTEGRATION
// ----------------------------------------------------
app.get('/api/settings/ai', authMiddleware, (req, res) => {
  try {
    const settings = getSettings(req.user.id);
    const botStatus = getBotStatus(req.user.id);
    res.json({ ...settings, botStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/ai', authMiddleware, (req, res) => {
  try {
    const updated = saveSettings(req.user.id, req.body);
    const botStatus = getBotStatus(req.user.id);
    res.json({ ...updated, botStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Document Branding & Company Presets Settings
app.get('/api/settings/branding', authMiddleware, (req, res) => {
  try {
    const settings = getSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/company', authMiddleware, (req, res) => {
  try {
    const settings = getSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/branding', authMiddleware, (req, res) => {
  try {
    const updated = saveSettings(req.user.id, req.body);
    if (req.body.company_name) {
      masterDb.prepare("UPDATE users SET company = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.company_name.trim(), req.user.id);
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/company', authMiddleware, (req, res) => {
  try {
    const updated = saveSettings(req.user.id, req.body);
    if (req.body.company_name) {
      masterDb.prepare("UPDATE users SET company = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.company_name.trim(), req.user.id);
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new separate company account / workspace with its own dedicated SQLite database
app.post('/api/companies/create', authMiddleware, (req, res) => {
  try {
    const { companyName, email, password, name, tier = 'Professional' } = req.body;
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Company administrator email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = masterDb.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please use a unique email or invite an admin.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password || 'company123', salt);
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const insertStmt = masterDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, company, subscription_tier, subscription_status, trial_ends_at)
      VALUES (?, ?, ?, 'Company Admin', ?, ?, 'trial', ?)
    `);
    const insertRes = insertStmt.run(
      (name && name.trim()) || req.user.name,
      cleanEmail,
      passwordHash,
      companyName.trim(),
      tier,
      trialEnds
    );
    const newUserId = insertRes.lastInsertRowid;

    // Initialize the brand new isolated SQLite database file
    getTenantDb(newUserId, {
      name: (name && name.trim()) || req.user.name,
      company: companyName.trim()
    });

    const newUser = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, subscription_tier,
             subscription_status, trial_ends_at, subscription_expires_at, is_superadmin, created_at
      FROM users WHERE id = ?
    `).get(newUserId);

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: `Company workspace for "${companyName.trim()}" created successfully!`,
      user: newUser,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SALES TEAM & AGENTS MANAGEMENT (Multi-User Company Workspace)
// ----------------------------------------------------

// Get all sales agents / team members for this company
app.get('/api/team/agents', authMiddleware, (req, res) => {
  try {
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;
    const agents = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, phone, quota_target, status, tenant_id, permissions, telegram_link_code, telegram_chat_id, created_at
      FROM users
      WHERE tenant_id = ? OR (id = ? AND tenant_id IS NULL)
      ORDER BY CASE WHEN role LIKE '%Admin%' OR role LIKE '%Owner%' THEN 1 ELSE 2 END, id ASC
    `).all(tenantId, tenantId);

    // Enrich agents with live pipeline and won revenue from the tenant database
    const enriched = agents.map(agent => {
      const stats = req.tenantDb.prepare(`
        SELECT 
          COUNT(*) as dealCount,
          COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0) as wonAmount,
          COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN amount ELSE 0 END), 0) as pipelineAmount
        FROM deals
        WHERE owner_name = ? OR owner_name LIKE ?
      `).get(agent.name, `%${agent.name}%`) || { dealCount: 0, wonAmount: 0, pipelineAmount: 0 };

      const leadsCount = req.tenantDb.prepare(`
        SELECT COUNT(*) as count FROM leads WHERE (lead_owner_name = ? OR lead_owner_name LIKE ?) AND is_converted = 0
      `).get(agent.name, `%${agent.name}%`)?.count || 0;

      // Count contacts explicitly granted to this agent
      const grantedContactsCount = req.tenantDb.prepare(`
        SELECT COUNT(*) as count FROM contact_access WHERE user_id = ?
      `).get(agent.id)?.count || 0;

      const quota = agent.quota_target || 50000;
      const progressPercent = quota > 0 ? Math.min(100, Math.round((Number(stats.wonAmount) / quota) * 100)) : 0;

      return {
        ...agent,
        permissions: parseUserPermissions(agent),
        grantedContactsCount,
        dealCount: stats.dealCount,
        wonAmount: stats.wonAmount,
        pipelineAmount: stats.pipelineAmount,
        activeLeadsCount: leadsCount,
        quotaTarget: quota,
        progressPercent,
        telegramLinkCode: agent.telegram_link_code,
        telegramLinked: Boolean(agent.telegram_chat_id),
        isOwner: agent.id === tenantId || agent.role.includes('Admin') || agent.role.includes('Owner')
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new sales agent account for this company
app.post('/api/team/agents', authMiddleware, (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'Sales Agent',
      phone = '',
      quota_target = 50000,
      permissions = null,
      grantedContactIds = []
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Sales Agent full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Sales Agent login email is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Initial password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = masterDb.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please choose a different email.' });
    }

    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;
    const hash = bcrypt.hashSync(password, 10);
    const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=0284c7,3b82f6,6366f1`;

    // Default: Newly created agents have ZERO data access unless granted
    const initialPerms = permissions ? { ...DEFAULT_AGENT_PERMISSIONS, ...permissions } : DEFAULT_AGENT_PERMISSIONS;
    const agentLinkCode = generateTelegramLinkCode(role);

    const stmt = masterDb.prepare(`
      INSERT INTO users (name, email, password_hash, role, avatar, company, subscription_tier, subscription_status, tenant_id, phone, quota_target, status, permissions, created_by, telegram_link_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      cleanEmail,
      hash,
      role.trim() || 'Sales Agent',
      defaultAvatar,
      req.user.company,
      req.user.subscription_tier || 'Professional',
      req.user.subscription_status || 'active',
      tenantId,
      phone.trim(),
      Number(quota_target) || 50000,
      JSON.stringify(initialPerms),
      req.userId,
      agentLinkCode
    );

    const newAgentId = Number(result.lastInsertRowid);

    // Add quota entry in company's tenant database
    try {
      req.tenantDb.prepare(`
        INSERT OR REPLACE INTO sales_quotas (user_id, user_name, period, target_amount, achieved_amount, deal_count)
        VALUES (?, ?, 'Monthly', ?, 0, 0)
      `).run(newAgentId, name.trim(), Number(quota_target) || 50000);
    } catch (qErr) {
      console.warn('Could not insert initial sales quota:', qErr.message);
    }

    // Grant initial contacts if requested
    if (Array.isArray(grantedContactIds) && grantedContactIds.length > 0) {
      const grantStmt = req.tenantDb.prepare('INSERT OR IGNORE INTO contact_access (contact_id, user_id, granted_by) VALUES (?, ?, ?)');
      for (const cid of grantedContactIds) {
        if (Number(cid)) grantStmt.run(Number(cid), newAgentId, req.userId);
      }
    }

    const createdAgent = masterDb.prepare(`
      SELECT id, name, email, role, avatar, company, phone, quota_target, status, tenant_id, permissions, created_at
      FROM users WHERE id = ?
    `).get(newAgentId);

    res.status(201).json({
      success: true,
      agent: {
        ...createdAgent,
        permissions: initialPerms
      },
      message: `Sales Agent account created for ${name.trim()} (${cleanEmail})!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get agent permissions and granted contacts
app.get('/api/team/agents/:id/permissions', authMiddleware, (req, res) => {
  try {
    const agentId = Number(req.params.id);
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;
    const isOwnerOrAdmin = isCompanyAdmin(req.user) || agentId === req.userId;
    if (!isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Only company administrators can manage agent permissions.' });
    }

    const agent = masterDb.prepare(`
      SELECT id, name, email, role, avatar, phone, quota_target, status, permissions, tenant_id
      FROM users WHERE id = ?
    `).get(agentId);

    if (!agent || (agent.tenant_id !== tenantId && agent.id !== tenantId)) {
      return res.status(404).json({ error: 'Sales agent not found in your company.' });
    }

    const permissions = parseUserPermissions(agent);

    // Get contacts explicitly granted to this agent
    const grantedContacts = req.tenantDb.prepare(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.account_name, c.title
      FROM contact_access ca
      JOIN contacts c ON c.id = ca.contact_id
      WHERE ca.user_id = ?
      ORDER BY c.first_name ASC
    `).all(agentId);

    // Get all company contacts so the admin can pick from them
    const allContacts = req.tenantDb.prepare(`
      SELECT id, first_name, last_name, email, account_name, title, owner_id
      FROM contacts
      ORDER BY first_name ASC
    `).all();

    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        avatar: agent.avatar,
        phone: agent.phone,
        quota_target: agent.quota_target
      },
      permissions,
      grantedContacts,
      allContacts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update agent permissions and granted contacts
app.put('/api/team/agents/:id/permissions', authMiddleware, (req, res) => {
  try {
    if (!isCompanyAdmin(req.user)) {
      return res.status(403).json({ error: 'Only company administrators can modify permissions.' });
    }
    const agentId = Number(req.params.id);
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;

    const agent = masterDb.prepare('SELECT id, name, tenant_id, role FROM users WHERE id = ?').get(agentId);
    if (!agent || (agent.tenant_id !== tenantId && agent.id !== tenantId)) {
      return res.status(404).json({ error: 'Sales agent not found in your company.' });
    }

    const { permissions, grantedContactIds = [] } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Valid permissions object is required.' });
    }

    const cleanPermissions = {
      ...DEFAULT_AGENT_PERMISSIONS,
      ...permissions
    };

    masterDb.prepare("UPDATE users SET permissions = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(cleanPermissions), agentId);

    // Sync granted contacts in tenant database
    req.tenantDb.prepare('DELETE FROM contact_access WHERE user_id = ?').run(agentId);
    if (Array.isArray(grantedContactIds) && grantedContactIds.length > 0) {
      const insertGrant = req.tenantDb.prepare('INSERT OR IGNORE INTO contact_access (contact_id, user_id, granted_by) VALUES (?, ?, ?)');
      for (const cid of grantedContactIds) {
        if (Number(cid)) {
          insertGrant.run(Number(cid), agentId, req.userId);
        }
      }
    }

    res.json({
      success: true,
      message: `Permissions updated successfully for ${agent.name}.`,
      permissions: cleanPermissions,
      grantedContactCount: grantedContactIds.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update sales agent
app.put('/api/team/agents/:id', authMiddleware, (req, res) => {
  try {
    const agentId = Number(req.params.id);
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;
    const { role, phone, quota_target, status } = req.body;

    const agent = masterDb.prepare('SELECT id, name, tenant_id FROM users WHERE id = ?').get(agentId);
    if (!agent || (agent.tenant_id !== tenantId && agent.id !== tenantId)) {
      return res.status(404).json({ error: 'Sales agent not found in your company.' });
    }

    masterDb.prepare(`
      UPDATE users
      SET role = COALESCE(?, role),
          phone = COALESCE(?, phone),
          quota_target = COALESCE(?, quota_target),
          status = COALESCE(?, status),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(role, phone, quota_target !== undefined ? Number(quota_target) : null, status, agentId);

    if (quota_target !== undefined) {
      try {
        req.tenantDb.prepare(`
          UPDATE sales_quotas SET target_amount = ? WHERE user_id = ? OR user_name = ?
        `).run(Number(quota_target), agentId, agent.name);
      } catch (e) {}
    }

    res.json({ success: true, message: 'Sales agent updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove sales agent
app.delete('/api/team/agents/:id', authMiddleware, (req, res) => {
  try {
    const agentId = Number(req.params.id);
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;

    if (agentId === tenantId || agentId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete the company owner or your own account.' });
    }

    const agent = masterDb.prepare('SELECT id, tenant_id FROM users WHERE id = ?').get(agentId);
    if (!agent || agent.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Sales agent not found in your company.' });
    }

    masterDb.prepare('DELETE FROM users WHERE id = ?').run(agentId);
    try {
      req.tenantDb.prepare('DELETE FROM contact_access WHERE user_id = ?').run(agentId);
      req.tenantDb.prepare('DELETE FROM sales_quotas WHERE user_id = ?').run(agentId);
    } catch (e) {}
    res.json({ success: true, message: 'Sales agent account removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset / Regenerate Telegram Link Code for an Agent or User
app.post('/api/team/agents/:id/telegram-code/reset', authMiddleware, (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const tenantId = req.tenantId || req.user.tenant_id || req.user.id;
    const targetUser = masterDb.prepare('SELECT id, role, tenant_id FROM users WHERE id = ?').get(targetId);
    if (!targetUser || (targetUser.tenant_id !== tenantId && targetUser.id !== tenantId)) {
      return res.status(404).json({ error: 'User not found in your company.' });
    }
    const newCode = generateTelegramLinkCode(targetUser.role);
    masterDb.prepare('UPDATE users SET telegram_link_code = ? WHERE id = ?').run(newCode, targetId);
    res.json({ success: true, linkCode: newCode, message: 'New Telegram link code generated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upcoming customer birthdays, milestones and special days (next 45 days)
app.get('/api/dashboard/special-days', authMiddleware, (req, res) => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();

    function getNextOccurrenceDays(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length < 2) return null;
      const month = parseInt(parts[parts.length - 2], 10) - 1;
      const day = parseInt(parts[parts.length - 1], 10);
      if (isNaN(month) || isNaN(day)) return null;

      let nextDate = new Date(currentYear, month, day);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < -1) {
        nextDate = new Date(currentYear + 1, month, day);
      }
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { daysUntil, nextDate: nextDate.toISOString().split('T')[0] };
    }

    const contacts = db.prepare(`
      SELECT id, first_name, last_name, account_name, email, phone, preferred_communication,
             date_of_birth, special_day_title, special_day_date, current_situation, relationship_health, what_they_told_us
      FROM contacts
      WHERE date_of_birth IS NOT NULL OR special_day_date IS NOT NULL
    `).all();

    const leads = db.prepare(`
      SELECT id, first_name, last_name, company as account_name, email, phone, preferred_communication,
             date_of_birth, special_day_title, special_day_date, current_situation, relationship_health, what_they_told_us
      FROM leads
      WHERE (date_of_birth IS NOT NULL OR special_day_date IS NOT NULL) AND is_converted = 0
    `).all();

    const upcoming = [];

    for (const c of [...contacts.map(x => ({ ...x, entityType: 'contact' })), ...leads.map(x => ({ ...x, entityType: 'lead' }))]) {
      if (c.date_of_birth) {
        const bday = getNextOccurrenceDays(c.date_of_birth);
        if (bday && bday.daysUntil >= -1 && bday.daysUntil <= 45) {
          upcoming.push({
            id: `${c.entityType}-${c.id}-bday`,
            entityId: c.id,
            entityType: c.entityType,
            personName: `${c.first_name} ${c.last_name}`,
            companyName: c.account_name,
            email: c.email,
            phone: c.phone,
            preferredCommunication: c.preferred_communication || 'WhatsApp',
            eventTitle: 'Birthday',
            type: 'birthday',
            originalDate: c.date_of_birth,
            daysUntil: bday.daysUntil,
            formattedDate: bday.nextDate,
            situation: c.current_situation,
            relationshipHealth: c.relationship_health,
            whatTheyToldUs: c.what_they_told_us,
          });
        }
      }
      if (c.special_day_date) {
        const sp = getNextOccurrenceDays(c.special_day_date);
        if (sp && sp.daysUntil >= -1 && sp.daysUntil <= 45) {
          upcoming.push({
            id: `${c.entityType}-${c.id}-special`,
            entityId: c.id,
            entityType: c.entityType,
            personName: `${c.first_name} ${c.last_name}`,
            companyName: c.account_name,
            email: c.email,
            phone: c.phone,
            preferredCommunication: c.preferred_communication || 'WhatsApp',
            eventTitle: c.special_day_title || 'Special Milestone',
            type: 'milestone',
            originalDate: c.special_day_date,
            daysUntil: sp.daysUntil,
            formattedDate: sp.nextDate,
            situation: c.current_situation,
            relationshipHealth: c.relationship_health,
            whatTheyToldUs: c.what_they_told_us,
          });
        }
      }
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Outbound Email (SMTP / Resend) Settings
app.get('/api/settings/email', authMiddleware, (req, res) => {
  try {
    const s = getSettings(req.user.id);
    res.json({
      email_delivery_provider: s.email_delivery_provider,
      smtp_host: s.smtp_host,
      smtp_port: s.smtp_port,
      smtp_secure: s.smtp_secure,
      smtp_user: s.smtp_user,
      smtp_pass: s.smtp_pass ? '••••••••' : '',
      smtp_from_email: s.smtp_from_email,
      smtp_from_name: s.smtp_from_name,
      resend_api_key: s.resend_api_key ? '••••••••' : '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/email', authMiddleware, (req, res) => {
  try {
    const dataToSave = { ...req.body };
    if (dataToSave.smtp_pass === '••••••••') delete dataToSave.smtp_pass;
    if (dataToSave.resend_api_key === '••••••••') delete dataToSave.resend_api_key;
    const updated = saveSettings(req.user.id, dataToSave);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/email/test', authMiddleware, async (req, res) => {
  try {
    const { toEmail } = req.body;
    if (!toEmail) return res.status(400).json({ error: 'Recipient test email address is required' });
    const s = getSettings(req.user.id);

    if (s.email_delivery_provider === 'smtp') {
      if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) {
        return res.status(400).json({ error: 'Please enter SMTP Host, Username, and Password first.' });
      }
      const transporter = nodemailer.createTransport({
        host: s.smtp_host,
        port: Number(s.smtp_port) || 587,
        secure: s.smtp_secure === '1' || Number(s.smtp_port) === 465,
        auth: {
          user: s.smtp_user,
          pass: s.smtp_pass,
        },
      });
      await transporter.sendMail({
        from: `"${s.smtp_from_name || 'ABADI GURU CRM'}" <${s.smtp_from_email || s.smtp_user}>`,
        to: toEmail,
        subject: '[TEST] ABADI GURU CRM Test Outbound Email',
        text: 'Congratulations! Your SMTP mail server is verified and delivering outbound messages.',
        html: `<h3>ABADI GURU CRM Email Delivery Verified</h3><p>Your SMTP server connection at <b>${s.smtp_host}:${s.smtp_port}</b> is operational and ready for live sales outreach.</p>`,
      });
      return res.json({ success: true, message: `Live test email successfully dispatched to ${toEmail}!` });
    }

    if (s.email_delivery_provider === 'resend') {
      if (!s.resend_api_key) {
        return res.status(400).json({ error: 'Please enter your Resend API Key.' });
      }
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${s.resend_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${s.smtp_from_name || 'ABADI GURU CRM'} <${s.smtp_from_email || 'onboarding@resend.dev'}>`,
          to: [toEmail],
          subject: '[TEST] ABADI GURU CRM Test Email (via Resend API)',
          text: 'Congratulations! Your Resend mail API connection is working.',
        }),
      });
      const data = await resendRes.json();
      if (!resendRes.ok) throw new Error(data.message || 'Resend error');
      return res.json({ success: true, message: `Live test email dispatched to ${toEmail} via Resend API!` });
    }

    res.json({ success: true, message: `Email delivery is currently in Simulated mode. Select SMTP or Resend to send live emails.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1-Click Physical Tenant Database Download & Backup
app.get('/api/backup/database', authMiddleware, (req, res) => {
  try {
    const tenantDbPath = path.join(__dirname, 'data', 'tenants', `tenant_${req.user.id}.db`);
    if (!fs.existsSync(tenantDbPath)) {
      return res.status(404).json({ error: 'Tenant database file not found on disk.' });
    }
    const safeName = (req.user.company || req.user.name || 'abadi_guru_crm').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${safeName}_backup_${dateStr}.sqlite`;

    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(tenantDbPath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    let messages = req.body.messages;
    if (!messages && req.body.message) {
      const history = req.body.history || [];
      messages = [...history, { role: 'user', content: req.body.message }];
    }
    const response = await chatWithAI(req.user.id, messages || []);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/test', authMiddleware, async (req, res) => {
  try {
    const testResult = await testAIConnection(req.user.id, req.body);
    res.json(testResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// TELEGRAM BOT REMOTE CONTROL & TELEMETRY
// ----------------------------------------------------
app.get('/api/telegram/status', authMiddleware, (req, res) => {
  try {
    res.json(getBotStatus(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/start', authMiddleware, (req, res) => {
  try {
    const result = startTelegramBot(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/telegram/stop', authMiddleware, (req, res) => {
  try {
    const result = stopTelegramBot(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/test', authMiddleware, async (req, res) => {
  try {
    const settings = getSettings(req.user.id);
    const targetChatId = req.body.chat_id || settings.telegram_chat_id;
    if (!targetChatId) {
      return res.status(400).json({ error: 'Please enter a Telegram Chat ID or message the bot first with /start.' });
    }
    const sent = await sendTelegramMessage(
      req.user.id,
      targetChatId,
      '*[ABADI GURU CRM Live Telemetry Test]*\n\nYour Telegram bot is successfully connected and controlling your private CRM database.'
    );
    res.json(sent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/telegram/logs', authMiddleware, (req, res) => {
  try {
    const logs = req.tenantDb.prepare('SELECT * FROM telegram_logs ORDER BY created_at DESC LIMIT 20').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LEADS CRUD & CONVERSION
// ----------------------------------------------------
app.get('/api/leads', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.leads === 'none') {
      return res.json([]);
    }

    const { status, source, q, converted } = req.query;
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (!isAdmin && perms.leads === 'assigned') {
      query += ' AND (lead_owner_id = ? OR id IN (SELECT lead_id FROM lead_access WHERE user_id = ?))';
      params.push(userId, userId);
    }

    if (converted === 'true') {
      query += ' AND is_converted = 1';
    } else if (converted !== 'all') {
      query += ' AND is_converted = 0';
    }

    if (status && status !== 'All') {
      query += ' AND lead_status = ?';
      params.push(status);
    }
    if (source && source !== 'All') {
      query += ' AND lead_source = ?';
      params.push(source);
    }
    if (q) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR company LIKE ? OR email LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY id DESC';
    const leads = db.prepare(query).all(...params);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.leads === 'none') {
      return res.status(403).json({ error: 'Access denied: Leads module is restricted.' });
    }

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (!isAdmin && perms.leads === 'assigned') {
      const isOwner = lead.lead_owner_id === userId;
      const hasGrant = db.prepare('SELECT 1 FROM lead_access WHERE lead_id = ? AND user_id = ?').get(req.params.id, userId);
      if (!isOwner && !hasGrant) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this lead.' });
      }
    }

    const notes = db.prepare("SELECT * FROM notes WHERE related_to_type = 'lead' AND related_to_id = ? ORDER BY created_at DESC").all(req.params.id);
    const activities = db.prepare("SELECT * FROM activities WHERE related_to_type = 'lead' AND related_to_id = ? ORDER BY due_date DESC").all(req.params.id);
    const emails = db.prepare("SELECT * FROM emails WHERE (related_to_type = 'lead' AND related_to_id = ?) OR (recipient_email = ? AND recipient_email != '') ORDER BY sent_at DESC").all(req.params.id, lead.email || '');
    const customFields = db.prepare(`
      SELECT cf.field_key, cf.field_label, cf.field_type, cf.options_json, cfv.field_value
      FROM custom_fields cf
      LEFT JOIN custom_field_values cfv ON cfv.field_key = cf.field_key AND cfv.entity_type = 'leads' AND cfv.entity_id = ?
      WHERE cf.entity_type = 'leads'
    `).all(req.params.id);

    res.json({ ...lead, notes, activities, emails, customFields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads', authMiddleware, (req, res) => {
  try {
    const {
      first_name, last_name, company, title, email, phone, mobile, website,
      lead_source, lead_status, rating, annual_revenue, employees, industry,
      street, city, state, zip, country, description,
      date_of_birth, special_day_title, special_day_date, personal_interests,
      preferred_communication, current_situation, relationship_health, what_they_told_us,
      next_follow_up_date, lead_owner_name
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO leads (
        first_name, last_name, company, title, email, phone, mobile, website,
        lead_source, lead_status, rating, annual_revenue, employees, industry,
        street, city, state, zip, country, description,
        date_of_birth, special_day_title, special_day_date, personal_interests,
        preferred_communication, current_situation, relationship_health, what_they_told_us,
        next_follow_up_date, lead_owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      first_name || 'New',
      last_name || 'Lead',
      company || 'Individual',
      title || '',
      email || '',
      phone || '',
      mobile || '',
      website || '',
      lead_source || 'Web Form',
      lead_status || 'New',
      rating || 'Active',
      Number(annual_revenue) || 0,
      Number(employees) || 0,
      industry || 'Technology',
      street || '',
      city || '',
      state || '',
      zip || '',
      country || '',
      description || '',
      date_of_birth || null,
      special_day_title || null,
      special_day_date || null,
      personal_interests || '',
      preferred_communication || 'WhatsApp',
      current_situation || '',
      relationship_health || 'New Prospect',
      what_they_told_us || '',
      next_follow_up_date || null,
      lead_owner_name || 'Alex Mercer'
    );

    const leadId = result.lastInsertRowid;

    // Check automated workflows for 'lead_created'
    const workflows = db.prepare("SELECT * FROM workflows WHERE trigger_event = 'lead_created' AND is_active = 1").all();
    if (workflows.length > 0) {
      // Auto create discovery call activity
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO activities (type, title, priority, status, due_date, due_time, related_to_type, related_to_id, related_to_name, owner_name)
        VALUES ('call', ?, 'High', 'Not Started', ?, '10:00', 'lead', ?, ?, ?)
      `).run(
        `Automated Welcome & Discovery Call: ${first_name} ${last_name}`,
        tomorrow,
        leadId,
        `${first_name} ${last_name} (${company || 'Individual'})`,
        lead_owner_name || 'Alex Mercer'
      );

      // Increment workflow execution count
      workflows.forEach(wf => {
        db.prepare("UPDATE workflows SET execution_count = execution_count + 1, last_triggered_at = datetime('now') WHERE id = ?").run(wf.id);
      });
    }

    const createdLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
    res.status(201).json(createdLead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/leads/:id', authMiddleware, (req, res) => {
  try {
    const fields = [
      'first_name', 'last_name', 'company', 'title', 'email', 'phone', 'mobile', 'website',
      'lead_source', 'lead_status', 'rating', 'annual_revenue', 'employees', 'industry',
      'street', 'city', 'state', 'zip', 'country', 'description',
      'date_of_birth', 'special_day_title', 'special_day_date', 'personal_interests',
      'preferred_communication', 'current_situation', 'relationship_health', 'what_they_told_us',
      'next_follow_up_date', 'lead_owner_name'
    ];
    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/leads/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ZOHO 1-CLICK LEAD CONVERSION (Lead -> Account + Contact + optional Deal)
app.post('/api/leads/:id/convert', authMiddleware, (req, res) => {
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.is_converted) return res.status(400).json({ error: 'Lead has already been converted.' });

    const {
      createDeal = true,
      dealName = `${lead.company} - New Deal`,
      dealAmount = lead.annual_revenue > 0 ? Math.round(lead.annual_revenue * 0.1) : 25000,
      dealClosingDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      dealStage = 'Qualification'
    } = req.body;

    // 1. Create or Find Account
    let account = db.prepare('SELECT * FROM accounts WHERE name = ?').get(lead.company);
    let accountId = account ? account.id : null;

    if (!accountId) {
      const accStmt = db.prepare(`
        INSERT INTO accounts (
          name, phone, website, industry, annual_revenue, employees,
          billing_street, billing_city, billing_state, billing_zip, billing_country,
          description, owner_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const accRes = accStmt.run(
        lead.company,
        lead.phone || '',
        lead.website || '',
        lead.industry || 'Technology',
        lead.annual_revenue || 0,
        lead.employees || 0,
        lead.street || '',
        lead.city || '',
        lead.state || '',
        lead.zip || '',
        lead.country || '',
        lead.description || `Created via Lead conversion of ${lead.first_name} ${lead.last_name}`,
        lead.lead_owner_name || 'Alex Mercer'
      );
      accountId = accRes.lastInsertRowid;
    }

    // 2. Create Contact
    const contactStmt = db.prepare(`
      INSERT INTO contacts (
        account_id, account_name, first_name, last_name, email, phone, mobile,
        title, lead_source, mailing_street, mailing_city, mailing_state, mailing_zip, mailing_country,
        date_of_birth, special_day_title, special_day_date, personal_interests,
        preferred_communication, current_situation, relationship_health, what_they_told_us, next_follow_up_date,
        description, owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const contactRes = contactStmt.run(
      accountId,
      lead.company,
      lead.first_name,
      lead.last_name,
      lead.email || '',
      lead.phone || '',
      lead.mobile || '',
      lead.title || '',
      lead.lead_source || 'Lead Conversion',
      lead.street || '',
      lead.city || '',
      lead.state || '',
      lead.zip || '',
      lead.country || '',
      lead.date_of_birth || null,
      lead.special_day_title || null,
      lead.special_day_date || null,
      lead.personal_interests || '',
      lead.preferred_communication || 'WhatsApp',
      lead.current_situation || 'Successfully converted from prospect to active client account.',
      'Strong & Warm',
      lead.what_they_told_us || '',
      lead.next_follow_up_date || null,
      `Converted from Lead ID #${lead.id}`,
      lead.lead_owner_name || 'Alex Mercer'
    );
    const contactId = contactRes.lastInsertRowid;

    // 3. Optional Deal Creation
    let dealId = null;
    if (createDeal) {
      const prob = STAGE_PROBABILITIES[dealStage] || 10;
      const expectedRev = Math.round(dealAmount * (prob / 100));

      const dealStmt = db.prepare(`
        INSERT INTO deals (
          name, account_id, account_name, contact_id, contact_name,
          amount, stage, probability, closing_date, expected_revenue, lead_source, owner_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const dealRes = dealStmt.run(
        dealName,
        accountId,
        lead.company,
        contactId,
        `${lead.first_name} ${lead.last_name}`,
        Number(dealAmount) || 0,
        dealStage,
        prob,
        dealClosingDate,
        expectedRev,
        lead.lead_source || 'Lead Conversion',
        lead.lead_owner_name || 'Alex Mercer'
      );
      dealId = dealRes.lastInsertRowid;
    }

    // 4. Mark Lead as Converted
    db.prepare(`
      UPDATE leads
      SET is_converted = 1,
          converted_account_id = ?,
          converted_contact_id = ?,
          converted_deal_id = ?,
          converted_at = datetime('now')
      WHERE id = ?
    `).run(accountId, contactId, dealId, lead.id);

    // 5. Migrate Activities and Notes from Lead to Contact/Account
    db.prepare("UPDATE activities SET related_to_type = 'contact', related_to_id = ? WHERE related_to_type = 'lead' AND related_to_id = ?").run(contactId, lead.id);
    db.prepare("UPDATE notes SET related_to_type = 'contact', related_to_id = ? WHERE related_to_type = 'lead' AND related_to_id = ?").run(contactId, lead.id);

    // Log note about conversion
    db.prepare(`
      INSERT INTO notes (related_to_type, related_to_id, content, created_by_name)
      VALUES ('account', ?, ?, ?)
    `).run(accountId, `Lead ${lead.first_name} ${lead.last_name} was successfully qualified and converted.`, lead.lead_owner_name || 'Alex Mercer');

    res.json({
      success: true,
      message: 'Lead converted successfully!',
      accountId,
      contactId,
      dealId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ACCOUNTS CRUD
// ----------------------------------------------------
app.get('/api/accounts', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.accounts === 'none') {
      return res.json([]);
    }

    const { q, industry } = req.query;
    let query = `
      SELECT a.*,
             (SELECT COUNT(*) FROM contacts WHERE account_id = a.id) as contact_count,
             (SELECT COUNT(*) FROM deals WHERE account_id = a.id) as deal_count,
             (SELECT COALESCE(SUM(amount), 0) FROM deals WHERE account_id = a.id AND stage = 'Closed Won') as won_revenue
      FROM accounts a
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin && perms.accounts === 'assigned') {
      query += ' AND (a.owner_id = ? OR a.id IN (SELECT account_id FROM contacts WHERE owner_id = ? OR id IN (SELECT contact_id FROM contact_access WHERE user_id = ?)))';
      params.push(userId, userId, userId);
    }

    if (industry && industry !== 'All') {
      query += ' AND a.industry = ?';
      params.push(industry);
    }
    if (q) {
      query += ' AND (a.name LIKE ? OR a.industry LIKE ? OR a.billing_city LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    query += ' ORDER BY a.id DESC';

    const accounts = db.prepare(query).all(...params);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/accounts/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.accounts === 'none') {
      return res.status(403).json({ error: 'Access denied: Accounts module is restricted.' });
    }

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (!isAdmin && perms.accounts === 'assigned') {
      const hasAccess = account.owner_id === userId || db.prepare('SELECT 1 FROM contacts WHERE account_id = ? AND (owner_id = ? OR id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))').get(req.params.id, userId, userId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this account.' });
      }
    }

    const contacts = db.prepare('SELECT * FROM contacts WHERE account_id = ? ORDER BY id DESC').all(req.params.id);
    const deals = db.prepare('SELECT * FROM deals WHERE account_id = ? ORDER BY id DESC').all(req.params.id);
    const quotes = db.prepare('SELECT * FROM quotes WHERE account_id = ? ORDER BY id DESC').all(req.params.id);
    const activities = db.prepare("SELECT * FROM activities WHERE related_to_type = 'account' AND related_to_id = ? ORDER BY due_date DESC").all(req.params.id);
    const notes = db.prepare("SELECT * FROM notes WHERE related_to_type = 'account' AND related_to_id = ? ORDER BY created_at DESC").all(req.params.id);

    res.json({ ...account, contacts, deals, quotes, activities, notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const {
      name, phone, website, industry, annual_revenue, employees, rating, ownership, ticker_symbol,
      billing_street, billing_city, billing_state, billing_zip, billing_country,
      shipping_street, shipping_city, shipping_state, shipping_zip, shipping_country,
      description, owner_name
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO accounts (
        name, phone, website, industry, annual_revenue, employees, rating, ownership, ticker_symbol,
        billing_street, billing_city, billing_state, billing_zip, billing_country,
        shipping_street, shipping_city, shipping_state, shipping_zip, shipping_country,
        description, owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      phone || '',
      website || '',
      industry || 'Technology',
      Number(annual_revenue) || 0,
      Number(employees) || 0,
      rating || 'Active',
      ownership || 'Private',
      ticker_symbol || '',
      billing_street || '',
      billing_city || '',
      billing_state || '',
      billing_zip || '',
      billing_country || '',
      shipping_street || '',
      shipping_city || '',
      shipping_state || '',
      shipping_zip || '',
      shipping_country || '',
      description || '',
      owner_name || 'Alex Mercer'
    );

    const created = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const fields = [
      'name', 'phone', 'website', 'industry', 'annual_revenue', 'employees', 'rating', 'ownership', 'ticker_symbol',
      'billing_street', 'billing_city', 'billing_state', 'billing_zip', 'billing_country',
      'shipping_street', 'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country',
      'description', 'owner_name'
    ];
    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CONTACTS CRUD
// ----------------------------------------------------
app.get('/api/contacts', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.contacts === 'none') {
      return res.json([]);
    }

    const { q, account_id } = req.query;
    let query = 'SELECT * FROM contacts WHERE 1=1';
    const params = [];

    if (!isAdmin && perms.contacts === 'assigned') {
      query += ' AND (owner_id = ? OR id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))';
      params.push(userId, userId);
    }

    if (account_id) {
      query += ' AND account_id = ?';
      params.push(account_id);
    }
    if (q) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR account_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY id DESC';
    const contacts = db.prepare(query).all(...params);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/contacts/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.contacts === 'none') {
      return res.status(403).json({ error: 'Access denied: Contacts module is restricted.' });
    }

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    if (!isAdmin && perms.contacts === 'assigned') {
      const isOwner = contact.owner_id === userId;
      const hasGrant = db.prepare('SELECT 1 FROM contact_access WHERE contact_id = ? AND user_id = ?').get(req.params.id, userId);
      if (!isOwner && !hasGrant) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this contact.' });
      }
    }

    const deals = db.prepare('SELECT * FROM deals WHERE contact_id = ? ORDER BY id DESC').all(req.params.id);
    const quotes = db.prepare('SELECT * FROM quotes WHERE contact_id = ? ORDER BY id DESC').all(req.params.id);
    const activities = db.prepare("SELECT * FROM activities WHERE related_to_type = 'contact' AND related_to_id = ? ORDER BY due_date DESC").all(req.params.id);
    const notes = db.prepare("SELECT * FROM notes WHERE related_to_type = 'contact' AND related_to_id = ? ORDER BY created_at DESC").all(req.params.id);
    const emails = db.prepare("SELECT * FROM emails WHERE (related_to_type = 'contact' AND related_to_id = ?) OR (recipient_email = ? AND recipient_email != '') ORDER BY sent_at DESC").all(req.params.id, contact.email || '');

    res.json({ ...contact, deals, quotes, activities, notes, emails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const {
      account_id, account_name, first_name, last_name, email, phone, mobile,
      title, department, lead_source, mailing_street, mailing_city, mailing_state,
      mailing_zip, mailing_country, date_of_birth, special_day_title, special_day_date,
      personal_interests, preferred_communication, current_situation, relationship_health,
      what_they_told_us, next_follow_up_date, description, owner_name
    } = req.body;

    let resolvedAccountName = account_name;
    if (account_id && !resolvedAccountName) {
      const acc = db.prepare('SELECT name FROM accounts WHERE id = ?').get(account_id);
      if (acc) resolvedAccountName = acc.name;
    }

    const stmt = db.prepare(`
      INSERT INTO contacts (
        account_id, account_name, first_name, last_name, email, phone, mobile,
        title, department, lead_source, mailing_street, mailing_city, mailing_state,
        mailing_zip, mailing_country, date_of_birth, special_day_title, special_day_date,
        personal_interests, preferred_communication, current_situation, relationship_health,
        what_they_told_us, next_follow_up_date, description, owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      account_id || null,
      resolvedAccountName || '',
      first_name,
      last_name,
      email || '',
      phone || '',
      mobile || '',
      title || '',
      department || '',
      lead_source || 'Direct',
      mailing_street || '',
      mailing_city || '',
      mailing_state || '',
      mailing_zip || '',
      mailing_country || '',
      date_of_birth || null,
      special_day_title || null,
      special_day_date || null,
      personal_interests || '',
      preferred_communication || 'WhatsApp',
      current_situation || '',
      relationship_health || 'Strong & Warm',
      what_they_told_us || '',
      next_follow_up_date || null,
      description || '',
      owner_name || 'Alex Mercer'
    );

    const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const fields = [
      'account_id', 'account_name', 'first_name', 'last_name', 'email', 'phone', 'mobile',
      'title', 'department', 'lead_source', 'mailing_street', 'mailing_city', 'mailing_state',
      'mailing_zip', 'mailing_country', 'date_of_birth', 'special_day_title', 'special_day_date',
      'personal_interests', 'preferred_communication', 'current_situation', 'relationship_health',
      'what_they_told_us', 'next_follow_up_date', 'description', 'owner_name'
    ];
    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DEALS / PIPELINE CRUD & KANBAN DRAG-AND-DROP
// ----------------------------------------------------
app.get('/api/deals', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.deals === 'none') {
      return res.json([]);
    }

    const { stage, q, owner } = req.query;
    let query = 'SELECT * FROM deals WHERE 1=1';
    const params = [];

    if (!isAdmin && perms.deals === 'assigned') {
      query += ' AND (owner_id = ? OR contact_id IN (SELECT contact_id FROM contact_access WHERE user_id = ?))';
      params.push(userId, userId);
    }

    if (stage && stage !== 'All') {
      query += ' AND stage = ?';
      params.push(stage);
    }
    if (owner && owner !== 'All') {
      query += ' AND owner_name = ?';
      params.push(owner);
    }
    if (q) {
      query += ' AND (name LIKE ? OR account_name LIKE ? OR contact_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY amount DESC';
    const deals = db.prepare(query).all(...params);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deals/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.deals === 'none') {
      return res.status(403).json({ error: 'Access denied: Deals module is restricted.' });
    }

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    if (!isAdmin && perms.deals === 'assigned') {
      const isOwner = deal.owner_id === userId;
      const hasContactGrant = deal.contact_id ? db.prepare('SELECT 1 FROM contact_access WHERE contact_id = ? AND user_id = ?').get(deal.contact_id, userId) : null;
      if (!isOwner && !hasContactGrant) {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view this deal.' });
      }
    }

    const quotes = db.prepare('SELECT * FROM quotes WHERE deal_id = ? ORDER BY id DESC').all(req.params.id);
    const activities = db.prepare("SELECT * FROM activities WHERE related_to_type = 'deal' AND related_to_id = ? ORDER BY due_date DESC").all(req.params.id);
    const notes = db.prepare("SELECT * FROM notes WHERE related_to_type = 'deal' AND related_to_id = ? ORDER BY created_at DESC").all(req.params.id);

    res.json({ ...deal, quotes, activities, notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deals', authMiddleware, (req, res) => {
  try {
    const {
      name, account_id, account_name, contact_id, contact_name,
      amount, stage, probability, closing_date, type, lead_source,
      next_step, description, owner_name
    } = req.body;

    const currentStage = stage || 'Qualification';
    const currentProb = probability !== undefined ? Number(probability) : (STAGE_PROBABILITIES[currentStage] || 10);
    const expectedRevenue = Math.round((Number(amount) || 0) * (currentProb / 100));

    let resolvedAccountName = account_name;
    if (account_id && !resolvedAccountName) {
      const acc = db.prepare('SELECT name FROM accounts WHERE id = ?').get(account_id);
      if (acc) resolvedAccountName = acc.name;
    }

    let resolvedContactName = contact_name;
    if (contact_id && !resolvedContactName) {
      const con = db.prepare('SELECT first_name, last_name FROM contacts WHERE id = ?').get(contact_id);
      if (con) resolvedContactName = `${con.first_name} ${con.last_name}`;
    }

    const stmt = db.prepare(`
      INSERT INTO deals (
        name, account_id, account_name, contact_id, contact_name,
        amount, stage, probability, closing_date, type, lead_source,
        next_step, description, expected_revenue, owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      account_id || null,
      resolvedAccountName || '',
      contact_id || null,
      resolvedContactName || '',
      Number(amount) || 0,
      currentStage,
      currentProb,
      closing_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      type || 'New Business',
      lead_source || 'Web Form',
      next_step || '',
      description || '',
      expectedRevenue,
      owner_name || (req.user ? req.user.name : 'Alex Mercer')
    );

    const created = db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick stage change for Drag-and-Drop Pipeline Kanban
app.put('/api/deals/:id/stage', authMiddleware, (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ error: 'Stage is required' });

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const oldStage = deal.stage;
    const probability = STAGE_PROBABILITIES[stage] !== undefined ? STAGE_PROBABILITIES[stage] : deal.probability;
    const expectedRevenue = Math.round(deal.amount * (probability / 100));

    db.prepare(`
      UPDATE deals
      SET stage = ?,
          probability = ?,
          expected_revenue = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(stage, probability, expectedRevenue, req.params.id);

    // Record activity note on stage progression
    db.prepare(`
      INSERT INTO notes (related_to_type, related_to_id, content, created_by_name)
      VALUES ('deal', ?, ?, ?)
    `).run(
      req.params.id,
      `Pipeline stage updated from "${oldStage}" to "${stage}" (${probability}% win probability).`,
      deal.owner_name
    );

    // Check deal won workflows
    if (stage === 'Closed Won') {
      const workflows = db.prepare("SELECT * FROM workflows WHERE trigger_event = 'deal_won' AND is_active = 1").all();
      workflows.forEach(wf => {
        db.prepare("UPDATE workflows SET execution_count = execution_count + 1, last_triggered_at = datetime('now') WHERE id = ?").run(wf.id);
      });

      sendProactiveAlert(
        deal.user_id || req.user.id,
        'DEAL WON',
        `Deal: ${deal.name}\nAccount: ${deal.account_name || 'Direct / General'}\nAmount: $${Number(deal.amount || 0).toLocaleString()}\nOwner: ${deal.owner_name}`
      ).catch(() => {});
    }

    const updated = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/deals/:id', authMiddleware, (req, res) => {
  try {
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const {
      name, account_id, account_name, contact_id, contact_name,
      amount, stage, probability, closing_date, type, lead_source,
      next_step, description, owner_name
    } = req.body;

    const newStage = stage !== undefined ? stage : deal.stage;
    const newProb = probability !== undefined ? Number(probability) : (STAGE_PROBABILITIES[newStage] ?? deal.probability);
    const newAmount = amount !== undefined ? Number(amount) : deal.amount;
    const expectedRevenue = Math.round(newAmount * (newProb / 100));

    db.prepare(`
      UPDATE deals
      SET name = ?,
          account_id = ?,
          account_name = ?,
          contact_id = ?,
          contact_name = ?,
          amount = ?,
          stage = ?,
          probability = ?,
          closing_date = ?,
          type = ?,
          lead_source = ?,
          next_step = ?,
          description = ?,
          expected_revenue = ?,
          owner_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name !== undefined ? name : deal.name,
      account_id !== undefined ? account_id : deal.account_id,
      account_name !== undefined ? account_name : deal.account_name,
      contact_id !== undefined ? contact_id : deal.contact_id,
      contact_name !== undefined ? contact_name : deal.contact_name,
      newAmount,
      newStage,
      newProb,
      closing_date !== undefined ? closing_date : deal.closing_date,
      type !== undefined ? type : deal.type,
      lead_source !== undefined ? lead_source : deal.lead_source,
      next_step !== undefined ? next_step : deal.next_step,
      description !== undefined ? description : deal.description,
      expectedRevenue,
      owner_name !== undefined ? owner_name : deal.owner_name,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/deals/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Deal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ACTIVITIES (Tasks, Calls, Meetings)
// ----------------------------------------------------
app.get('/api/activities', (req, res) => {
  try {
    const { type, status, is_closed, related_to_type, related_to_id, q } = req.query;
    let query = 'SELECT * FROM activities WHERE 1=1';
    const params = [];

    if (type && type !== 'All') {
      query += ' AND type = ?';
      params.push(type);
    }
    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (is_closed !== undefined) {
      query += ' AND is_closed = ?';
      params.push(Number(is_closed));
    }
    if (related_to_type && related_to_id) {
      query += ' AND related_to_type = ? AND related_to_id = ?';
      params.push(related_to_type, related_to_id);
    }
    if (q) {
      query += ' AND (title LIKE ? OR description LIKE ? OR related_to_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY due_date ASC, id DESC';
    const activities = db.prepare(query).all(...params);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', (req, res) => {
  try {
    const {
      type, title, priority, status, due_date, due_time, duration_minutes,
      related_to_type, related_to_id, related_to_name, call_type, call_result,
      meeting_location, description, owner_name
    } = req.body;

    const isClosed = status === 'Completed' ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO activities (
        type, title, priority, status, due_date, due_time, duration_minutes,
        related_to_type, related_to_id, related_to_name, call_type, call_result,
        meeting_location, description, owner_name, is_closed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      type || 'task',
      title,
      priority || 'Normal',
      status || 'Not Started',
      due_date || new Date().toISOString().split('T')[0],
      due_time || '10:00',
      Number(duration_minutes) || 15,
      related_to_type || null,
      related_to_id || null,
      related_to_name || '',
      call_type || 'Outbound',
      call_result || null,
      meeting_location || null,
      description || '',
      owner_name || 'Alex Mercer',
      isClosed
    );

    const created = db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/activities/:id', (req, res) => {
  try {
    const fields = [
      'type', 'title', 'priority', 'status', 'due_date', 'due_time', 'duration_minutes',
      'related_to_type', 'related_to_id', 'related_to_name', 'call_type', 'call_result',
      'meeting_location', 'description', 'owner_name', 'is_closed'
    ];
    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (req.body.status !== undefined) {
      updates.push('is_closed = ?');
      values.push(req.body.status === 'Completed' ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick toggle complete
app.put('/api/activities/:id/toggle-status', (req, res) => {
  try {
    const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    if (!act) return res.status(404).json({ error: 'Activity not found' });

    const newIsClosed = act.is_closed ? 0 : 1;
    const newStatus = newIsClosed ? 'Completed' : 'Not Started';

    db.prepare("UPDATE activities SET is_closed = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(newIsClosed, newStatus, req.params.id);
    const updated = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activities/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PRODUCTS CATALOG
// ----------------------------------------------------
app.get('/api/products', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);

    if (!isAdmin && perms.products === 'none') {
      return res.json([]);
    }

    const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);

    if (!isAdmin && perms.products !== 'manage') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to add products to the catalog.' });
    }

    const { product_code, name, category, unit_price, qty_in_stock, description } = req.body;
    const code = product_code || `PRD-${Date.now().toString().slice(-6)}`;
    const stmt = db.prepare(`
      INSERT INTO products (product_code, name, category, unit_price, qty_in_stock, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(code, name, category || 'Software', Number(unit_price) || 0, Number(qty_in_stock) || 100, description || '');
    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);

    if (!isAdmin && perms.products !== 'manage') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to modify products.' });
    }

    const { product_code, name, category, unit_price, qty_in_stock, is_active, description } = req.body;
    db.prepare(`
      UPDATE products
      SET product_code = COALESCE(?, product_code),
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          unit_price = COALESCE(?, unit_price),
          qty_in_stock = COALESCE(?, qty_in_stock),
          is_active = COALESCE(?, is_active),
          description = COALESCE(?, description),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(product_code, name, category, unit_price, qty_in_stock, is_active, description, req.params.id);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);

    if (!isAdmin && perms.products !== 'manage') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to delete products.' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// QUOTES, DELIVERY ORDERS & INVOICES
// ----------------------------------------------------
app.get('/api/quotes', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.quotes === 'none') {
      return res.json([]);
    }

    const { doc_type, search } = req.query;
    let query = `
      SELECT q.*,
             (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count
      FROM quotes q
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin && perms.quotes === 'assigned') {
      query += ' AND q.owner_id = ?';
      params.push(userId);
    }

    if (doc_type && doc_type !== 'all') {
      query += ' AND q.doc_type = ?';
      params.push(doc_type);
    }
    if (search) {
      query += ' AND (q.quote_number LIKE ? OR q.subject LIKE ? OR q.account_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY q.id DESC';
    const quotes = db.prepare(query).all(...params);
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quotes/:id', (req, res) => {
  try {
    const isAdmin = isCompanyAdmin(req.user);
    const perms = req.userPermissions || parseUserPermissions(req.user);
    const userId = req.userId || 1;

    if (!isAdmin && perms.quotes === 'none') {
      return res.status(403).json({ error: 'Access denied: Quotes & Invoices module is restricted.' });
    }

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Document not found' });

    if (!isAdmin && perms.quotes === 'assigned' && quote.owner_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this document.' });
    }

    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
    res.json({ ...quote, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Export Endpoint for Quotations, Delivery Orders & Invoices
app.get('/api/quotes/:id/pdf', optionalAuthMiddleware, async (req, res) => {
  try {
    const isNum = !isNaN(Number(req.params.id));
    let quote = null;
    if (isNum) {
      quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    }
    if (!quote) {
      quote = db.prepare('SELECT * FROM quotes WHERE quote_number = ?').get(req.params.id);
    }
    if (!quote) return res.status(404).json({ error: 'Document not found' });

    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quote.id);
    const branding = getSettings(req.user?.id || 1);
    const pdfBuffer = await generateDocumentPdfBuffer(quote, items, branding);

    const safeFilename = `${(quote.doc_type || 'Document').replace(/\s+/g, '_')}_${quote.quote_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convert Quotation -> Delivery Order
app.post('/api/quotes/:id/convert-do', authMiddleware, async (req, res) => {
  try {
    const resObj = await executeCrmTool(req.user.id, 'convert_to_delivery_order', {
      quote_id_or_number: req.params.id,
      delivery_date: req.body.delivery_date,
      tracking_number: req.body.tracking_number,
      recipient_address: req.body.recipient_address,
    });
    if (resObj.error) return res.status(400).json({ error: resObj.error });
    const full = db.prepare('SELECT * FROM quotes WHERE id = ?').get(resObj.do_id);
    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(resObj.do_id);
    res.status(201).json({ ...full, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convert Quotation or DO -> Tax Invoice
app.post('/api/quotes/:id/convert-invoice', authMiddleware, async (req, res) => {
  try {
    const resObj = await executeCrmTool(req.user.id, 'convert_to_invoice', {
      doc_id_or_number: req.params.id,
      due_date: req.body.due_date,
    });
    if (resObj.error) return res.status(400).json({ error: resObj.error });
    const full = db.prepare('SELECT * FROM quotes WHERE id = ?').get(resObj.invoice_id);
    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(resObj.invoice_id);
    res.status(201).json({ ...full, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quotes', authMiddleware, (req, res) => {
  try {
    const {
      doc_type = 'Quotation', parent_doc_id, parent_doc_number,
      subject, account_id, account_name, contact_id, contact_name, deal_id, deal_name,
      quote_stage, valid_until, delivery_date, tracking_number, recipient_address,
      customer_po_number, discount_percent, tax_percent, billing_street,
      billing_city, billing_state, billing_zip, billing_country, terms_conditions,
      description, owner_name, items = []
    } = req.body;

    const settings = getSettings(req.user.id);

    // Calculate line items and totals
    let subtotal = 0;
    const computedItems = items.map(item => {
      const price = Number(item.unit_price) || 0;
      const qty = Number(item.quantity) || 1;
      const itemDisc = Number(item.discount_percent) || 0;
      const lineTotal = Math.round(price * qty * (1 - itemDisc / 100) * 100) / 100;
      subtotal += lineTotal;
      return {
        ...item,
        unit_price: price,
        quantity: qty,
        discount_percent: itemDisc,
        line_total: lineTotal
      };
    });

    const discPct = Number(discount_percent) || 0;
    const taxPct = !isNaN(Number(tax_percent)) ? Number(tax_percent) : (Number(settings.invoice_default_tax) || 8.0);
    const totalAfterDisc = subtotal * (1 - discPct / 100);
    const taxAmount = totalAfterDisc * (taxPct / 100);
    const grandTotal = Math.round((totalAfterDisc + taxAmount) * 100) / 100;

    let prefix = settings.quote_prefix || 'QT-';
    if (doc_type === 'Delivery Order') prefix = settings.do_prefix || 'DO-';
    else if (doc_type === 'Invoice') prefix = settings.invoice_prefix || 'INV-';

    const quoteNumber = `${prefix}${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const shareToken = `${req.user.id}_${crypto.randomBytes(12).toString('hex')}`;

    const defaultTerms = doc_type === 'Delivery Order'
      ? settings.do_default_terms
      : (doc_type === 'Invoice' ? settings.invoice_default_terms : settings.quote_default_terms);

    const quoteStmt = db.prepare(`
      INSERT INTO quotes (
        quote_number, doc_type, parent_doc_id, parent_doc_number, subject,
        account_id, account_name, contact_id, contact_name, deal_id, deal_name,
        quote_stage, valid_until, delivery_date, tracking_number, recipient_address,
        customer_po_number, subtotal, discount_percent, tax_percent, grand_total,
        billing_street, billing_city, billing_state, billing_zip, billing_country,
        terms_conditions, description, share_token, owner_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const qResult = quoteStmt.run(
      quoteNumber,
      doc_type,
      parent_doc_id || null,
      parent_doc_number || null,
      subject || `${doc_type} for ${account_name || 'Client'}`,
      account_id || null,
      account_name || '',
      contact_id || null,
      contact_name || '',
      deal_id || null,
      deal_name || '',
      quote_stage || (doc_type === 'Invoice' ? 'Confirmed' : (doc_type === 'Delivery Order' ? 'Delivered' : 'Draft')),
      valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      delivery_date || (doc_type === 'Delivery Order' ? new Date().toISOString().split('T')[0] : null),
      tracking_number || null,
      recipient_address || null,
      customer_po_number || null,
      subtotal,
      discPct,
      taxPct,
      grandTotal,
      billing_street || '',
      billing_city || '',
      billing_state || '',
      billing_zip || '',
      billing_country || '',
      terms_conditions || defaultTerms,
      description || '',
      shareToken,
      owner_name || req.user.name || 'Sales Rep'
    );

    const quoteId = qResult.lastInsertRowid;

    // Insert items
    const itemStmt = db.prepare(`
      INSERT INTO quote_items (quote_id, product_id, product_name, unit_price, quantity, discount_percent, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const itm of computedItems) {
      itemStmt.run(quoteId, itm.product_id || null, itm.product_name || 'Item Specification', itm.unit_price, itm.quantity, itm.discount_percent, itm.line_total);
    }

    const created = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
    const createdItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteId);
    res.status(201).json({ ...created, items: createdItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/quotes/:id/stage', authMiddleware, (req, res) => {
  try {
    const { quote_stage } = req.body;
    db.prepare("UPDATE quotes SET quote_stage = ?, updated_at = datetime('now') WHERE id = ?").run(quote_stage, req.params.id);
    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/quotes/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.id);
    db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PUBLIC CUSTOMER DOCUMENT PORTAL & DIGITAL ACCEPTANCE
// Secure token-based access for clients & partners (Zero-Auth Required)
// ----------------------------------------------------
function resolveTenantQuoteByToken(token) {
  if (!token) return null;
  let tenantId = 1;
  if (token.includes('_')) {
    const parsed = Number(token.split('_')[0]);
    if (!isNaN(parsed) && parsed > 0) tenantId = parsed;
  }
  let tDb = getTenantDb(tenantId);
  let quote = tDb.prepare('SELECT * FROM quotes WHERE share_token = ?').get(token);
  if (!quote) {
    quote = tDb.prepare('SELECT * FROM quotes WHERE quote_number = ?').get(token);
  }
  if (!quote) {
    try {
      const files = fs.readdirSync(TENANTS_DIR).filter(f => f.startsWith('tenant_') && f.endsWith('.db'));
      for (const f of files) {
        const tid = Number(f.replace('tenant_', '').replace('.db', ''));
        if (tid !== tenantId) {
          const candidateDb = getTenantDb(tid);
          const found = candidateDb.prepare('SELECT * FROM quotes WHERE share_token = ? OR quote_number = ?').get(token, token);
          if (found) {
            return { quote: found, tenantDb: candidateDb, tenantId: tid };
          }
        }
      }
    } catch (e) {}
  }
  if (quote) {
    return { quote, tenantDb: tDb, tenantId };
  }
  return null;
}

// 1. Fetch public document details with line items and company branding
app.get('/api/portal/doc/:token', (req, res) => {
  try {
    const resolved = resolveTenantQuoteByToken(req.params.token);
    if (!resolved) {
      return res.status(404).json({ error: 'Document not found or link has expired' });
    }
    const { quote, tenantDb: tDb, tenantId } = resolved;
    const items = tDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quote.id);
    const companySettings = getSettings(tenantId);

    res.json({
      doc: quote,
      items,
      company: {
        company_name: companySettings.company_name || 'Abadi Guru Enterprise Inc.',
        company_email: companySettings.company_email || 'billing@abadiguru.com',
        company_phone: companySettings.company_phone || '+1 (555) 019-2831',
        company_address: companySettings.company_address || '100 Enterprise Way, Suite 400',
        company_website: companySettings.company_website || 'https://abadiguru.com',
        company_logo_url: companySettings.company_logo_url || '',
        currency_symbol: companySettings.currency_symbol || '$',
        bank_name: companySettings.bank_name || '',
        bank_account_no: companySettings.bank_account_no || '',
        bank_account_holder: companySettings.bank_account_holder || '',
        payment_terms: quote.terms_conditions || companySettings.invoice_default_terms || '',
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 1-Click Customer Digital Acceptance (E-Signature)
app.post('/api/portal/doc/:token/accept', (req, res) => {
  try {
    const resolved = resolveTenantQuoteByToken(req.params.token);
    if (!resolved) {
      return res.status(404).json({ error: 'Document not found or link has expired' });
    }
    const { quote, tenantDb: tDb } = resolved;
    const signer = (req.body.signer_name || 'Authorized Client').trim();
    const now = new Date().toISOString();

    tDb.prepare(`
      UPDATE quotes
      SET quote_stage = 'Confirmed',
          accepted_at = ?,
          accepted_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(now, signer, quote.id);

    // If quotation is tied to a deal, automatically close-win the deal!
    if (quote.deal_id) {
      tDb.prepare(`
        UPDATE deals
        SET stage = 'Closed Won',
            probability = 100,
            expected_revenue = amount,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(quote.deal_id);
    }

    // Log CRM note for audit trail
    try {
      tDb.prepare(`
        INSERT INTO notes (related_to_type, related_to_id, content, note_category, created_by_name)
        VALUES ('account', ?, ?, 'client_said', 'Customer Portal')
      `).run(
        quote.account_id || 1,
        `Digital Acceptance: ${quote.doc_type || 'Quotation'} #${quote.quote_number} was officially approved and digitally accepted online by "${signer}" on ${new Date().toLocaleString()}.`
      );
    } catch (e) {}

    // Alert sales reps via Telegram bot if configured
    sendProactiveAlert(
      companySettings.user_id || 1,
      'DOCUMENT ACCEPTED ONLINE',
      `[DOCUMENT ACCEPTED ONLINE]\n\nDoc: ${quote.quote_number} (${quote.doc_type || 'Quotation'})\nClient: ${quote.account_name || 'Valued Client'}\nTotal: $${Number(quote.grand_total || 0).toLocaleString()}\nSigned By: ${signer}\nTimestamp: ${new Date().toLocaleString()}`
    ).catch(() => {});

    const updated = tDb.prepare('SELECT * FROM quotes WHERE id = ?').get(quote.id);
    res.json({ success: true, message: 'Document accepted successfully', doc: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Download Branded PDF from public portal
app.get('/api/portal/doc/:token/pdf', async (req, res) => {
  try {
    const resolved = resolveTenantQuoteByToken(req.params.token);
    if (!resolved) {
      return res.status(404).json({ error: 'Document not found or link has expired' });
    }
    const { quote, tenantDb: tDb, tenantId } = resolved;
    const items = tDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quote.id);
    const branding = getSettings(tenantId);
    const pdfBuffer = await generateDocumentPdfBuffer(quote, items, branding);

    const safeFilename = `${(quote.doc_type || 'Document').replace(/\s+/g, '_')}_${quote.quote_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// NOTES
// ----------------------------------------------------
app.get('/api/notes', (req, res) => {
  try {
    const { related_to_type, related_to_id } = req.query;
    const notes = db.prepare('SELECT * FROM notes WHERE related_to_type = ? AND related_to_id = ? ORDER BY created_at DESC').all(related_to_type, related_to_id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', (req, res) => {
  try {
    const { related_to_type, related_to_id, content, note_category, created_by_name } = req.body;
    const stmt = db.prepare(`
      INSERT INTO notes (related_to_type, related_to_id, content, note_category, created_by_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(related_to_type, related_to_id, content, note_category || 'general', created_by_name || 'Alex Mercer');
    const created = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// WORKFLOWS / AUTOMATION ENGINE
// ----------------------------------------------------
app.get('/api/workflows', (req, res) => {
  try {
    const workflows = db.prepare('SELECT * FROM workflows ORDER BY id ASC').all();
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflows', (req, res) => {
  try {
    const { name, trigger_event, description } = req.body;
    const stmt = db.prepare(`
      INSERT INTO workflows (name, trigger_event, description, is_active)
      VALUES (?, ?, ?, 1)
    `);
    const result = stmt.run(name, trigger_event, description || '');
    const created = db.prepare('SELECT * FROM workflows WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workflows/:id/toggle', (req, res) => {
  try {
    const wf = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    const newStatus = wf.is_active ? 0 : 1;
    db.prepare('UPDATE workflows SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
    const updated = db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CUSTOM FIELDS BUILDER
// ----------------------------------------------------
app.get('/api/custom-fields', (req, res) => {
  try {
    const { entity } = req.query;
    let query = 'SELECT * FROM custom_fields';
    const params = [];
    if (entity) {
      query += ' WHERE entity_type = ?';
      params.push(entity);
    }
    const fields = db.prepare(query).all(...params);
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-fields', (req, res) => {
  try {
    const { entity_type, field_label, field_type, options } = req.body;
    const fieldKey = field_label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const optionsJson = options ? JSON.stringify(options) : null;

    const stmt = db.prepare(`
      INSERT INTO custom_fields (entity_type, field_key, field_label, field_type, options_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(entity_type, fieldKey, field_label, field_type, optionsJson);
    const created = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/custom-fields/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM custom_fields WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CSV EXPORT & IMPORT
// ----------------------------------------------------
app.get('/api/export/:entity', optionalAuthMiddleware, (req, res) => {
  try {
    const entity = req.params.entity;
    let rows = [];
    if (entity === 'leads') {
      rows = db.prepare('SELECT id, first_name, last_name, company, title, email, phone, lead_source, lead_status, rating, annual_revenue, city, state, country, date_of_birth, special_day_title, special_day_date, preferred_communication, relationship_health, current_situation, what_they_told_us FROM leads').all();
    } else if (entity === 'contacts') {
      rows = db.prepare('SELECT id, first_name, last_name, account_name, email, phone, title, department, lead_source, mailing_city, mailing_state, date_of_birth, special_day_title, special_day_date, preferred_communication, relationship_health, current_situation, what_they_told_us FROM contacts').all();
    } else if (entity === 'accounts') {
      rows = db.prepare('SELECT id, name, industry, phone, website, annual_revenue, employees, billing_city, billing_state, billing_country FROM accounts').all();
    } else if (entity === 'deals') {
      rows = db.prepare('SELECT id, name, account_name, contact_name, amount, stage, probability, expected_revenue, closing_date, type, owner_name FROM deals').all();
    } else if (entity === 'quotes' || entity === 'documents') {
      rows = db.prepare('SELECT id, quote_number, doc_type, subject, account_name, contact_name, deal_name, quote_stage, valid_until, delivery_date, subtotal, discount_percent, tax_percent, grand_total, accepted_at, accepted_by, owner_name, created_at FROM quotes').all();
    } else {
      return res.status(400).json({ error: 'Unsupported entity for export' });
    }

    if (rows.length === 0) {
      return res.send('');
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(',')];

    for (const row of rows) {
      const line = headers.map(h => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
      csvLines.push(line);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}_export.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/leads', authMiddleware, (req, res) => {
  try {
    const { leads = [] } = req.body;
    let inserted = 0;
    const stmt = db.prepare(`
      INSERT INTO leads (first_name, last_name, company, email, phone, lead_source, lead_status, annual_revenue)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lead of leads) {
      if (lead.first_name || lead.last_name || lead.company) {
        stmt.run(
          lead.first_name || 'Imported',
          lead.last_name || 'Lead',
          lead.company || 'Company',
          lead.email || '',
          lead.phone || '',
          lead.lead_source || 'Imported CSV',
          lead.lead_status || 'New',
          Number(lead.annual_revenue) || 0
        );
        inserted++;
      }
    }

    res.json({ success: true, count: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SYSTEM RESET TO DEMO DATA
// ----------------------------------------------------
app.post('/api/system/reset-demo', authMiddleware, (req, res) => {
  try {
    initTenantSeedData(req.tenantDb, req.user.id, { name: req.user.name, company: req.user.company });
    res.json({ success: true, message: 'CRM reset to fresh demo dataset!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STATIC CLIENT SERVING (Production & Standalone run)
// ----------------------------------------------------
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`ABADI GURU CRM Server running at http://localhost:${PORT}`);
});
