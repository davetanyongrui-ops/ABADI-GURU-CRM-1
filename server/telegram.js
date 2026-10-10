import bcrypt from 'bcryptjs';
import { getTenantDb, masterDb, isCompanyAdmin, parseUserPermissions, generateTelegramLinkCode } from './db.js';
import { getSettings, saveSettings, chatWithAI, executeCrmTool } from './ai.js';
import { generateDocumentPdfBuffer, generateInvoicePdfBuffer } from './pdf.js';
import { sendOutboundEmail, sendDocumentEmail } from './mailer.js';

// Multi-tenant poller tracking Map<key, { abortController, lastUpdateId, token, userId, isAgentBot }>
const activePollers = new Map();

export function getBotStatus(userId = 1) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  const user = masterDb.prepare('SELECT id, telegram_link_code, telegram_chat_id, role FROM users WHERE id = ?').get(uid) || {};

  return {
    isRunning: activePollers.has(`admin_${uid}`) || activePollers.has(`agent_${uid}`) || activePollers.has(uid),
    hasToken: Boolean(settings.telegram_token && settings.telegram_token.length > 10),
    hasAgentToken: Boolean(settings.telegram_agent_token && settings.telegram_agent_token.length > 10),
    chatId: user.telegram_chat_id || settings.telegram_chat_id || null,
    linkCode: user.telegram_link_code || null,
    role: user.role || 'Admin',
  };
}

// Telegram API Sender
export async function sendTelegramMessage(userId = 1, chatId, text, extra = {}) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  const token = extra.token || settings.telegram_token || settings.telegram_agent_token;
  if (!token) return { ok: false, error: 'No Telegram token configured for this account' };

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        ...extra,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error(`[Telegram #${uid}] Failed to send message:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Telegram API Document Sender (PDF / Files)
export async function sendTelegramDocument(userId = 1, chatId, buffer, filename, caption = '', extra = {}) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  const token = extra.token || settings.telegram_token || settings.telegram_agent_token;
  if (!token) return { ok: false, error: 'No Telegram token configured for this account' };

  try {
    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');

    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('document', blob, filename || 'invoice.pdf');

    if (extra.reply_markup) {
      formData.append('reply_markup', JSON.stringify(extra.reply_markup));
    }

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  } catch (err) {
    console.error(`[Telegram #${uid}] Failed to send document:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Proactive CRM Notification (Zero emoji, clean typographic alert)
export async function sendProactiveAlert(userId = 1, title, message) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  if (!settings.telegram_token || !settings.telegram_chat_id) return;

  const text = `*[ABADI GURU CRM ALERT]*\n*${title}*\n\n${message}`;
  await sendTelegramMessage(uid, settings.telegram_chat_id, text);
}

// In-memory multi-turn conversational session cache keyed by `userId:chatId`
const chatSessions = new Map();

function getChatSession(userId, chatId) {
  const key = `${userId}:${chatId}`;
  if (!chatSessions.has(key)) {
    chatSessions.set(key, []);
  }
  return chatSessions.get(key);
}

function addToChatSession(userId, chatId, role, content) {
  const session = getChatSession(userId, chatId);
  session.push({ role, content });
  if (session.length > 8) {
    session.splice(0, session.length - 8);
  }
}

/**
 * Resolves the authenticated user behind a Telegram chat_id.
 * If not yet linked, checks for connection codes or login commands.
 */
function resolveTelegramUser(chatId, senderId, text = '', fallbackTenantId = 1) {
  const sChatId = String(chatId);
  const sSenderId = String(senderId);

  // 1. Check if already linked in masterDb
  let user = masterDb.prepare(`
    SELECT * FROM users
    WHERE telegram_chat_id = ? OR telegram_chat_id = ?
  `).get(sChatId, sSenderId);

  if (user) {
    return { user, justLinked: false };
  }

  // 2. Check for Link Code via /link <CODE> or /start <CODE>
  const linkCodeMatch = text.match(/^\/(?:start|link)\s+([A-Za-z0-9\-_]{6,16})/i);
  if (linkCodeMatch) {
    const rawCode = linkCodeMatch[1].trim().toUpperCase();
    const candidate = masterDb.prepare('SELECT * FROM users WHERE UPPER(telegram_link_code) = ?').get(rawCode);
    if (candidate) {
      masterDb.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(sChatId, candidate.id);
      candidate.telegram_chat_id = sChatId;
      return { user: candidate, justLinked: true };
    }
  }

  // 3. Check for Direct Login via /login <email> <password>
  const loginMatch = text.match(/^\/login\s+(\S+)\s+(.+)$/i);
  if (loginMatch) {
    const email = loginMatch[1].trim().toLowerCase();
    const pass = loginMatch[2].trim();
    const candidate = masterDb.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (candidate && candidate.password_hash && bcrypt.compareSync(pass, candidate.password_hash)) {
      masterDb.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(sChatId, candidate.id);
      candidate.telegram_chat_id = sChatId;
      return { user: candidate, justLinked: true };
    }
  }

  // 4. Fallback for Workspace Admin if chat_id matches system settings
  const settings = getSettings(fallbackTenantId);
  if (settings.telegram_chat_id && String(settings.telegram_chat_id) === sChatId) {
    const adminUser = masterDb.prepare('SELECT * FROM users WHERE id = ?').get(fallbackTenantId);
    if (adminUser) {
      masterDb.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(sChatId, adminUser.id);
      adminUser.telegram_chat_id = sChatId;
      return { user: adminUser, justLinked: false };
    }
  }

  return { user: null, justLinked: false };
}

// Main Telegram Message Dispatcher with Strict Role Separation
export async function handleTelegramMessage(tenantOwnerId, message, botToken = null) {
  const uid = Number(tenantOwnerId) || 1;
  const chatId = message.chat?.id;
  const senderId = message.from?.id || chatId;
  const fromName = `${message.from?.first_name || ''} ${message.from?.last_name || ''}`.trim() || 'User';
  const text = (message.text || '').trim();

  if (!chatId || !text) return;

  // Resolve user identity and role
  const { user: linkedUser, justLinked } = resolveTelegramUser(chatId, senderId, text, uid);

  let botReply = '';
  let actionTaken = 'chat';
  let pendingDocument = null;
  const extraSendOpts = botToken ? { token: botToken } : {};

  // Case A: Unauthenticated User
  if (!linkedUser) {
    if (text.startsWith('/login')) {
      botReply = `[AUTHENTICATION FAILED]\nInvalid email or password. Please verify your login credentials in ABADI GURU CRM.`;
    } else {
      botReply = `[ABADI GURU CRM - AUTHENTICATION REQUIRED]
Welcome to the ABADI GURU CRM Mobile Gateway.

To access your CRM workspace, please link your account:
1. Connect via Code:
   /link <YOUR_CODE>
   (e.g., /link ADM-102938 or /link AGT-592014)

2. Or Sign In directly:
   /login <email> <password>

You can find your connection code in ABADI GURU CRM:
- Workspace Admins: Settings > Telegram Integration
- Sales Agents: Ask your Admin or check your Profile Link Code.`;
    }
    return sendTelegramMessage(uid, chatId, botReply, { ...extraSendOpts });
  }

  // User is authenticated! Determine permissions and tenant context
  const activeTenantId = linkedUser.tenant_id || linkedUser.id;
  const tenantDb = getTenantDb(activeTenantId);
  const isAdmin = isCompanyAdmin(linkedUser) || (linkedUser.role || '').toLowerCase().includes('admin') || (linkedUser.role || '').toLowerCase().includes('owner');
  const perms = parseUserPermissions(linkedUser);
  const settings = getSettings(activeTenantId);
  const curr = settings.currency_symbol || '$';

  // Role-Specific Keyboard Menus (Zero emojis)
  const adminKeyboard = {
    reply_markup: {
      keyboard: [
        [{ text: 'Pipeline Summary' }, { text: 'Team Leaderboard' }],
        [{ text: 'All Leads' }, { text: 'All Deals' }],
        [{ text: 'New Quotation' }, { text: 'Generate Invoice' }],
        [{ text: 'Ask AI Copilot' }, { text: 'Help & Commands' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  };

  const agentKeyboard = {
    reply_markup: {
      keyboard: [
        [{ text: 'My Performance' }, { text: 'My Quota Progress' }],
        [{ text: 'My Leads' }, { text: 'My Deals' }],
        [{ text: 'New Quotation' }, { text: 'My Contacts' }],
        [{ text: 'Ask AI Copilot' }, { text: 'Help & Commands' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  };

  const activeKeyboard = isAdmin ? adminKeyboard : agentKeyboard;

  // Unlink command: /unlink or /logout
  if (text.startsWith('/unlink') || text.startsWith('/logout')) {
    masterDb.prepare('UPDATE users SET telegram_chat_id = NULL WHERE id = ?').run(linkedUser.id);
    botReply = `[ACCOUNT UNLINKED]\nYour Telegram account has been disconnected from ABADI GURU CRM (${linkedUser.email}).\nSend /link <CODE> or /login anytime to reconnect.`;
    return sendTelegramMessage(uid, chatId, botReply, {
      ...extraSendOpts,
      reply_markup: { remove_keyboard: true }
    });
  }

  // Handle justLinked greeting
  if (justLinked) {
    if (isAdmin) {
      botReply = `[ABADI GURU CRM - WORKSPACE ADMINISTRATOR AUTHENTICATED]
Welcome, ${linkedUser.name}!
Company: ${linkedUser.company || 'Enterprise'}
Privilege: Workspace Owner & Root Administrator

You have complete mobile executive access:
- Company-wide revenue, forecasting & win rates
- Sales rep leaderboard & quota attainment tracking
- Access to all pipeline deals, leads, quotes & tax invoices
- Full document generation and email dispatch

Type /summary for your executive briefing or /help for all commands.`;
    } else {
      botReply = `[ABADI GURU CRM - SALES AGENT FIELD PORTAL AUTHENTICATED]
Welcome, ${linkedUser.name}!
Role: ${linkedUser.role || 'Sales Representative'}
Company: ${linkedUser.company || 'Enterprise'}
Personal Quota Target: ${curr}${(linkedUser.quota_target || 50000).toLocaleString()}

Your mobile portal is strictly configured for your personal sales portfolio:
- Track your assigned leads and deals
- Monitor your personal monthly quota attainment
- Access customer contacts granted by your administrator
- Rapidly create quotes and log new opportunities on the go

Type /summary to check your quota attainment or /help for commands.`;
    }
    return sendTelegramMessage(uid, chatId, botReply, { ...extraSendOpts, ...activeKeyboard });
  }

  // 1. /start command
  if (text.startsWith('/start')) {
    if (isAdmin) {
      botReply = `[ABADI GURU CRM - EXECUTIVE MOBILE CONTROL]
Logged In: ${linkedUser.name} [Administrator]
Company: ${linkedUser.company}

Quick Command Directory:
• /summary — Executive revenue, forecast & win rate briefing
• /team or /reps — Sales rep performance & quota leaderboard
• /leads — View all active company prospects
• /deals — View all active pipeline opportunities
• /quote <Client> | <Amount> | <Description> — Generate Quotation & PDF
• /invoice <Client> | <Amount> | <Description> — Generate Tax Invoice & PDF
• /won <DealID> — Move deal to Closed Won
• /add_lead <Name>, <Company>, <Email>, <Phone> — Quick add prospect
• /unlink — Disconnect this Telegram session

You can also send natural messages like:
"Summarize our sales pipeline"
"Create a quote for Acme Corp 15000 for server migration"`;
    } else {
      botReply = `[ABADI GURU CRM - SALES AGENT FIELD PORTAL]
Logged In: ${linkedUser.name} [Sales Representative]
Company: ${linkedUser.company}
Personal Quota: ${curr}${(linkedUser.quota_target || 50000).toLocaleString()}

Quick Command Directory:
• /summary or /quota — Check personal won revenue & quota progress
• /deals — View your assigned deals
• /leads — View your assigned prospects
• /contacts — View your permitted customer contacts
• /add_lead <Name>, <Company>, <Email>, <Phone> — Quick add your prospect
• /add_deal <Title>, <Amount>, <Company> — Quick add your opportunity
• /won <DealID> — Mark your deal as Closed Won
• /quote <Client> | <Amount> | <Description> — Generate quote & receive PDF
• /unlink — Disconnect this Telegram session

You can also ask questions like:
"How close am I to my monthly quota?"
"Show my active deals"`;
    }
    actionTaken = 'start';
  }

  // 2. /help or /commands or "Help & Commands"
  else if (text.startsWith('/help') || text.startsWith('/commands') || text === 'Help & Commands') {
    if (isAdmin) {
      botReply = `[ABADI GURU CRM - ADMINISTRATOR COMMAND DIRECTORY]
==========================================
EXECUTIVE REVENUE & PIPELINE:
• /summary — High-level revenue, pipeline total & forecast
• /team or /reps — Team leaderboard & quota attainment rankings
• /summarize_leads — Deep-dive summary of prospects and follow-ups
• /deals — List active company opportunities
• /leads — List all prospect leads
• /won <DealID> — Mark any deal as Closed Won

COMMERCIAL BILLING & DOCUMENTS:
• /quote <Client> | <Amount> | <Description> — Create Quote & receive PDF
• /convert_do <Quote# or ID> — Convert Quote to Delivery Order
• /convert_invoice <Doc# or ID> — Convert Quote/DO to Tax Invoice
• /invoice <Client> | <Amount> | <Description> — Generate Direct Tax Invoice
• /documents — List recent commercial documents
• /pdf <Doc#> — Download official branded PDF

TEAM & DELEGATION:
• /grant <AgentEmail> <ContactID> — Grant rep access to specific contact
• /tasks — Scheduled action items and activities
• /unlink — Disconnect Telegram account`;
    } else {
      botReply = `[ABADI GURU CRM - SALES AGENT COMMAND DIRECTORY]
==========================================
PERSONAL PERFORMANCE & QUOTA:
• /summary or /quota — Personal won amount, remaining quota & attainment %
• /deals — Active deals in your portfolio
• /leads — Prospects assigned to you
• /contacts — Customer contacts granted to you
• /won <DealID> — Mark your assigned deal as Closed Won

FIELD CREATION:
• /add_lead <Name>, <Company>, <Email>, <Phone> — Add lead (assigned to you)
• /add_deal <Title>, <Amount>, <Company> — Add deal (assigned to you)
• /quote <Client> | <Amount> | <Description> — Generate Quotation & receive PDF
• /pdf <Doc#> — Download quotation PDF
• /unlink — Disconnect Telegram account`;
    }
    actionTaken = 'help';
  }

  // 3. /summary / "Pipeline Summary" / "My Performance"
  else if (text.startsWith('/summary') || text.startsWith('/dashboard') || text === 'Pipeline Summary' || text === 'My Performance') {
    if (isAdmin) {
      // Executive Company Summary
      const s = await executeCrmTool(activeTenantId, 'get_pipeline_summary');
      botReply = `[ABADI GURU CRM - EXECUTIVE REVENUE BRIEFING]
==========================================
• Total Open Pipeline: ${curr}${s.total_pipeline_value.toLocaleString()} (${s.open_deals_count} active deals)
• Weighted Pipeline Forecast: ${curr}${s.weighted_forecast.toLocaleString()}
• Closed Won Revenue: ${curr}${s.won_revenue.toLocaleString()} (${s.won_deals_count} contracts executed)
• Active Leads: ${s.active_leads} prospects (${s.hot_leads_count} Tier-1 Hot)
==========================================
Company performance on target. Reply /team to inspect sales rep leaderboard.`;
      actionTaken = 'admin_summary';
    } else {
      // Sales Agent Personal Performance
      const agentStats = tenantDb.prepare(`
        SELECT COUNT(*) as dealCount,
               COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0) as wonAmount,
               COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN amount ELSE 0 END), 0) as pipelineAmount
        FROM deals
        WHERE owner_id = ? OR owner_name = ? OR owner_name LIKE ?
      `).get(linkedUser.id, linkedUser.name, `%${linkedUser.name}%`) || { dealCount: 0, wonAmount: 0, pipelineAmount: 0 };

      const leadsCount = tenantDb.prepare(`
        SELECT COUNT(*) as count FROM leads
        WHERE (lead_owner_name = ? OR lead_owner_name LIKE ?) AND is_converted = 0
      `).get(linkedUser.name, `%${linkedUser.name}%`)?.count || 0;

      const contactsCount = tenantDb.prepare(`
        SELECT COUNT(*) as count FROM contact_access WHERE user_id = ?
      `).get(linkedUser.id)?.count || 0;

      const quota = Number(linkedUser.quota_target) || 50000;
      const progressPct = quota > 0 ? Math.min(100, Math.round((Number(agentStats.wonAmount) / quota) * 100)) : 0;
      const remainingQuota = Math.max(0, quota - Number(agentStats.wonAmount));

      botReply = `[ABADI GURU CRM - PERSONAL PERFORMANCE]
Representative: ${linkedUser.name} (${linkedUser.role || 'Sales Rep'})
==========================================
• Won Revenue: ${curr}${Number(agentStats.wonAmount).toLocaleString()}
• Monthly Quota Target: ${curr}${quota.toLocaleString()}
• Quota Attainment: ${progressPct}%
• Remaining to Target: ${curr}${remainingQuota.toLocaleString()}
• Active Pipeline: ${curr}${Number(agentStats.pipelineAmount).toLocaleString()} (${agentStats.dealCount} deals)
• Assigned Leads: ${leadsCount} active prospects
• Permitted Contacts: ${contactsCount} customer profiles
==========================================
${progressPct >= 100 ? '[TARGET REACHED: 100% Quota Attained]' : `Target pacing: ${progressPct}% completed.`}`;
      actionTaken = 'agent_summary';
    }
  }

  // 4. /quota or "My Quota Progress"
  else if (text.startsWith('/quota') || text === 'My Quota Progress') {
    const quota = Number(linkedUser.quota_target) || 50000;
    const stats = tenantDb.prepare(`
      SELECT COALESCE(SUM(amount), 0) as wonAmount
      FROM deals
      WHERE stage = 'Closed Won' AND (owner_id = ? OR owner_name = ? OR owner_name LIKE ?)
    `).get(linkedUser.id, linkedUser.name, `%${linkedUser.name}%`) || { wonAmount: 0 };

    const won = Number(stats.wonAmount);
    const pct = quota > 0 ? Math.min(100, Math.round((won / quota) * 100)) : 0;
    const remaining = Math.max(0, quota - won);

    botReply = `[QUOTA ATTAINMENT PACING]
Representative: ${linkedUser.name}
Quota Target: ${curr}${quota.toLocaleString()}
Closed Won: ${curr}${won.toLocaleString()}
Progress: ${pct}%
Remaining Gap: ${curr}${remaining.toLocaleString()}`;
    actionTaken = 'quota_progress';
  }

  // 5. /team or /reps or "Team Leaderboard"
  else if (text.startsWith('/team') || text.startsWith('/reps') || text === 'Team Leaderboard') {
    if (!isAdmin) {
      botReply = `[ACCESS RESTRICTED]\nTeam leaderboards and peer quotas are restricted to Company Administrators. Use /summary to check your personal performance.`;
      actionTaken = 'restricted';
    } else {
      const agents = masterDb.prepare(`
        SELECT id, name, role, quota_target
        FROM users
        WHERE (tenant_id = ? OR (id = ? AND tenant_id IS NULL))
          AND role NOT LIKE '%Admin%' AND role NOT LIKE '%Owner%'
        ORDER BY id ASC
      `).all(activeTenantId, activeTenantId);

      if (agents.length === 0) {
        botReply = `[SALES TEAM ROSTER]\nNo sales agents have been created yet. You can add agents under CRM Settings > Team Roster.`;
      } else {
        botReply = `[ABADI GURU CRM - SALES TEAM LEADERBOARD]
==========================================\n`;
        let totalTeamWon = 0;
        let totalTeamQuota = 0;

        agents.forEach((ag, idx) => {
          const perf = tenantDb.prepare(`
            SELECT COUNT(*) as dealCount,
                   COALESCE(SUM(CASE WHEN stage = 'Closed Won' THEN amount ELSE 0 END), 0) as wonAmount,
                   COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN amount ELSE 0 END), 0) as pipelineAmount
            FROM deals
            WHERE owner_name = ? OR owner_name LIKE ?
          `).get(ag.name, `%${ag.name}%`) || { dealCount: 0, wonAmount: 0, pipelineAmount: 0 };

          const q = Number(ag.quota_target) || 50000;
          const w = Number(perf.wonAmount);
          const pct = q > 0 ? Math.min(100, Math.round((w / q) * 100)) : 0;
          totalTeamWon += w;
          totalTeamQuota += q;

          botReply += `${idx + 1}. ${ag.name} [${ag.role || 'Sales Rep'}]\n`;
          botReply += `   Won: ${curr}${w.toLocaleString()} / Target: ${curr}${q.toLocaleString()} (${pct}%)\n`;
          botReply += `   Pipeline: ${curr}${Number(perf.pipelineAmount).toLocaleString()} (${perf.dealCount} deals)\n\n`;
        });

        const overallPct = totalTeamQuota > 0 ? Math.round((totalTeamWon / totalTeamQuota) * 100) : 0;
        botReply += `==========================================\n`;
        botReply += `Team Aggregate: ${curr}${totalTeamWon.toLocaleString()} / ${curr}${totalTeamQuota.toLocaleString()} (${overallPct}% attained)`;
      }
      actionTaken = 'team_leaderboard';
    }
  }

  // 6. /deals / "All Deals" / "My Deals"
  else if (text.startsWith('/deals') || text === 'All Deals' || text === 'My Deals') {
    if (!isAdmin && perms.deals === 'none') {
      botReply = `[ACCESS RESTRICTED]\nAccess to the Deals module has been disabled by your administrator.`;
      actionTaken = 'restricted';
    } else {
      let query = 'SELECT * FROM deals';
      const params = [];

      if (!isAdmin) {
        query += ' WHERE owner_id = ? OR owner_name = ? OR owner_name LIKE ?';
        params.push(linkedUser.id, linkedUser.name, `%${linkedUser.name}%`);
      }
      query += ' ORDER BY amount DESC LIMIT 8';

      const deals = tenantDb.prepare(query).all(...params);

      if (deals.length === 0) {
        botReply = isAdmin
          ? `[PIPELINE DEALS]\nNo active deals found in the company pipeline.`
          : `[MY PIPELINE DEALS]\nNo active deals found in your assigned portfolio. Reply /add_deal <Title>, <Amount>, <Company> to create one.`;
      } else {
        const header = isAdmin ? '[COMPANY PIPELINE DEALS]' : `[MY ASSIGNED DEALS - ${linkedUser.name}]`;
        botReply = `${header}\n==========================================\n`;
        deals.forEach((d, i) => {
          botReply += `${i + 1}. ${d.name} (ID: #${d.id})\n`;
          botReply += `   Value: ${curr}${Number(d.amount).toLocaleString()} | Stage: ${d.stage} (${d.probability}%)\n`;
          botReply += `   Account: ${d.account_name} | Owner: ${d.owner_name || 'Unassigned'}\n\n`;
        });
        botReply += `Tip: Reply /won <ID> to mark an opportunity as Closed Won.`;
      }
      actionTaken = 'list_deals';
    }
  }

  // 7. /leads / "All Leads" / "My Leads"
  else if (text.startsWith('/leads') || text === 'All Leads' || text === 'My Leads' || text === 'Hot Leads') {
    if (!isAdmin && perms.leads === 'none') {
      botReply = `[ACCESS RESTRICTED]\nAccess to the Leads module has been disabled by your administrator.`;
      actionTaken = 'restricted';
    } else {
      let query = 'SELECT * FROM leads WHERE is_converted = 0';
      const params = [];

      if (!isAdmin) {
        query += ' AND (lead_owner_name = ? OR lead_owner_name LIKE ?)';
        params.push(linkedUser.name, `%${linkedUser.name}%`);
      }
      query += ' ORDER BY score DESC, created_at DESC LIMIT 8';

      const leads = tenantDb.prepare(query).all(...params);

      if (leads.length === 0) {
        botReply = isAdmin
          ? `[PROSPECT LEADS]\nNo active unconverted leads found.`
          : `[MY PROSPECT LEADS]\nNo leads currently assigned to you. Reply /add_lead <Name>, <Company>, <Email>, <Phone> to log a new prospect.`;
      } else {
        const header = isAdmin ? '[COMPANY PROSPECT LEADS]' : `[MY ASSIGNED LEADS - ${linkedUser.name}]`;
        botReply = `${header}\n==========================================\n`;
        leads.forEach((l, i) => {
          const tier = l.score >= 80 ? '[HOT]' : l.score >= 50 ? '[WARM]' : '[COLD]';
          botReply += `${i + 1}. ${l.first_name} ${l.last_name || ''} - ${l.company || 'Enterprise'}\n`;
          botReply += `   Status: ${l.status} | Score: ${l.score} ${tier}\n`;
          botReply += `   Email: ${l.email || 'None'} | Phone: ${l.phone || 'None'}\n\n`;
        });
      }
      actionTaken = 'list_leads';
    }
  }

  // 8. /contacts / "My Contacts"
  else if (text.startsWith('/contacts') || text === 'My Contacts') {
    if (!isAdmin && perms.contacts === 'none') {
      botReply = `[ACCESS RESTRICTED]\nAccess to Customer Contacts is disabled for your role.`;
      actionTaken = 'restricted';
    } else {
      let contacts = [];
      if (isAdmin) {
        contacts = tenantDb.prepare('SELECT id, first_name, last_name, email, phone, account_name, title FROM contacts ORDER BY id DESC LIMIT 8').all();
      } else {
        contacts = tenantDb.prepare(`
          SELECT id, first_name, last_name, email, phone, account_name, title FROM contacts
          WHERE id IN (SELECT contact_id FROM contact_access WHERE user_id = ?)
             OR owner_id = ?
          ORDER BY id DESC LIMIT 8
        `).all(linkedUser.id, linkedUser.id);
      }

      if (contacts.length === 0) {
        botReply = isAdmin
          ? `[CUSTOMER CONTACTS]\nNo contacts recorded yet.`
          : `[PERMITTED CONTACTS]\nYou have 0 permitted customer contacts. Request your company administrator to grant contact access in CRM settings.`;
      } else {
        botReply = `[${isAdmin ? 'CUSTOMER CONTACTS' : 'PERMITTED CONTACTS'}]\n==========================================\n`;
        contacts.forEach((c, i) => {
          botReply += `${i + 1}. ${c.first_name} ${c.last_name || ''} (ID: #${c.id})\n`;
          botReply += `   Account: ${c.account_name || 'Individual'} | Title: ${c.title || 'Client'}\n`;
          botReply += `   Email: ${c.email || 'None'} | Phone: ${c.phone || 'None'}\n\n`;
        });
      }
      actionTaken = 'list_contacts';
    }
  }

  // 9. /won <DealID>
  else if (text.startsWith('/won')) {
    const dealId = parseInt(text.replace('/won', '').trim());
    if (!dealId) {
      botReply = `Usage: /won <DealID>\nExample: /won 1`;
    } else {
      // Permission check: Rep can only close their own deal
      const deal = tenantDb.prepare('SELECT * FROM deals WHERE id = ?').get(dealId);
      if (!deal) {
        botReply = `[ERROR]\nDeal #${dealId} does not exist in the CRM database.`;
      } else if (!isAdmin && deal.owner_id !== linkedUser.id && deal.owner_name !== linkedUser.name && !deal.owner_name?.includes(linkedUser.name)) {
        botReply = `[PERMISSION DENIED]\nYou can only mark deals assigned to your own portfolio as won. Deal #${dealId} is assigned to ${deal.owner_name || 'another representative'}.`;
      } else {
        tenantDb.prepare("UPDATE deals SET stage = 'Closed Won', probability = 100 WHERE id = ?").run(dealId);
        botReply = `[DEAL CLOSED WON - #${dealId}]
Title: ${deal.name}
Value: ${curr}${Number(deal.amount).toLocaleString()}
Account: ${deal.account_name}
Owner: ${deal.owner_name || linkedUser.name}

Revenue has been added to Closed Won totals. Quota progress updated!`;
        actionTaken = 'deal_won';
      }
    }
  }

  // 10. /add_lead <Name>, <Company>, <Email>, <Phone>
  else if (text.startsWith('/add_lead')) {
    const raw = text.replace('/add_lead', '').trim();
    if (!raw) {
      botReply = `Usage: /add_lead <Name>, <Company>, <Email>, <Phone>\nExample: /add_lead Wayne Corp, Wayne Enterprises, wayne@corp.com, +1-555-0199`;
    } else {
      const parts = raw.split(',').map(s => s.trim());
      const fullName = parts[0] || 'New Prospect';
      const company = parts[1] || 'Corporate Client';
      const email = parts[2] || '';
      const phone = parts[3] || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const ownerName = isAdmin ? (parts[4] || linkedUser.name) : linkedUser.name;

      const res = tenantDb.prepare(`
        INSERT INTO leads (first_name, last_name, company, email, phone, lead_source, status, score, lead_owner_name, description)
        VALUES (?, ?, ?, ?, ?, 'Telegram Mobile', 'New', 75, ?, 'Lead captured via ABADI GURU Telegram Gateway')
      `).run(firstName, lastName, company, email, phone, ownerName);

      botReply = `[PROSPECT LEAD CREATED]
Name: ${fullName}
Company: ${company}
Owner: ${ownerName}
Status: New | Score: 75 [WARM]
Recorded in ABADI GURU CRM.`;
      actionTaken = 'add_lead';
    }
  }

  // 11. /add_deal <Title>, <Amount>, <Company>
  else if (text.startsWith('/add_deal')) {
    const raw = text.replace('/add_deal', '').trim();
    if (!raw) {
      botReply = `Usage: /add_deal <Title>, <Amount>, <Company>\nExample: /add_deal Cloud Migration, 45000, Apex Global`;
    } else {
      const parts = raw.split(',').map(s => s.trim());
      const dealName = parts[0] || 'New Opportunity';
      const amount = Number(parts[1]) || 50000;
      const accountName = parts[2] || 'Corporate Account';
      const ownerName = linkedUser.name;
      const ownerId = linkedUser.id;

      const res = tenantDb.prepare(`
        INSERT INTO deals (name, amount, account_name, stage, probability, owner_id, owner_name)
        VALUES (?, ?, ?, 'Qualification', 10, ?, ?)
      `).run(dealName, amount, accountName, ownerId, ownerName);

      botReply = `[PIPELINE OPPORTUNITY CREATED]
Title: ${dealName}
Amount: ${curr}${amount.toLocaleString()}
Account: ${accountName}
Stage: Qualification (10%)
Assigned Owner: ${ownerName}
Visible in CRM pipeline board.`;
      actionTaken = 'add_deal';
    }
  }

  // 12. /grant <repEmail> <contactId> (Admin Only)
  else if (text.startsWith('/grant')) {
    if (!isAdmin) {
      botReply = `[PERMISSION DENIED]\nOnly company administrators can grant contact permissions.`;
    } else {
      const raw = text.replace('/grant', '').trim().split(/\s+/);
      const repEmail = raw[0]?.toLowerCase();
      const contactId = Number(raw[1]);

      if (!repEmail || !contactId) {
        botReply = `Usage: /grant <repEmail> <contactId>\nExample: /grant peter@stark.com 4`;
      } else {
        const targetAgent = masterDb.prepare('SELECT id, name FROM users WHERE LOWER(email) = ?').get(repEmail);
        const contact = tenantDb.prepare('SELECT id, first_name, last_name FROM contacts WHERE id = ?').get(contactId);

        if (!targetAgent) {
          botReply = `[ERROR]\nNo user found with email "${repEmail}".`;
        } else if (!contact) {
          botReply = `[ERROR]\nNo contact found with ID #${contactId}.`;
        } else {
          tenantDb.prepare(`
            INSERT OR IGNORE INTO contact_access (user_id, contact_id, granted_by)
            VALUES (?, ?, ?)
          `).run(targetAgent.id, contact.id, linkedUser.id);

          botReply = `[PERMISSION GRANTED]
Contact: ${contact.first_name} ${contact.last_name} (#${contact.id})
Granted To: ${targetAgent.name} (${repEmail})
Authorized By: ${linkedUser.name}`;
        }
      }
    }
    actionTaken = 'grant_contact';
  }

  // 13. /quote <Client> | <Amount> | <Description> or "New Quotation"
  else if (text.startsWith('/quote') || text === 'New Quotation') {
    const raw = text.replace('/quote', '').trim();
    if (!raw || text === 'New Quotation') {
      botReply = `[CREATE COMMERCIAL QUOTATION]
Format: /quote <Client> | <Amount> | <Description>
Example: /quote Cyberdyne Systems | 75000 | Annual Software License & SLA Package`;
    } else {
      const parts = raw.split('|').map(s => s.trim());
      const clientName = parts[0] || 'Valued Client';
      const amount = Number(parts[1]) || 10000;
      const desc = parts[2] || 'Enterprise Software Solution';

      const quoteRes = await executeCrmTool(activeTenantId, 'create_quotation', {
        client_name: clientName,
        subject: desc,
        amount,
        items: [{ product_name: desc, unit_price: amount, quantity: 1, line_total: amount }]
      });

      if (quoteRes.error) {
        botReply = `[ERROR]\n${quoteRes.error}`;
      } else {
        botReply = `[QUOTATION CREATED - ${quoteRes.quote_number}]
Client: ${clientName}
Total: ${curr}${quoteRes.grand_total?.toLocaleString()}
Sales Rep: ${linkedUser.name}
Validity: 30 Days

Official branded PDF attached below.`;

        // Generate PDF
        try {
          const docRow = tenantDb.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteRes.id);
          const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteRes.id);
          const pdfBuffer = await generateDocumentPdfBuffer(docRow, items, settings);
          pendingDocument = {
            buffer: pdfBuffer,
            filename: `Quote-${quoteRes.quote_number}.pdf`,
            caption: `Official Quotation ${quoteRes.quote_number} for ${clientName}`
          };
        } catch (pdfErr) {
          console.error('[PDF Gen Error]', pdfErr.message);
        }
      }
      actionTaken = 'create_quotation';
    }
  }

  // 14. /invoice <Client> | <Amount> | <Description> or "Generate Invoice"
  else if (text.startsWith('/invoice') || text === 'Generate Invoice') {
    if (!isAdmin && perms.quotes === 'none') {
      botReply = `[ACCESS RESTRICTED]\nBilling documents access is disabled for your role.`;
    } else {
      const raw = text.replace('/invoice', '').trim();
      if (!raw || text === 'Generate Invoice') {
        botReply = `[GENERATE TAX INVOICE]
Format: /invoice <Client> | <Amount> | <Description>
Example: /invoice Initech LLC | 24000 | Q4 Enterprise CRM Deployment`;
      } else {
        const parts = raw.split('|').map(s => s.trim());
        const clientName = parts[0] || 'Corporate Client';
        const amount = Number(parts[1]) || 15000;
        const desc = parts[2] || 'Professional Consulting Services';

        const invRes = await executeCrmTool(activeTenantId, 'create_invoice', {
          client_name: clientName,
          subject: desc,
          amount,
          items: [{ product_name: desc, unit_price: amount, quantity: 1, line_total: amount }]
        });

        if (invRes.error) {
          botReply = `[ERROR]\n${invRes.error}`;
        } else {
          botReply = `[TAX INVOICE GENERATED - ${invRes.quote_number}]
Client: ${clientName}
Grand Total: ${curr}${invRes.grand_total?.toLocaleString()}
Issued By: ${linkedUser.name}
Terms: Net 30 Days

Official tax invoice PDF generated below.`;

          try {
            const docRow = tenantDb.prepare('SELECT * FROM quotes WHERE id = ?').get(invRes.id);
            const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(invRes.id);
            const pdfBuffer = await generateInvoicePdfBuffer(docRow, items, settings);
            pendingDocument = {
              buffer: pdfBuffer,
              filename: `Invoice-${invRes.quote_number}.pdf`,
              caption: `Official Tax Invoice ${invRes.quote_number} for ${clientName}`
            };
          } catch (pdfErr) {
            console.error('[PDF Gen Error]', pdfErr.message);
          }
        }
        actionTaken = 'create_invoice';
      }
    }
  }

  // 15. /convert_do <Quote#>
  else if (text.startsWith('/convert_do') || text === 'Convert to DO') {
    const raw = text.replace('/convert_do', '').trim();
    if (!raw) {
      botReply = `Usage: /convert_do <Quote# or ID>\nExample: /convert_do QT-2026-1042`;
    } else {
      const res = await executeCrmTool(activeTenantId, 'convert_to_delivery_order', { quote_id_or_number: raw });
      if (res.error) {
        botReply = `[ERROR]\n${res.error}`;
      } else {
        botReply = `[DELIVERY ORDER CREATED - ${res.quote_number}]
Source Quote: ${res.source_quote_number}
Client: ${res.account_name}
Total: ${curr}${res.grand_total?.toLocaleString()}
Status: Goods Prepared for Delivery`;
      }
      actionTaken = 'convert_do';
    }
  }

  // 16. /pdf <Doc#>
  else if (text.startsWith('/pdf')) {
    const raw = text.replace('/pdf', '').trim();
    if (!raw) {
      botReply = `Usage: /pdf <Doc# or ID>\nExample: /pdf QT-2026-001`;
    } else {
      let doc = tenantDb.prepare('SELECT * FROM quotes WHERE quote_number = ? OR id = ?').get(raw, isNaN(Number(raw)) ? -1 : Number(raw));
      if (!doc) {
        botReply = `[ERROR]\nNo document found matching "${raw}".`;
      } else {
        try {
          const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(doc.id);
          const pdfBuffer = await generateDocumentPdfBuffer(doc, items, settings);
          pendingDocument = {
            buffer: pdfBuffer,
            filename: `${doc.quote_number}.pdf`,
            caption: `Official ${doc.doc_type || 'Document'} ${doc.quote_number} for ${doc.account_name}`
          };
          botReply = `[DOCUMENT ATTACHED]\nDelivering official PDF for ${doc.quote_number}.`;
        } catch (pdfErr) {
          botReply = `[ERROR]\nFailed to generate PDF: ${pdfErr.message}`;
        }
      }
    }
    actionTaken = 'download_pdf';
  }

  // 17. AI Copilot Prompt button
  else if (text === 'Ask AI Copilot') {
    botReply = `[ABADI GURU CRM - AI SALES COPILOT]
Ready to assist you, ${linkedUser.name}.

Send any request in plain text:
${isAdmin ? '• "Summarize our sales pipeline and revenue forecast"\n• "Create a quotation for Apex Logistics for $35,000"\n• "Show team leaderboard and rep quota attainment"' : '• "How close am I to hitting my monthly quota?"\n• "Show my top deals closing this month"\n• "Create a quote for Acme Corp 12000 for cloud consulting"'}`;
    actionTaken = 'copilot_help';
  }

  // 18. Natural Language AI Chat (Scoped strictly to user role)
  else {
    try {
      addToChatSession(activeTenantId, chatId, 'user', text);
      const sessionHistory = getChatSession(activeTenantId, chatId);

      // System prompt strictly scoped
      const roleInstruction = isAdmin
        ? `The user is Workspace Owner & Root Administrator "${linkedUser.name}". They have complete company-wide access to all deals, revenues, and reps.`
        : `The user is Sales Representative "${linkedUser.name}". Filter all pipeline queries, deals, leads, and quotas STRICTLY to their assigned records. Do not disclose peer quotas or unassigned corporate finances.`;

      const aiResponse = await chatWithAI(activeTenantId, sessionHistory, roleInstruction);
      botReply = aiResponse.reply;

      addToChatSession(activeTenantId, chatId, 'assistant', botReply);

      // Clean typography tag
      if (!botReply.includes('ABADI GURU Intelligence') && !botReply.includes('[ABADI GURU]')) {
        botReply = `[ABADI GURU AI ASSISTANT]\n\n${botReply}`;
      }

      actionTaken = 'ai_chat';
    } catch (err) {
      botReply = `[AI COPILOT ERROR]\n${err.message}`;
    }
  }

  // Log to tenant's telegram_logs table
  try {
    tenantDb.prepare(`
      INSERT INTO telegram_logs (chat_id, sender_name, message_text, bot_response, action_taken)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(chatId), `${linkedUser.name} (${linkedUser.role || 'User'})`, text, botReply, actionTaken);
  } catch (logErr) {
    console.error(`[Telegram #${activeTenantId}] Log error:`, logErr.message);
  }

  // Dispatch reply
  await sendTelegramMessage(activeTenantId, chatId, botReply, { ...extraSendOpts, ...activeKeyboard });

  // Deliver PDF if pending
  if (pendingDocument) {
    try {
      await sendTelegramDocument(activeTenantId, chatId, pendingDocument.buffer, pendingDocument.filename, pendingDocument.caption, extraSendOpts);
    } catch (docErr) {
      console.error(`[Telegram #${activeTenantId}] Document dispatch error:`, docErr.message);
    }
  }
}

// Background Telegram Poller per tenant (Supports Admin bot & Dedicated Agent bot)
async function pollTelegramUpdates(userId, tokenOverride = null, isAgentBot = false) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  const token = tokenOverride || (isAgentBot ? settings.telegram_agent_token : settings.telegram_token);

  if (!token || token.length < 10) return;

  const pollerKey = isAgentBot ? `agent_${uid}` : `admin_${uid}`;

  const pollerState = {
    abortController: new AbortController(),
    lastUpdateId: 0,
    token,
    userId: uid,
    isAgentBot,
  };
  activePollers.set(pollerKey, pollerState);

  console.log(`[Telegram Bot] Poller started for User #${uid} (${isAgentBot ? 'Dedicated Agent Bot' : 'Admin/Primary Bot'}).`);

  while (activePollers.has(pollerKey)) {
    try {
      const currentPoller = activePollers.get(pollerKey);
      if (!currentPoller) break;

      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${currentPoller.lastUpdateId + 1}&timeout=20`;
      const res = await fetch(url, {
        signal: currentPoller.abortController.signal,
      });

      if (!res.ok) {
        console.warn(`[Telegram Bot #${uid}] API status ${res.status}. Retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          currentPoller.lastUpdateId = Math.max(currentPoller.lastUpdateId, update.update_id);
          if (update.message) {
            await handleTelegramMessage(uid, update.message, token);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') break;
      console.warn(`[Telegram Bot #${uid}] Polling warning: ${err.message}. Retrying in 4s...`);
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  activePollers.delete(pollerKey);
  console.log(`[Telegram Bot] Poller stopped for User #${uid} (${isAgentBot ? 'Agent Bot' : 'Admin Bot'}).`);
}

export function startTelegramBot(userId = 1) {
  const uid = Number(userId) || 1;
  const settings = getSettings(uid);
  if (!settings.telegram_token && !settings.telegram_agent_token) {
    throw new Error('Telegram Bot Token is required before starting the bot.');
  }

  saveSettings(uid, { telegram_enabled: '1' });

  // Start Primary/Admin bot poller
  if (settings.telegram_token && !activePollers.has(`admin_${uid}`)) {
    pollTelegramUpdates(uid, settings.telegram_token, false);
  }

  // Start Dedicated Agent bot poller if configured
  if (settings.telegram_agent_token && !activePollers.has(`agent_${uid}`)) {
    pollTelegramUpdates(uid, settings.telegram_agent_token, true);
  }

  return { success: true, message: 'ABADI GURU Telegram Bot started successfully!' };
}

export function stopTelegramBot(userId = 1) {
  const uid = Number(userId) || 1;
  saveSettings(uid, { telegram_enabled: '0' });

  ['admin_' + uid, 'agent_' + uid, uid].forEach(key => {
    if (activePollers.has(key)) {
      const poller = activePollers.get(key);
      poller.abortController.abort();
      activePollers.delete(key);
    }
  });

  return { success: true, message: 'ABADI GURU Telegram Bot stopped.' };
}

// Auto-start bot on system boot for users who have bot enabled
export function initTelegramIfEnabled() {
  try {
    const allUsers = masterDb.prepare('SELECT id FROM users').all();
    for (const u of allUsers) {
      const settings = getSettings(u.id);
      if (settings.telegram_enabled && (settings.telegram_token || settings.telegram_agent_token)) {
        startTelegramBot(u.id);
      }
    }
  } catch (err) {
    console.warn('[Telegram Init] Could not auto-start bots:', err.message);
  }
}
