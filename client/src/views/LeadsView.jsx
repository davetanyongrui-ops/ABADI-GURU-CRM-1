import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  ArrowRightCircle,
  Phone,
  Mail,
  Building2,
  Calendar,
  DollarSign,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  FileText,
  Clock,
  Sparkles,
  Layers,
  List,
  Send,
  Flame,
  Zap,
  Snowflake,
  Cake,
  MessageSquare,
  MessageCircle,
  Download
} from 'lucide-react';
import { crmApi } from '../api';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 2) return null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const month = parseInt(parts[parts.length - 2], 10) - 1;
  const day = parseInt(parts[parts.length - 1], 10);
  if (isNaN(month) || isNaN(day)) return null;

  let nextDate = new Date(currentYear, month, day);
  const diffTime = nextDate.getTime() - today.getTime();
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < -1) {
    nextDate = new Date(currentYear + 1, month, day);
    diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  return {
    days: diffDays,
    formatted: nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  };
}

const STATUS_COLUMNS = [
  'New',
  'Attempted to Contact',
  'Contacted',
  'In Progress',
  'Qualified'
];

export default function LeadsView({ onNavigate, selectedLeadId }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [scoreTierFilter, setScoreTierFilter] = useState('All'); // 'All' | 'Hot' | 'Warm' | 'Cold'
  const [convertedFilter, setConvertedFilter] = useState('all'); // 'active' | 'converted' | 'all'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'

  // Modals & Drawers
  const [activeLead, setActiveLead] = useState(null);
  const [convertingLead, setConvertingLead] = useState(null);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [emailingLead, setEmailingLead] = useState(null);
  const [templates, setTemplates] = useState([]);

  // Email Compose State
  const [emailForm, setEmailForm] = useState({
    subject: '',
    body: '',
    template_name: '',
  });
  const [emailSendMethod, setEmailSendMethod] = useState('direct_send'); // 'direct_send' | 'client_and_crm' | 'crm_only'
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  // Lead History Emails
  const [leadEmails, setLeadEmails] = useState([]);

  // New Lead Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company: '',
    title: '',
    email: '',
    phone: '',
    lead_source: 'Web Form',
    lead_status: 'New',
    annual_revenue: '',
    industry: 'Technology',
    city: '',
    state: '',
    date_of_birth: '',
    special_day_title: '',
    special_day_date: '',
    personal_interests: '',
    preferred_communication: 'WhatsApp',
    current_situation: '',
    relationship_health: 'New Prospect',
    what_they_told_us: '',
    next_follow_up_date: '',
    description: '',
  });

  // Conversion Form state
  const [convertForm, setConvertForm] = useState({
    createDeal: true,
    dealName: '',
    dealAmount: '',
    dealClosingDate: '',
    dealStage: 'Qualification',
  });

  const loadLeads = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (sourceFilter !== 'All') params.source = sourceFilter;
      if (search) params.q = search;
      if (convertedFilter === 'converted') params.converted = 'true';
      else if (convertedFilter === 'all') params.converted = 'all';
      else params.converted = 'false';

      const [data, tmpls] = await Promise.all([
        crmApi.getLeads(params),
        crmApi.getEmailTemplates(),
      ]);
      setLeads(data);
      setTemplates(tmpls);

      if (selectedLeadId) {
        const found = data.find(l => l.id === Number(selectedLeadId));
        if (found) openLeadDetails(found.id);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();

    // Auto-sync in background so changes from Telegram or AI appear instantly
    const timer = setInterval(async () => {
      try {
        const params = {};
        if (statusFilter !== 'All') params.status = statusFilter;
        if (sourceFilter !== 'All') params.source = sourceFilter;
        if (search) params.q = search;
        if (convertedFilter === 'converted') params.converted = 'true';
        else if (convertedFilter === 'all') params.converted = 'all';
        else params.converted = 'false';

        const data = await crmApi.getLeads(params);
        setLeads(data);
      } catch (err) {}
    }, 4000);

    return () => clearInterval(timer);
  }, [statusFilter, sourceFilter, search, convertedFilter, selectedLeadId]);

  // Global Escape key listener to close modals / drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (whatsAppData) setWhatsAppData(null);
        else if (emailingLead) setEmailingLead(null);
        else if (convertingLead) setConvertingLead(null);
        else if (isCreatingLead) setIsCreatingLead(false);
        else if (activeLead) setActiveLead(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [whatsAppData, emailingLead, convertingLead, isCreatingLead, activeLead]);

  const openLeadDetails = async (id) => {
    try {
      const [full, emails] = await Promise.all([
        crmApi.getLead(id),
        crmApi.getEmails('lead', id),
      ]);
      setActiveLead(full);
      setLeadEmails(emails);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createLead(formData);
      setIsCreatingLead(false);
      setFormData({
        first_name: '',
        last_name: '',
        company: '',
        title: '',
        email: '',
        phone: '',
        lead_source: 'Web Form',
        lead_status: 'New',
        annual_revenue: '',
        industry: 'Technology',
        city: '',
        state: '',
        date_of_birth: '',
        special_day_title: '',
        special_day_date: '',
        personal_interests: '',
        preferred_communication: 'WhatsApp',
        current_situation: '',
        relationship_health: 'New Prospect',
        what_they_told_us: '',
        next_follow_up_date: '',
        description: '',
      });
      loadLeads();
    } catch (err) {
      alert('Error creating lead: ' + err.message);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await crmApi.deleteLead(id);
      if (activeLead?.id === id) setActiveLead(null);
      loadLeads();
    } catch (err) {
      alert('Error deleting lead: ' + err.message);
    }
  };

  const openConversionModal = (lead) => {
    setConvertingLead(lead);
    const estAmount = lead.annual_revenue > 0 ? Math.round(lead.annual_revenue * 0.1) : 25000;
    const estClose = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setConvertForm({
      createDeal: true,
      dealName: `${lead.company} - Expansion Deal`,
      dealAmount: estAmount,
      dealClosingDate: estClose,
      dealStage: 'Qualification',
    });
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertingLead) return;
    try {
      await crmApi.convertLead(convertingLead.id, convertForm);
      alert(`Lead "${convertingLead.first_name} ${convertingLead.last_name}" was successfully converted into an Account, Contact, and Deal!`);
      setConvertingLead(null);
      if (activeLead?.id === convertingLead.id) setActiveLead(null);
      loadLeads();
      onNavigate('deals');
    } catch (err) {
      alert('Conversion failed: ' + err.message);
    }
  };

  // Email simulation handlers
  const openEmailModal = (lead) => {
    setEmailingLead(lead);
    const defaultTemplate = templates[0];
    if (defaultTemplate) {
      const renderedBody = defaultTemplate.body
        .replace(/{{name}}/g, `${lead.first_name}`)
        .replace(/{{company}}/g, `${lead.company}`);
      setEmailForm({
        subject: defaultTemplate.subject,
        body: renderedBody,
        template_name: defaultTemplate.name,
      });
    } else {
      setEmailForm({
        subject: `Connecting with ${lead.company}`,
        body: `Hi ${lead.first_name},\n\nI wanted to follow up on your inquiry with ABADI GURU CRM...`,
        template_name: 'Custom',
      });
    }
  };

  const handleSendEmailSubmit = async (e, forceMethod = null) => {
    if (e) e.preventDefault();
    if (!emailingLead) return;
    const method = forceMethod || emailSendMethod;

    try {
      setIsSendingEmail(true);
      const res = await crmApi.sendEmail({
        related_to_type: 'lead',
        related_to_id: emailingLead.id,
        recipient_email: emailingLead.email || 'lead@example.com',
        recipient_name: `${emailingLead.first_name} ${emailingLead.last_name}`,
        sender_name: 'Alex Mercer',
        subject: emailForm.subject,
        body: emailForm.body,
        template_name: emailForm.template_name,
      });

      // If user chose to open their email client (Gmail / Outlook / Apple Mail)
      if (method === 'client_and_crm' && emailingLead.email) {
        const mailtoUrl = `mailto:${encodeURIComponent(emailingLead.email)}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
        window.open(mailtoUrl, '_blank');
        alert(`Email recorded in ABADI GURU CRM timeline and opened in your email client for ${emailingLead.email}!`);
      } else if (method === 'direct_send') {
        const liveNote = res?.isLiveSent ? `(Delivered via ${res.providerUsed?.toUpperCase()})` : `(Processed & Logged to CRM Timeline)`;
        alert(`Email successfully dispatched to ${emailingLead.email}!\nStatus: ${res?.deliveryStatus || 'Sent'} ${liveNote}`);
      } else {
        alert(`Email logged into lead timeline and audit history for ${emailingLead.email || 'lead'}!`);
      }

      setEmailingLead(null);
      if (activeLead && activeLead.id === emailingLead.id) {
        openLeadDetails(activeLead.id);
      }
    } catch (err) {
      alert('Email send failed: ' + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Add Note directly in lead drawer
  const [noteContent, setNoteContent] = useState('');
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !activeLead) return;
    try {
      await crmApi.createNote({
        related_to_type: 'lead',
        related_to_id: activeLead.id,
        content: noteContent,
        created_by_name: 'Alex Mercer',
      });
      setNoteContent('');
      openLeadDetails(activeLead.id);
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  // Filtered by Score Tier
  const filteredLeads = leads.filter(l => {
    if (scoreTierFilter === 'All') return true;
    return l.score_tier === scoreTierFilter;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Leads & Prospect Intelligence</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
              {filteredLeads.length} Prospects
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-Scored Leads (Hot / Warm / Cold). Engage via 1-click email and convert into customer accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Status Kanban View"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          <a
            href={crmApi.getExportUrl('leads')}
            download="abadi_guru_leads_export.csv"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200 shadow-2xs flex items-center gap-1.5"
            title="Export full prospects and AI scoring data to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </a>

          <button
            onClick={() => setIsCreatingLead(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Lead
          </button>
        </div>
      </div>

      {/* Filter Bar with AI Score Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name, company, email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Converted Leads Filter */}
          <label className="text-slate-500 font-medium">View:</label>
          <select
            value={convertedFilter}
            onChange={(e) => setConvertedFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="all">All (Active & Converted)</option>
            <option value="active">Open Leads Only</option>
            <option value="converted">Converted Leads Only</option>
          </select>

          {/* AI Score Filter */}
          <label className="text-slate-500 font-medium ml-2">AI Score:</label>
          <select
            value={scoreTierFilter}
            onChange={(e) => setScoreTierFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Tiers</option>
            <option value="Hot">Hot (80+ Score)</option>
            <option value="Warm">Warm (50-79)</option>
            <option value="Cold">Cold (&lt;50)</option>
          </select>

          <label className="text-slate-500 font-medium ml-2">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Statuses</option>
            {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="text-slate-500 font-medium ml-2">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Sources</option>
            <option value="Web Form">Web Form</option>
            <option value="Trade Show">Trade Show</option>
            <option value="Cold Call">Cold Call</option>
            <option value="Partner">Partner</option>
            <option value="Sales Email">Sales Email</option>
            <option value="Employee Referral">Employee Referral</option>
          </select>
        </div>
      </div>

      {/* Leads Content: Table or Kanban */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading leads database...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No leads match criteria</h3>
          <p className="text-xs text-slate-500 mt-1">Try resetting the status or score filter.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lead Name</th>
                  <th className="py-3 px-4">AI Score</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Email & Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Est. Budget</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openLeadDetails(lead.id)}
                        className="font-bold text-slate-900 hover:text-rose-600 text-left transition-colors flex items-center gap-1.5"
                      >
                        {lead.first_name} {lead.last_name}
                      </button>
                      <div className="text-[11px] text-slate-400">{lead.title || 'Prospective Lead'}</div>
                    </td>

                    {/* AI Score Badge */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 w-fit ${
                        lead.score >= 80 ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        lead.score >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {lead.score >= 80 ? <Flame className="w-3 h-3 text-rose-600 fill-rose-600" /> :
                         lead.score >= 50 ? <Zap className="w-3 h-3 text-amber-600 fill-amber-600" /> :
                         <Snowflake className="w-3 h-3 text-blue-600" />}
                        {lead.score} &bull; {lead.score_tier || 'Warm'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {lead.company}
                      </div>
                      <div className="text-[11px] text-slate-400">{lead.industry || 'Technology'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400" /> {lead.email || '—'}
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 text-[11px] mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {lead.phone || '—'}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        lead.lead_status === 'Qualified' ? 'bg-emerald-100 text-emerald-800' :
                        lead.lead_status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        lead.lead_status === 'Contacted' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {lead.lead_status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {lead.lead_source}
                    </td>

                    <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-mono">
                      ${Number(lead.annual_revenue || 0).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Send Email Simulator */}
                        <button
                          onClick={() => openEmailModal(lead)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors"
                          title="Send Email"
                        >
                          <Send className="w-3 h-3 text-indigo-600" />
                        </button>

                        {/* WhatsApp Sales Outreach */}
                        {lead.phone && (
                          <button
                            onClick={() => {
                              setWhatsAppData({
                                recipient: {
                                  name: `${lead.first_name} ${lead.last_name}`,
                                  first_name: lead.first_name,
                                  company: lead.company,
                                  phone: lead.phone,
                                  special_day_title: lead.special_day_title || '',
                                  what_they_told_us: lead.what_they_told_us,
                                  current_situation: lead.current_situation,
                                  id: lead.id,
                                  type: 'lead'
                                },
                                template: 'followup'
                              });
                            }}
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center gap-1 transition-colors border border-emerald-200"
                            title="ABADI GURU WhatsApp Sales Connect"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" /> WhatsApp
                          </button>
                        )}

                        {/* Zoho 1-Click Convert */}
                        {lead.is_converted ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Converted
                          </span>
                        ) : (
                          <button
                            onClick={() => openConversionModal(lead)}
                            className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 transition-colors border border-rose-200"
                            title="Convert to Account + Contact + Deal"
                          >
                            <Sparkles className="w-3 h-3 text-rose-600" />
                            Convert
                          </button>
                        )}

                        <button
                          onClick={() => openLeadDetails(lead.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN VIEW BY STATUS */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((colStatus) => {
            const colLeads = filteredLeads.filter(l => l.lead_status === colStatus);
            return (
              <div key={colStatus} className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-col min-w-[220px]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-xs text-slate-800">{colStatus}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                    {colLeads.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => openLeadDetails(lead.id)}
                      className="bg-white p-3 rounded-lg border border-slate-200 hover:border-rose-400 cursor-pointer shadow-2xs transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-slate-900 hover:text-rose-600 truncate">
                          {lead.first_name} {lead.last_name}
                        </div>
                        <span className="text-[10px] font-bold text-rose-600 font-mono">
                          {lead.score} pts
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> {lead.company}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                        <span className="text-slate-400">{lead.lead_source}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEmailModal(lead); }}
                            className="text-indigo-600 font-bold hover:underline"
                          >
                            Email
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openConversionModal(lead); }}
                            className="text-rose-600 font-bold hover:underline"
                          >
                            Convert &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEAD DETAIL DRAWER */}
      {activeLead && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveLead(null);
          }}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end cursor-pointer"
        >
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto cursor-default">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center text-sm">
                  {activeLead.first_name[0]}{activeLead.last_name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {activeLead.first_name} {activeLead.last_name}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                      Score: {activeLead.score || 85}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{activeLead.company} &bull; {activeLead.title || 'Lead'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEmailModal(activeLead)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" /> Send Email
                </button>
                <button
                  onClick={() => openConversionModal(activeLead)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Convert
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLead(null)}
                  aria-label="Close drawer"
                  title="Close (Esc)"
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* 1. CURRENT SITUATION SNAPSHOT */}
              <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 p-4 rounded-2xl border border-rose-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-rose-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    Current Situation & Prospect Status
                  </span>
                  {activeLead.next_follow_up_date && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-rose-700 border border-rose-200">
                      Follow-Up: {activeLead.next_follow_up_date}
                    </span>
                  )}
                </div>
                <p className="text-slate-800 text-xs leading-relaxed font-medium bg-white/70 p-3 rounded-xl border border-rose-100">
                  {activeLead.current_situation || 'No situation summary logged yet. Record what is currently happening with this prospect.'}
                </p>
              </div>

              {/* 2. PERSONAL TOUCH & SPECIAL DAYS */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Cake className="w-4 h-4 text-pink-500" />
                  Prospect Personal Profile & Special Days
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100">
                    <span className="text-pink-600 block text-[10px] uppercase font-extrabold flex items-center gap-1">
                      <Cake className="w-3 h-3" /> Birthday
                    </span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {activeLead.date_of_birth ? activeLead.date_of_birth : 'Not entered'}
                    </div>
                    {activeLead.date_of_birth && (
                      <div className="text-[11px] text-pink-700 font-semibold mt-1">
                        {getDaysUntil(activeLead.date_of_birth)?.days === 0
                          ? 'Birthday Today!'
                          : `In ${getDaysUntil(activeLead.date_of_birth)?.days} days (${getDaysUntil(activeLead.date_of_birth)?.formatted})`}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <span className="text-amber-700 block text-[10px] uppercase font-extrabold flex items-center gap-1">
                      <Award className="w-3 h-3" /> {activeLead.special_day_title || 'Special Milestone'}
                    </span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {activeLead.special_day_date ? activeLead.special_day_date : 'Not entered'}
                    </div>
                    {activeLead.special_day_date && (
                      <div className="text-[11px] text-amber-800 font-semibold mt-1">
                        {getDaysUntil(activeLead.special_day_date)?.days === 0
                          ? 'Celebration Today!'
                          : `In ${getDaysUntil(activeLead.special_day_date)?.days} days (${getDaysUntil(activeLead.special_day_date)?.formatted})`}
                      </div>
                    )}
                  </div>
                </div>

                {activeLead.personal_interests && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Personal Interests & Hobbies</span>
                    <p className="text-slate-800 font-medium mt-1">{activeLead.personal_interests}</p>
                  </div>
                )}
              </div>

              {/* 3. WHAT THEY TOLD US HIGHLIGHT */}
              {activeLead.what_they_told_us && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-rose-600" />
                    What Client Told Us During Discovery
                  </h3>
                  <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-slate-800 italic leading-relaxed">
                    "{activeLead.what_they_told_us}"
                  </div>
                </div>
              )}

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                  <span className="font-semibold text-slate-800 break-all">{activeLead.email || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone</span>
                  <span className="font-semibold text-slate-800">{activeLead.phone || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-semibold text-slate-800">{activeLead.lead_status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Source</span>
                  <span className="font-semibold text-slate-800">{activeLead.lead_source}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Annual Revenue</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    ${Number(activeLead.annual_revenue || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Industry</span>
                  <span className="font-semibold text-slate-800">{activeLead.industry}</span>
                </div>
              </div>

              {/* Email Communication Log (Zoho SalesInbox History) */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" /> Sales Email Communication History
                </h4>
                {leadEmails.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No emails logged yet for this lead.</p>
                ) : (
                  <div className="space-y-2">
                    {leadEmails.map((em) => (
                      <div key={em.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                          <span>{em.subject}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {em.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mb-1">
                          To: {em.recipient_name} ({em.recipient_email}) &bull; Sent by {em.sender_name}
                        </div>
                        <p className="text-slate-600 bg-white p-2 rounded border border-slate-200/60 font-mono text-[11px] whitespace-pre-wrap">
                          {em.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Note Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Lead Discussion & Notes</h4>
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Log a note or call summary for this lead..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!noteContent.trim()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg disabled:opacity-50"
                    >
                      Add Note
                    </button>
                  </div>
                </form>

                {/* Notes List */}
                <div className="mt-3 space-y-2">
                  {activeLead.notes?.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-700">{n.created_by_name}</span>
                        <span>{n.created_at}</span>
                      </div>
                      <p className="text-slate-700">{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                onClick={() => handleDeleteLead(activeLead.id)}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Lead
              </button>
              <button
                onClick={() => setActiveLead(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND SIMULATED SALES EMAIL MODAL */}
      {emailingLead && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailingLead(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden cursor-default">
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-300" />
                <h3 className="font-bold text-sm">ABADI GURU Smart Sales Emailer</h3>
              </div>
              <button
                type="button"
                onClick={() => setEmailingLead(null)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmailSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
                <div><strong>To:</strong> {emailingLead.first_name} {emailingLead.last_name} &lt;{emailingLead.email}&gt;</div>
                <div><strong>From:</strong> Alex Mercer &lt;alex.mercer@abadiguru.com&gt;</div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Template</label>
                <select
                  value={emailForm.template_name}
                  onChange={(e) => {
                    const tmpl = templates.find(t => t.name === e.target.value);
                    if (tmpl) {
                      const rendered = tmpl.body
                        .replace(/{{name}}/g, emailingLead.first_name)
                        .replace(/{{company}}/g, emailingLead.company);
                      setEmailForm({
                        subject: tmpl.subject,
                        body: rendered,
                        template_name: tmpl.name,
                      });
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Message Body</label>
                <textarea
                  rows={5}
                  required
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-500 outline-hidden font-sans leading-relaxed"
                />
              </div>

              {/* Dispatch Method Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Select Dispatch Method:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailSendMethod('direct_send')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      emailSendMethod === 'direct_send'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-indigo-600" /> Send via Server
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">
                      Dispatches via SMTP / Cloud and logs delivery
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailSendMethod('client_and_crm')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      emailSendMethod === 'client_and_crm'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" /> Open Mail App
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">
                      Pre-fills draft in Gmail or Outlook
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailSendMethod('crm_only')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      emailSendMethod === 'crm_only'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Log History Only
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">
                      Records entry in lead activity timeline
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEmailingLead(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingEmail
                      ? 'Sending...'
                      : emailSendMethod === 'direct_send'
                      ? 'Dispatch Email Now'
                      : emailSendMethod === 'client_and_crm'
                      ? 'Log & Open Mail App'
                      : 'Log in CRM History'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOHO 1-CLICK CONVERSION MODAL */}
      {convertingLead && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setConvertingLead(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden cursor-default">
            <div className="p-5 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">Convert Lead to Customer</h3>
                  <div className="text-xs opacity-90">{convertingLead.first_name} {convertingLead.last_name} ({convertingLead.company})</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvertingLead(null)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                Converting this lead will automatically generate an <strong>Account</strong> and a <strong>Contact</strong>, and transfer all linked activities and history.
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Account</span>
                      <span className="text-[11px] text-slate-500">{convertingLead.company}</span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <div>
                      <span className="font-bold text-slate-800 block">Contact</span>
                      <span className="text-[11px] text-slate-500">{convertingLead.first_name} {convertingLead.last_name}</span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={convertForm.createDeal}
                    onChange={(e) => setConvertForm({ ...convertForm, createDeal: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <span>Create a New Deal for this Account</span>
                </label>

                {convertForm.createDeal && (
                  <div className="mt-3 space-y-3 pl-6 border-l-2 border-rose-200">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Deal Name</label>
                      <input
                        type="text"
                        required
                        value={convertForm.dealName}
                        onChange={(e) => setConvertForm({ ...convertForm, dealName: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Amount ($)</label>
                        <input
                          type="number"
                          required
                          value={convertForm.dealAmount}
                          onChange={(e) => setConvertForm({ ...convertForm, dealAmount: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Closing Date</label>
                        <input
                          type="date"
                          required
                          value={convertForm.dealClosingDate}
                          onChange={(e) => setConvertForm({ ...convertForm, dealClosingDate: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConvertingLead(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Convert Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE LEAD MODAL */}
      {isCreatingLead && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreatingLead(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Lead</h3>
              <button
                type="button"
                onClick={() => setIsCreatingLead(false)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Job Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Lead Source</label>
                  <select
                    value={formData.lead_source}
                    onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="Web Form">Web Form</option>
                    <option value="Trade Show">Trade Show</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Partner">Partner</option>
                    <option value="Sales Email">Sales Email</option>
                    <option value="Employee Referral">Employee Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Lead Status</label>
                  <select
                    value={formData.lead_status}
                    onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Annual Revenue ($)</label>
                  <input
                    type="number"
                    value={formData.annual_revenue}
                    onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Personal Touch & Situation Section in Modal */}
              <div className="pt-2 border-t border-slate-200/80 space-y-3">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  Situation, Birthday & What They Told Us
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1"><Cake className="w-3.5 h-3.5 text-pink-500" /> Birthday</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Preferred Channel</label>
                    <select
                      value={formData.preferred_communication}
                      onChange={(e) => setFormData({ ...formData, preferred_communication: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Phone Call">Phone Call</option>
                      <option value="Email">Email</option>
                      <option value="Telegram">Telegram</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Special Milestone Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Company Summit, Anniversary"
                      value={formData.special_day_title}
                      onChange={(e) => setFormData({ ...formData, special_day_title: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Milestone Date</label>
                    <input
                      type="date"
                      value={formData.special_day_date}
                      onChange={(e) => setFormData({ ...formData, special_day_date: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Current Situation (What's happening right now?)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Evaluating 15-user license. Dislikes slow legacy CRM; loves Telegram bot."
                    value={formData.current_situation}
                    onChange={(e) => setFormData({ ...formData, current_situation: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">What did they tell you about?</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Told us they need quotation-to-delivery order conversion without extra paperwork."
                    value={formData.what_they_told_us}
                    onChange={(e) => setFormData({ ...formData, what_they_told_us: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingLead(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Sales Outreach Modal */}
      {whatsAppData && (
        <WhatsAppConnectModal
          isOpen={true}
          onClose={() => setWhatsAppData(null)}
          recipient={whatsAppData.recipient}
          defaultTemplateType={whatsAppData.template}
          onLogged={() => loadData()}
        />
      )}
    </div>
  );
}
