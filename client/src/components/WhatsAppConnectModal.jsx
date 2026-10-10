import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Cake,
  FileText,
  Clock,
  CreditCard,
  Sparkles,
  Phone,
  CheckCircle2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { crmApi } from '../api';

export default function WhatsAppConnectModal({
  isOpen,
  onClose,
  recipient = {},
  defaultTemplateType = 'followup',
  extraData = {},
  onLogged
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplateType);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [logToCrm, setLogToCrm] = useState(true);
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (recipient?.phone || recipient?.mobile) {
      setPhone(recipient.phone || recipient.mobile || '');
    }
  }, [recipient]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const firstName = (recipient.name || recipient.first_name || 'there').split(' ')[0];
  const companyName = recipient.company || recipient.company_name || recipient.account_name || 'your team';

  // Construct Template Messages
  const getTemplateContent = (type) => {
    switch (type) {
      case 'birthday':
        const eventName = recipient.special_day_title || 'Birthday';
        return `Hi ${firstName}, wishing you a very Happy ${eventName}! Hope you have a wonderful celebration today. From all of us at ABADI GURU CRM!`;

      case 'quote':
        const quoteNum = extraData.quote_number || 'QT-2026';
        const total = extraData.grand_total ? `$${Number(extraData.grand_total).toLocaleString()}` : 'the proposed investment';
        const portalLink = extraData.portal_url || (extraData.share_token ? `${window.location.origin}/portal/doc/${extraData.share_token}` : `${window.location.origin}`);
        return `Hi ${firstName}, here is your official quotation ${quoteNum} for ${companyName} (${total}). You can review all line items and approve it digitally via our customer portal:\n\n${portalLink}\n\nPlease let me know if you have any questions!`;

      case 'invoice':
        const invNum = extraData.quote_number || extraData.invoice_number || 'INV-2026';
        const invTotal = extraData.grand_total ? `$${Number(extraData.grand_total).toLocaleString()}` : '';
        const dueDate = extraData.due_date || 'this week';
        const payLink = extraData.portal_url || (extraData.share_token ? `${window.location.origin}/portal/doc/${extraData.share_token}` : '');
        return `Hi ${firstName}, hope you're having a productive week! This is a friendly reminder regarding Invoice ${invNum}${invTotal ? ` for ${invTotal}` : ''}, due on ${dueDate}.${payLink ? `\n\nDigital View: ${payLink}` : ''}\n\nThank you for your business!`;

      case 'followup':
        const whatTheyTold = recipient.what_they_told_us ? `Regarding what you mentioned about "${recipient.what_they_told_us}", ` : '';
        return `Hi ${firstName}, great connecting with you earlier regarding ${companyName}! ${whatTheyTold}I wanted to follow up and see how your schedule is looking for our next step. Let me know what time works best for you!`;

      case 'checkin':
      default:
        return `Hi ${firstName}, checking in to see how things are going with ${companyName}! Please let me know if you or your team need any support this week. Always glad to assist!`;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(defaultTemplateType);
      setMessage(getTemplateContent(defaultTemplateType));
    }
  }, [isOpen, defaultTemplateType, recipient, extraData]);

  const handleSelectTemplate = (type) => {
    setSelectedTemplate(type);
    setMessage(getTemplateContent(type));
  };

  if (!isOpen) return null;

  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^0/, '62'); // Default international prefix if standard Indonesian format, or clean digits
  const waUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;

  const handleLaunchWhatsApp = async () => {
    if (!cleanPhone) {
      alert('Please enter a valid phone number for WhatsApp.');
      return;
    }

    // Launch WhatsApp
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Optionally log to CRM
    if (logToCrm && recipient.id) {
      try {
        setLogging(true);
        const relType = recipient.type || (recipient.lead_status ? 'lead' : 'contact');
        await crmApi.createNote({
          related_to_type: relType,
          related_to_id: recipient.id,
          content: `WhatsApp Sales Message: "${message}"`,
          note_category: selectedTemplate === 'birthday' ? 'personal_update' : 'client_said',
          created_by_name: 'Sales Rep'
        });
        if (onLogged) onLogged();
      } catch (err) {
        console.error('Failed to auto-log WhatsApp interaction:', err);
      } finally {
        setLogging(false);
      }
    }

    onClose();
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150 cursor-pointer"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden cursor-default">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                <span>ABADI GURU WhatsApp Sales Connect</span>
                <span className="text-[10px] bg-emerald-800/60 px-2 py-0.5 rounded-full border border-emerald-400/30">1-Click</span>
              </h3>
              <p className="text-xs text-emerald-100">
                Outreach to {recipient.name || recipient.first_name || 'Client'} ({companyName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            className="p-1.5 sm:p-2 text-emerald-100 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Phone Field */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Number (Include Country Code)
              </span>
              {!cleanPhone && (
                <span className="text-rose-500 font-semibold text-[11px]">Phone number needed</span>
              )}
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 (555) 789-0101 or +62 812 3456 7890"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>

          {/* Smart Templates Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Choose High-Converting Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectTemplate('quote')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  selectedTemplate === 'quote'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-rose-500" /> Quote & Portal
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">Deliver quote with online link</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('birthday')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  selectedTemplate === 'birthday'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Cake className="w-3.5 h-3.5 text-pink-500" /> Celebration
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">Birthday or milestone wish</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('followup')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  selectedTemplate === 'followup'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Post-Meeting
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">Follow up on next steps</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('invoice')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  selectedTemplate === 'invoice'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <CreditCard className="w-3.5 h-3.5 text-purple-500" /> Invoice Due
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">Friendly payment reminder</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTemplate('checkin')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  selectedTemplate === 'checkin'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <MessageCircle className="w-3.5 h-3.5 text-teal-500" /> Warm Check-In
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">Catch up and stay top-of-mind</div>
              </button>
            </div>
          </div>

          {/* Editable Message Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">Message Content</label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-sans text-xs text-slate-800 leading-relaxed"
            />
            <div className="text-right text-[10px] text-slate-400 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Auto-log to CRM Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={logToCrm}
              onChange={(e) => setLogToCrm(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <strong>Record in CRM Activity Log:</strong> Automatically append this message to the client's conversation history notes so the entire sales team has full context.
            </span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-semibold text-xs rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleLaunchWhatsApp}
            disabled={!cleanPhone || logging}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Launch WhatsApp Web / App</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}
