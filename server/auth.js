import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { masterDb, getTenantDb, parseUserPermissions } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'abadi-guru-crm-production-secret-key-2026';

export const SUBSCRIPTION_PLANS = [
  {
    id: 'Starter',
    name: 'Starter Plan',
    priceMonthly: 29,
    priceAnnual: 290,
    badge: 'Basic Tier',
    description: 'Perfect for solo founders and growing sales reps.',
    features: [
      'Up to 1,000 Active Leads',
      '3 Sales Pipelines & Kanban Boards',
      'Formal Quote & Invoice Generation',
      'Activities & Task Reminders',
      'Standard Email Templates',
      'Community Support'
    ],
    popular: false
  },
  {
    id: 'Professional',
    name: 'Professional Plan',
    priceMonthly: 79,
    priceAnnual: 790,
    badge: 'Most Popular',
    description: 'For high-velocity sales teams needing AI and mobile automation.',
    features: [
      'Unlimited Leads, Deals & Contacts',
      'Unlimited Pipelines & Kanban Stages',
      'ABADI GURU Intelligence Predictive Lead Scoring (0-100)',
      'Telegram Bot Mobile Control 24/7',
      'Automated PDF Invoice Export & Delivery',
      'Automated Multi-Stage Workflow Rules',
      'Priority Email & Live Chat Support'
    ],
    popular: true
  },
  {
    id: 'Enterprise',
    name: 'Enterprise Plan',
    priceMonthly: 199,
    priceAnnual: 1990,
    badge: 'Executive Suite',
    description: 'Full corporate power with custom LLMs and SLA retainers.',
    features: [
      'Everything in Professional Plan',
      'ABADI GURU Intelligence Executive Neural Engine',
      'Unlimited Team Seats & Role Permissions',
      'Advanced Funnel & Cohort BI Analytics',
      'Custom Field Builder on All Modules',
      'Dedicated Account Manager & 99.9% SLA',
      'Enterprise Data Backup & Migration Pack'
    ],
    popular: false
  }
];

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  safe.parsedPermissions = parseUserPermissions(user);
  return safe;
}

/**
 * Authentication Middleware: Validates Bearer JWT Token
 * Securely binds req.user, req.userPermissions, and req.tenantDb to the authenticating user.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
  }

  const user = masterDb.prepare(`
    SELECT id, name, email, role, avatar, company, subscription_tier,
           subscription_status, trial_ends_at, subscription_expires_at,
           is_superadmin, tenant_id, phone, quota_target, status, permissions,
           telegram_chat_id, telegram_link_code, created_at
    FROM users
    WHERE id = ?
  `).get(decoded.id);

  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  // Auto-check trial expiration
  if (user.subscription_status === 'trial' && user.trial_ends_at) {
    const isExpired = new Date(user.trial_ends_at).getTime() < Date.now();
    if (isExpired) {
      user.subscription_status = 'expired';
      masterDb.prepare("UPDATE users SET subscription_status = 'expired', updated_at = datetime('now') WHERE id = ?").run(user.id);
    }
  }

  const tenantId = user.tenant_id || user.id;
  user.parsedPermissions = parseUserPermissions(user);
  req.user = user;
  req.userPermissions = user.parsedPermissions;
  req.userId = user.id;
  req.tenantId = tenantId;
  req.tenantDb = getTenantDb(tenantId);
  next();
}

/**
 * Optional Auth Middleware: Attaches req.user and req.tenantDb if token is present
 */
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = masterDb.prepare(`
        SELECT id, name, email, role, avatar, company, subscription_tier,
               subscription_status, trial_ends_at, subscription_expires_at,
               is_superadmin, tenant_id, phone, quota_target, status, permissions,
               telegram_chat_id, telegram_link_code, created_at
        FROM users
        WHERE id = ?
      `).get(decoded.id);
      if (user) {
        const tenantId = user.tenant_id || user.id;
        user.parsedPermissions = parseUserPermissions(user);
        req.user = user;
        req.userPermissions = user.parsedPermissions;
        req.userId = user.id;
        req.tenantId = tenantId;
        req.tenantDb = getTenantDb(tenantId);
      }
    }
  }

  if (!req.tenantDb) {
    // Default fallback to public demo tenant 1
    req.tenantDb = getTenantDb(1);
  }
  next();
}
