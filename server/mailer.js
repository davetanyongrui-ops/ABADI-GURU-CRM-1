import nodemailer from 'nodemailer';
import { getTenantDb } from './db.js';
import { getSettings } from './ai.js';
import { generateDocumentPdfBuffer } from './pdf.js';

/**
 * Universal Outbound Email Sender for Private Tenants
 * Dispatches via configured SMTP or Resend API, logging the transaction in CRM.
 */
export async function sendOutboundEmail({
  userId,
  to,
  recipientName,
  subject,
  body,
  html,
  attachments = [],
  relatedToType,
  relatedToId,
  templateName,
  senderName,
}) {
  const uid = Number(userId) || 1;
  const tenantDb = getTenantDb(uid);
  const settings = getSettings(uid);

  const cleanTo = (to || '').trim();
  if (!cleanTo || !cleanTo.includes('@')) {
    throw new Error('A valid recipient email address is required.');
  }

  const cleanSubject = (subject || 'Message from ABADI GURU CRM').trim();
  const cleanBody = (body || '').trim();
  const cleanHtml = html || cleanBody.replace(/\n/g, '<br/>');

  const fromName = settings.smtp_from_name || senderName || settings.company_name || 'ABADI GURU CRM';
  const fromEmail = settings.smtp_from_email || settings.smtp_user || 'billing@abadiguru.com';

  // 1. Auto-discover linked Contact or Lead in tenant database if not explicitly provided
  let relType = relatedToType;
  let relId = relatedToId;
  let resolvedRecipientName = recipientName;

  if (!relType || !relId) {
    const contact = tenantDb.prepare('SELECT id, first_name, last_name, account_name FROM contacts WHERE LOWER(email) = ?').get(cleanTo.toLowerCase());
    if (contact) {
      relType = 'contact';
      relId = contact.id;
      if (!resolvedRecipientName) resolvedRecipientName = `${contact.first_name} ${contact.last_name}`.trim();
    } else {
      const lead = tenantDb.prepare('SELECT id, first_name, last_name, company FROM leads WHERE LOWER(email) = ?').get(cleanTo.toLowerCase());
      if (lead) {
        relType = 'lead';
        relId = lead.id;
        if (!resolvedRecipientName) resolvedRecipientName = `${lead.first_name} ${lead.last_name}`.trim();
      } else {
        relType = 'adhoc';
        relId = 0;
        if (!resolvedRecipientName) resolvedRecipientName = cleanTo.split('@')[0];
      }
    }
  }

  let deliveryStatus = 'Logged (Simulation Mode)';
  let messageId = null;
  let providerUsed = settings.email_delivery_provider || 'none';

  // 2. Dispatch via SMTP
  if (providerUsed === 'smtp' && settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: Number(settings.smtp_port) || 587,
        secure: settings.smtp_secure === '1' || Number(settings.smtp_port) === 465,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass,
        },
      });

      const mailOptions = {
        from: `"${fromName}" <${settings.smtp_from_email || settings.smtp_user}>`,
        to: cleanTo,
        subject: cleanSubject,
        text: cleanBody,
        html: cleanHtml,
        attachments: attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || 'application/pdf',
        })),
      };

      const info = await transporter.sendMail(mailOptions);
      messageId = info.messageId;
      deliveryStatus = 'Delivered (SMTP)';
    } catch (err) {
      console.error(`[SMTP #${uid}] Delivery failure:`, err.message);
      deliveryStatus = `Failed (SMTP): ${err.message}`;
      throw new Error(`SMTP Delivery Failed: ${err.message}`);
    }
  }
  // 3. Dispatch via Resend API
  else if (providerUsed === 'resend' && settings.resend_api_key) {
    try {
      const resendAttachments = attachments.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content).toString('base64'),
      }));

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.resend_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${settings.smtp_from_email || 'onboarding@resend.dev'}>`,
          to: [cleanTo],
          subject: cleanSubject,
          text: cleanBody,
          html: cleanHtml,
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
        }),
      });

      const resData = await resendRes.json();
      if (!resendRes.ok) {
        throw new Error(resData.message || 'Resend API error');
      }
      messageId = resData.id;
      deliveryStatus = 'Delivered (Resend)';
    } catch (err) {
      console.error(`[Resend #${uid}] Delivery failure:`, err.message);
      deliveryStatus = `Failed (Resend): ${err.message}`;
      throw new Error(`Resend Delivery Failed: ${err.message}`);
    }
  } else {
    deliveryStatus = 'Logged (Simulated - No SMTP configured)';
  }

  // 4. Save into private tenant emails table
  const insertStmt = tenantDb.prepare(`
    INSERT INTO emails (
      related_to_type, related_to_id, recipient_email, recipient_name,
      sender_name, subject, body, template_name, status, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const dbRes = insertStmt.run(
    relType || 'adhoc',
    relId || 0,
    cleanTo,
    resolvedRecipientName || cleanTo,
    fromName,
    cleanSubject,
    cleanBody,
    templateName || null,
    deliveryStatus
  );

  // 5. Log activity note on contact/lead/account timeline
  if (['lead', 'contact', 'account', 'deal'].includes(relType) && relId) {
    try {
      tenantDb.prepare(`
        INSERT INTO notes (related_to_type, related_to_id, content, created_by_name)
        VALUES (?, ?, ?, ?)
      `).run(
        relType,
        relId,
        `[OUTBOUND EMAIL] Sent:\nSubject: ${cleanSubject}\nTo: ${cleanTo}\nStatus: ${deliveryStatus}${attachments.length > 0 ? `\nAttachments: ${attachments.map(a => a.filename).join(', ')}` : ''}`,
        fromName
      );
    } catch (noteErr) {
      // Non-fatal note logging
    }
  }

  return {
    success: true,
    emailId: Number(dbRes.lastInsertRowid),
    recipient: cleanTo,
    recipientName: resolvedRecipientName,
    subject: cleanSubject,
    deliveryStatus,
    providerUsed,
    isLiveSent: deliveryStatus.startsWith('Delivered'),
    attachmentsCount: attachments.length,
    messageId,
  };
}

/**
 * Helper to prepare and send a Quotation, Delivery Order, or Tax Invoice with branded PDF attached
 */
export async function sendDocumentEmail({ userId, docIdOrNumber, recipientEmail, customMessage }) {
  const uid = Number(userId) || 1;
  const tenantDb = getTenantDb(uid);
  const settings = getSettings(uid);

  // Find document
  let doc = null;
  const isNumeric = !isNaN(Number(docIdOrNumber));
  if (isNumeric) {
    doc = tenantDb.prepare('SELECT * FROM quotes WHERE id = ?').get(docIdOrNumber);
  }
  if (!doc) {
    doc = tenantDb.prepare('SELECT * FROM quotes WHERE quote_number LIKE ?').get(`%${docIdOrNumber}%`);
  }

  if (!doc) {
    throw new Error(`Document "${docIdOrNumber}" not found in CRM.`);
  }

  // Determine recipient email: from parameter, or lookup from account/contact
  let targetEmail = (recipientEmail || '').trim();
  let targetName = doc.contact_name || doc.account_name || 'Valued Client';

  if (!targetEmail && doc.contact_id) {
    const c = tenantDb.prepare('SELECT email, first_name, last_name FROM contacts WHERE id = ?').get(doc.contact_id);
    if (c && c.email) {
      targetEmail = c.email;
      targetName = `${c.first_name} ${c.last_name}`;
    }
  }

  if (!targetEmail && doc.account_id) {
    const acc = tenantDb.prepare('SELECT a.*, c.email as contact_email, c.first_name, c.last_name FROM accounts a LEFT JOIN contacts c ON c.account_id = a.id WHERE a.id = ?').get(doc.account_id);
    if (acc && acc.contact_email) {
      targetEmail = acc.contact_email;
      targetName = `${acc.first_name} ${acc.last_name}`;
    }
  }

  if (!targetEmail) {
    throw new Error(`Please specify recipient email: /email_doc ${doc.quote_number} | <recipient_email>`);
  }

  const items = tenantDb.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(doc.id);
  const pdfBuffer = await generateDocumentPdfBuffer(doc, items, settings);

  const docType = doc.doc_type || 'Document';
  const filename = `${docType.replace(/\s+/g, '_')}-${doc.quote_number}.pdf`;
  const curr = settings.currency_symbol || '$';

  const defaultBody = customMessage || `Dear ${targetName},

Please find attached official ${docType} #${doc.quote_number} from ${settings.company_name || 'Abadi Guru Enterprises'}.

Summary of Document:
• Document Type: ${docType}
• Reference Number: ${doc.quote_number}
• Total Amount: ${curr}${Number(doc.grand_total).toLocaleString()}
${doc.valid_until ? `• Valid Until / Due Date: ${doc.valid_until}` : ''}
${doc.delivery_date ? `• Delivery Date: ${doc.delivery_date}` : ''}

Please review the attached PDF document. Should you require any assistance or confirmation, please do not hesitate to contact us.

Warm regards,
${doc.owner_name || settings.company_name || 'ABADI GURU Sales Team'}`;

  const subject = `[${docType}] ${doc.quote_number} - ${settings.company_name || 'ABADI GURU CRM'}`;

  const result = await sendOutboundEmail({
    userId: uid,
    to: targetEmail,
    recipientName: targetName,
    subject,
    body: defaultBody,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
    relatedToType: 'quote',
    relatedToId: doc.id,
    templateName: `${docType} Delivery`,
    senderName: doc.owner_name,
  });

  return {
    ...result,
    doc,
    filename,
  };
}
