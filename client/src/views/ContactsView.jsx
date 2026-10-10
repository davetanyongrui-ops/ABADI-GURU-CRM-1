import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Building2,
  Briefcase,
  ChevronRight,
  X,
  Trash2,
  CalendarCheck,
  Cake,
  Sparkles,
  MessageSquare,
  Heart,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  ExternalLink,
  Edit3,
  Send,
  Calendar,
  FileText,
  Tag,
  Download
} from 'lucide-react';
import { crmApi } from '../api';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';

// Helper to calculate days until birthday or anniversary
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

const RELATIONSHIP_BADGES = {
  'VIP Champion': { bg: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-600' },
  'Strong & Warm': { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
  'Positive': { bg: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-600' },
  'Needs Attention': { bg: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-600' },
  'At Risk': { bg: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-600' },
};

export default function ContactsView({ onNavigate, selectedContactId }) {
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('All');

  const [activeContact, setActiveContact] = useState(null);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // Active modal active tab in details drawer: 'overview' | 'what_they_said' | 'emails' | 'deals'
  const [detailTab, setDetailTab] = useState('overview');

  // Quick "What did the client tell you?" input
  const [quickSaidNote, setQuickSaidNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Form tab in Create / Edit: 'basic' | 'situation' | 'personal' | 'insights'
  const [formTab, setFormTab] = useState('basic');

  // Email Compose State
  const [emailingContact, setEmailingContact] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '', template_name: '' });
  const [emailSendMethod, setEmailSendMethod] = useState('direct_send'); // 'direct_send' | 'client_and_crm' | 'crm_only'
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    account_id: '',
    account_name: '',
    title: '',
    department: '',
    email: '',
    phone: '',
    mobile: '',
    lead_source: 'Direct',
    mailing_city: '',
    mailing_state: '',
    date_of_birth: '',
    special_day_title: '',
    special_day_date: '',
    personal_interests: '',
    preferred_communication: 'WhatsApp',
    current_situation: '',
    relationship_health: 'Strong & Warm',
    what_they_told_us: '',
    next_follow_up_date: '',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.q = search;
      const [cons, accs, tmpls] = await Promise.all([
        crmApi.getContacts(params),
        crmApi.getAccounts(),
        crmApi.getEmailTemplates().catch(() => [])
      ]);
      setContacts(cons);
      setAccounts(accs);
      if (tmpls && tmpls.length) setTemplates(tmpls);

      if (selectedContactId) {
        const found = cons.find(c => c.id === Number(selectedContactId));
        if (found) openContactDetails(found.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedContactId]);

  // Global Escape key listener to close modals / drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (whatsAppData) setWhatsAppData(null);
        else if (emailingContact) setEmailingContact(null);
        else if (isCreatingContact || isEditingContact) {
          setIsCreatingContact(false);
          setIsEditingContact(false);
        } else if (activeContact) {
          setActiveContact(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [whatsAppData, emailingContact, isCreatingContact, isEditingContact, activeContact]);

  const openContactDetails = async (id) => {
    try {
      const full = await crmApi.getContact(id);
      setActiveContact(full);
      setDetailTab('overview');
    } catch (err) {
      console.error(err);
    }
  };

  // Smart Contact Email Dispatch Handlers
  const openEmailContactModal = (contact) => {
    setEmailingContact(contact);
    const defaultTemplate = templates[0];
    if (defaultTemplate) {
      const renderedBody = defaultTemplate.body
        .replace(/{{name}}/g, `${contact.first_name}`)
        .replace(/{{company}}/g, `${contact.account_name || 'your company'}`);
      setEmailForm({
        subject: defaultTemplate.subject,
        body: renderedBody,
        template_name: defaultTemplate.name,
      });
    } else {
      setEmailForm({
        subject: `Follow-up regarding our discussion`,
        body: `Hi ${contact.first_name},\n\nI wanted to follow up on our recent conversation with ABADI GURU CRM. Please let me know if you need any additional information.\n\nBest regards,\nAlex Mercer`,
        template_name: 'Custom',
      });
    }
  };

  const handleSendContactEmailSubmit = async (e, forceMethod = null) => {
    if (e) e.preventDefault();
    if (!emailingContact) return;
    const method = forceMethod || emailSendMethod;

    try {
      setIsSendingEmail(true);
      const res = await crmApi.sendEmail({
        related_to_type: 'contact',
        related_to_id: emailingContact.id,
        recipient_email: emailingContact.email || 'contact@example.com',
        recipient_name: `${emailingContact.first_name} ${emailingContact.last_name}`,
        sender_name: 'Alex Mercer',
        subject: emailForm.subject,
        body: emailForm.body,
        template_name: emailForm.template_name,
      });

      if (method === 'client_and_crm' && emailingContact.email) {
        const mailtoUrl = `mailto:${encodeURIComponent(emailingContact.email)}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
        window.open(mailtoUrl, '_blank');
        alert(`Email recorded in ABADI GURU CRM timeline and opened in your email client for ${emailingContact.email}!`);
      } else if (method === 'direct_send') {
        const liveNote = res?.isLiveSent ? `(Delivered via ${res.providerUsed?.toUpperCase()})` : `(Processed & Logged to CRM Timeline)`;
        alert(`Email successfully dispatched to ${emailingContact.email}!\nStatus: ${res?.deliveryStatus || 'Sent'} ${liveNote}`);
      } else {
        alert(`Email logged into contact timeline and audit history for ${emailingContact.email || 'contact'}!`);
      }

      setEmailingContact(null);
      if (activeContact && activeContact.id === emailingContact.id) {
        openContactDetails(activeContact.id);
      }
    } catch (err) {
      alert('Email send failed: ' + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createContact(formData);
      setIsCreatingContact(false);
      setFormData({
        first_name: '',
        last_name: '',
        account_id: '',
        account_name: '',
        title: '',
        department: '',
        email: '',
        phone: '',
        mobile: '',
        lead_source: 'Direct',
        mailing_city: '',
        mailing_state: '',
        date_of_birth: '',
        special_day_title: '',
        special_day_date: '',
        personal_interests: '',
        preferred_communication: 'WhatsApp',
        current_situation: '',
        relationship_health: 'Strong & Warm',
        what_they_told_us: '',
        next_follow_up_date: '',
        description: '',
      });
      loadData();
    } catch (err) {
      alert('Error creating contact: ' + err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!activeContact) return;
    try {
      const updated = await crmApi.updateContact(activeContact.id, editFormData);
      setActiveContact(prev => ({ ...prev, ...updated }));
      setIsEditingContact(false);
      loadData();
    } catch (err) {
      alert('Error saving contact: ' + err.message);
    }
  };

  const openEditModal = () => {
    if (!activeContact) return;
    setEditFormData({
      first_name: activeContact.first_name || '',
      last_name: activeContact.last_name || '',
      account_id: activeContact.account_id || '',
      account_name: activeContact.account_name || '',
      title: activeContact.title || '',
      department: activeContact.department || '',
      email: activeContact.email || '',
      phone: activeContact.phone || '',
      mobile: activeContact.mobile || '',
      mailing_city: activeContact.mailing_city || '',
      mailing_state: activeContact.mailing_state || '',
      date_of_birth: activeContact.date_of_birth || '',
      special_day_title: activeContact.special_day_title || '',
      special_day_date: activeContact.special_day_date || '',
      personal_interests: activeContact.personal_interests || '',
      preferred_communication: activeContact.preferred_communication || 'WhatsApp',
      current_situation: activeContact.current_situation || '',
      relationship_health: activeContact.relationship_health || 'Strong & Warm',
      what_they_told_us: activeContact.what_they_told_us || '',
      next_follow_up_date: activeContact.next_follow_up_date || '',
    });
    setFormTab('basic');
    setIsEditingContact(true);
  };

  const handleAddQuickNote = async (e) => {
    e.preventDefault();
    if (!quickSaidNote.trim() || !activeContact) return;
    try {
      setSubmittingNote(true);
      const note = await crmApi.createNote({
        related_to_type: 'contact',
        related_to_id: activeContact.id,
        content: quickSaidNote.trim(),
        note_category: 'client_said',
        created_by_name: 'You'
      });
      setActiveContact(prev => ({
        ...prev,
        notes: [note, ...(prev.notes || [])]
      }));
      setQuickSaidNote('');
    } catch (err) {
      alert('Failed to log client conversation: ' + err.message);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await crmApi.deleteContact(id);
      if (activeContact?.id === id) setActiveContact(null);
      loadData();
    } catch (err) {
      alert('Error deleting contact: ' + err.message);
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (relationshipFilter !== 'All' && (c.relationship_health || 'Strong & Warm') !== relationshipFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Client & Customer Directory</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200">
              {contacts.length} Client Contacts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track customer personal details, birthdays, what they told you, and their current situation so your team is always in sync.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <a
            href={crmApi.getExportUrl('contacts')}
            download="abadi_guru_contacts_export.csv"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200 shadow-2xs flex items-center gap-1.5"
            title="Export full client profiles and personal notes to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </a>
          <button
            onClick={() => {
              setFormTab('basic');
              setIsCreatingContact(true);
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Customer
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, company, email, or what they said..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Relationship:</span>
          <select
            value={relationshipFilter}
            onChange={(e) => setRelationshipFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-slate-700 font-medium focus:bg-white focus:border-rose-500 outline-hidden"
          >
            <option value="All">All Relationships</option>
            <option value="VIP Champion">VIP Champion</option>
            <option value="Strong & Warm">Strong & Warm</option>
            <option value="Positive">Positive</option>
            <option value="Needs Attention">Needs Attention</option>
            <option value="At Risk">At Risk</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading customer contacts...</div>
      ) : filteredContacts.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-sm">No contacts found</h3>
          <p className="text-xs text-slate-500">Add your first customer contact to start tracking their personal details and history.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Company & Role</th>
                  <th className="py-3 px-4">Relationship Health</th>
                  <th className="py-3 px-4">Current Situation</th>
                  <th className="py-3 px-4">Special Day / Birthday</th>
                  <th className="py-3 px-4">Contact Channel</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredContacts.map((contact) => {
                  const bday = getDaysUntil(contact.date_of_birth);
                  const special = getDaysUntil(contact.special_day_date);
                  const health = RELATIONSHIP_BADGES[contact.relationship_health] || RELATIONSHIP_BADGES['Strong & Warm'];

                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openContactDetails(contact.id)}
                          className="font-bold text-slate-900 hover:text-purple-600 text-left flex items-center gap-2.5"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-xs">
                            {contact.first_name[0]}{contact.last_name[0]}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs">{contact.first_name} {contact.last_name}</div>
                            {contact.personal_interests && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[160px]" title={contact.personal_interests}>
                                {contact.personal_interests}
                              </div>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Company & Role */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {contact.account_name || 'Individual'}
                        </div>
                        <div className="text-[11px] text-slate-500">{contact.title || 'Client Stakeholder'}</div>
                      </td>

                      {/* Relationship Health */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${health.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${health.dot || 'bg-current'}`} />
                          <span>{contact.relationship_health || 'Strong & Warm'}</span>
                        </span>
                      </td>

                      {/* Current Situation */}
                      <td className="py-3 px-4 max-w-xs">
                        {contact.current_situation ? (
                          <div className="text-xs text-slate-700 font-medium truncate" title={contact.current_situation}>
                            {contact.current_situation}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No situation logged</span>
                        )}
                        {contact.next_follow_up_date && (
                          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Follow-up: {contact.next_follow_up_date}
                          </div>
                        )}
                      </td>

                      {/* Special Day / Birthday */}
                      <td className="py-3 px-4">
                        {bday && bday.days <= 45 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold">
                            <Cake className="w-3 h-3 text-pink-500" />
                            {bday.days === 0 ? 'Birthday Today' : `Birthday in ${bday.days}d (${bday.formatted})`}
                          </span>
                        ) : special && special.days <= 45 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            {special.days === 0 ? 'Milestone Today' : `${special.days}d to ${contact.special_day_title || 'Event'}`}
                          </span>
                        ) : contact.date_of_birth ? (
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Cake className="w-3 h-3 text-slate-400" /> {contact.date_of_birth}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Contact Channels */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {contact.phone && (
                            <button
                              onClick={() => {
                                const isBday = bday && bday.days <= 30;
                                setWhatsAppData({
                                  recipient: {
                                    name: `${contact.first_name} ${contact.last_name}`,
                                    first_name: contact.first_name,
                                    company: contact.account_name,
                                    phone: contact.phone || contact.mobile,
                                    special_day_title: contact.special_day_title || (isBday ? 'Birthday' : ''),
                                    what_they_told_us: contact.what_they_told_us,
                                    current_situation: contact.current_situation,
                                    id: contact.id,
                                    type: 'contact'
                                  },
                                  template: isBday ? 'birthday' : 'followup'
                                });
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="ABADI GURU WhatsApp Sales Connect"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {contact.phone && (
                            <a
                              href={`tel:${contact.phone}`}
                              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {contact.email && (
                            <button
                              onClick={() => openEmailContactModal(contact)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Compose Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openContactDetails(contact.id)}
                          className="px-2.5 py-1 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          View Dossier <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CONTACT DOSSIER / DETAIL DRAWER */}
      {/* ============================================================ */}
      {activeContact && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveContact(null);
          }}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end cursor-pointer"
        >
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto cursor-default">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center text-base shadow-sm">
                  {activeContact.first_name[0]}{activeContact.last_name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {activeContact.first_name} {activeContact.last_name}
                    </h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${RELATIONSHIP_BADGES[activeContact.relationship_health]?.bg || 'bg-slate-100 text-slate-800'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${RELATIONSHIP_BADGES[activeContact.relationship_health]?.dot || 'bg-current'}`} />
                      {activeContact.relationship_health || 'Strong & Warm'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {activeContact.title || 'Client Stakeholder'} &bull; <strong className="text-slate-700">{activeContact.account_name || 'Individual'}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openEditModal}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContact(null)}
                  aria-label="Close drawer"
                  title="Close (Esc)"
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                {activeContact.phone && (
                  <a
                    href={`https://wa.me/${activeContact.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp ({activeContact.phone})
                  </a>
                )}
                {activeContact.email && (
                  <button
                    onClick={() => openEmailContactModal(activeContact)}
                    className="inline-flex items-center gap-1 text-indigo-700 font-bold hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email ({activeContact.email})
                  </button>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Preferred: <strong className="text-slate-700">{activeContact.preferred_communication || 'WhatsApp'}</strong>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-white sticky top-[73px] z-10">
              <button
                onClick={() => setDetailTab('overview')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  detailTab === 'overview' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Situation & Personal Touch
              </button>
              <button
                onClick={() => setDetailTab('what_they_said')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'what_they_said' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                What They Told Us ({activeContact.notes?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('emails')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'emails' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Emails ({activeContact.emails?.length || 0})
              </button>
              <button
                onClick={() => setDetailTab('deals')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'deals' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Deals & Quotes ({ (activeContact.deals?.length || 0) + (activeContact.quotes?.length || 0) })
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              
              {/* TAB 1: OVERVIEW & SITUATION */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* 1. CURRENT SITUATION SNAPSHOT */}
                  <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 p-4 rounded-2xl border border-purple-200/80 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-900 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Current Situation & Relationship Health
                      </span>
                      {activeContact.next_follow_up_date && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-purple-700 border border-purple-200">
                          Next Follow-Up: {activeContact.next_follow_up_date}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 text-xs leading-relaxed font-medium bg-white/70 p-3 rounded-xl border border-purple-100">
                      {activeContact.current_situation || 'No situation summary written yet. Click "Edit" to note what this client is currently working on, their hurdles, or project status.'}
                    </p>
                  </div>

                  {/* 2. PERSONAL TOUCH & SPECIAL DAYS */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Cake className="w-4 h-4 text-pink-500" />
                      Client Personal Profile & Special Days
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Birthday */}
                      <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100">
                        <span className="text-pink-600 flex items-center gap-1 text-[10px] uppercase font-extrabold">
                          <Cake className="w-3 h-3 text-pink-500" /> Birthday
                        </span>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {activeContact.date_of_birth ? activeContact.date_of_birth : 'Not entered'}
                        </div>
                        {activeContact.date_of_birth && (
                          <div className="text-[11px] text-pink-700 font-semibold mt-1">
                            {getDaysUntil(activeContact.date_of_birth)?.days === 0
                              ? 'Birthday Today'
                              : `In ${getDaysUntil(activeContact.date_of_birth)?.days} days (${getDaysUntil(activeContact.date_of_birth)?.formatted})`}
                          </div>
                        )}
                      </div>

                      {/* Special Day / Milestone */}
                      <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                        <span className="text-amber-700 flex items-center gap-1 text-[10px] uppercase font-extrabold">
                          <Sparkles className="w-3 h-3 text-amber-500" /> {activeContact.special_day_title || 'Special Milestone'}
                        </span>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {activeContact.special_day_date ? activeContact.special_day_date : 'Not entered'}
                        </div>
                        {activeContact.special_day_date && (
                          <div className="text-[11px] text-amber-800 font-semibold mt-1">
                            {getDaysUntil(activeContact.special_day_date)?.days === 0
                              ? 'Celebration Today'
                              : `In ${getDaysUntil(activeContact.special_day_date)?.days} days (${getDaysUntil(activeContact.special_day_date)?.formatted})`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Personal Interests & Hobbies */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Personal Interests & Hobbies</span>
                      <p className="text-slate-800 font-medium mt-1">
                        {activeContact.personal_interests || 'No interests noted. E.g. "Golf, avid runner, loves specialty espresso, Manchester United fan".'}
                      </p>
                    </div>
                  </div>

                  {/* 3. WHAT THEY TOLD US HIGHLIGHT */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-purple-600" />
                        Key Takeaways (What Client Told Us)
                      </h3>
                      <button
                        onClick={() => setDetailTab('what_they_said')}
                        className="text-[11px] font-bold text-purple-600 hover:underline"
                      >
                        View Full Conversation Log &rarr;
                      </button>
                    </div>
                    <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-slate-800 italic leading-relaxed">
                      "{activeContact.what_they_told_us || 'No initial quotes recorded. Use the "What They Told Us" tab to log call insights and meeting takeaways.'}"
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WHAT THEY TOLD US / CONVERSATION LOG */}
              {detailTab === 'what_they_said' && (
                <div className="space-y-4">
                  {/* Instant Log Input */}
                  <form onSubmit={handleAddQuickNote} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <label className="block text-slate-800 font-extrabold text-xs flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-purple-600" />
                      What did {activeContact.first_name} tell you today?
                    </label>
                    <textarea
                      rows={3}
                      value={quickSaidNote}
                      onChange={(e) => setQuickSaidNote(e.target.value)}
                      placeholder='e.g., "Mentioned they plan to expand to 20 sales reps by Q4. Prefers quick WhatsApp updates instead of long emails."'
                      className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:border-purple-500 outline-hidden leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingNote || !quickSaidNote.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Save to Client Memory
                      </button>
                    </div>
                  </form>

                  {/* Feed of what they said */}
                  <div className="space-y-2.5">
                    <h4 className="font-extrabold text-slate-900 text-xs">Conversation & Meeting History</h4>
                    {activeContact.notes?.length === 0 ? (
                      <p className="text-slate-400 italic text-xs">No conversation entries yet. Add the first one above!</p>
                    ) : (
                      activeContact.notes?.map((n) => (
                        <div key={n.id} className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              {n.note_category === 'client_said' && 'Client Said'}
                              {n.note_category === 'personal_update' && 'Personal Milestone'}
                              {n.note_category === 'general' && 'Note'}
                              {` • by ${n.created_by_name || 'Sales Rep'}`}
                            </span>
                            <span>{n.created_at}</span>
                          </div>
                          <p className="text-slate-800 text-xs leading-relaxed font-medium whitespace-pre-wrap">
                            {n.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: OUTBOUND EMAILS */}
              {detailTab === 'emails' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-xs">Email Correspondence</h4>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {activeContact.emails?.length || 0} messages dispatched
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEmailContactModal(activeContact)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Compose Email
                    </button>
                  </div>

                  {activeContact.emails?.length === 0 ? (
                    <p className="text-slate-400 italic text-xs">No emails recorded yet with this contact.</p>
                  ) : (
                    activeContact.emails?.map((em) => (
                      <div key={em.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-slate-900 text-xs">
                          <span>{em.subject}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            {em.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          To: {em.recipient_email} &bull; Sent {em.sent_at}
                        </div>
                        <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-mono text-[11px] whitespace-pre-wrap">
                          {em.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: DEALS & QUOTES */}
              {detailTab === 'deals' && (
                <div className="space-y-4">
                  {/* Deals */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs mb-2">Associated Deals</h4>
                    <div className="space-y-2">
                      {activeContact.deals?.map(d => (
                        <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{d.name}</div>
                            <div className="text-[11px] text-slate-500">Stage: {d.stage} &bull; Close: {d.closing_date}</div>
                          </div>
                          <span className="font-extrabold text-slate-900 font-mono">${Number(d.amount).toLocaleString()}</span>
                        </div>
                      ))}
                      {activeContact.deals?.length === 0 && (
                        <p className="text-slate-400 italic text-xs">No active deals tagged to this contact.</p>
                      )}
                    </div>
                  </div>

                  {/* Quotes */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs mb-2">Quotes & Invoices</h4>
                    <div className="space-y-2">
                      {activeContact.quotes?.map(q => (
                        <div key={q.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{q.quote_number} &bull; {q.subject}</div>
                            <div className="text-[11px] text-slate-500">{q.doc_type || 'Quotation'} &bull; Stage: {q.quote_stage}</div>
                          </div>
                          <span className="font-extrabold text-slate-900 font-mono">${Number(q.grand_total).toLocaleString()}</span>
                        </div>
                      ))}
                      {activeContact.quotes?.length === 0 && (
                        <p className="text-slate-400 italic text-xs">No documents generated yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                onClick={() => handleDeleteContact(activeContact.id)}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Contact
              </button>
              <button
                onClick={() => setActiveContact(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE & EDIT CONTACT MODAL */}
      {/* ============================================================ */}
      {(isCreatingContact || isEditingContact) && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCreatingContact(false);
              setIsEditingContact(false);
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden cursor-default">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {isCreatingContact ? 'Add New Customer Contact' : `Edit Contact: ${activeContact?.first_name} ${activeContact?.last_name}`}
                </h3>
                <p className="text-xs text-slate-500">Record customer personal details, what they told you, and current situation.</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreatingContact(false); setIsEditingContact(false); }}
                aria-label="Close modal"
                title="Close (Esc)"
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-white">
              <button
                type="button"
                onClick={() => setFormTab('basic')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  formTab === 'basic' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Basic & Company
              </button>
              <button
                type="button"
                onClick={() => setFormTab('situation')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  formTab === 'situation' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Situation & Health
              </button>
              <button
                type="button"
                onClick={() => setFormTab('personal')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  formTab === 'personal' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Personal & Special Days
              </button>
              <button
                type="button"
                onClick={() => setFormTab('insights')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                  formTab === 'insights' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                4. What They Told Us
              </button>
            </div>

            <form onSubmit={isCreatingContact ? handleCreateSubmit : handleEditSubmit} className="p-6 space-y-4 text-xs">
              
              {/* TAB 1: BASIC INFO */}
              {formTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={isCreatingContact ? formData.first_name : editFormData.first_name || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, first_name: v });
                          else setEditFormData({ ...editFormData, first_name: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={isCreatingContact ? formData.last_name : editFormData.last_name || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, last_name: v });
                          else setEditFormData({ ...editFormData, last_name: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Organization / Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={isCreatingContact ? formData.account_name : editFormData.account_name || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isCreatingContact) setFormData({ ...formData, account_name: v });
                        else setEditFormData({ ...editFormData, account_name: v });
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Job Title</label>
                      <input
                        type="text"
                        placeholder="e.g. VP Operations"
                        value={isCreatingContact ? formData.title : editFormData.title || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, title: v });
                          else setEditFormData({ ...editFormData, title: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Department</label>
                      <input
                        type="text"
                        placeholder="e.g. Procurement"
                        value={isCreatingContact ? formData.department : editFormData.department || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, department: v });
                          else setEditFormData({ ...editFormData, department: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Work Email</label>
                      <input
                        type="email"
                        value={isCreatingContact ? formData.email : editFormData.email || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, email: v });
                          else setEditFormData({ ...editFormData, email: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Phone / WhatsApp Number</label>
                      <input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        value={isCreatingContact ? formData.phone : editFormData.phone || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, phone: v });
                          else setEditFormData({ ...editFormData, phone: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SITUATION & RELATIONSHIP HEALTH */}
              {formTab === 'situation' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Relationship Health</label>
                      <select
                        value={isCreatingContact ? formData.relationship_health : editFormData.relationship_health || 'Strong & Warm'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, relationship_health: v });
                          else setEditFormData({ ...editFormData, relationship_health: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      >
                        <option value="VIP Champion">VIP Champion (Key Advocate)</option>
                        <option value="Strong & Warm">Strong & Warm (Reliable)</option>
                        <option value="Positive">Positive (Good)</option>
                        <option value="Needs Attention">Needs Attention (Follow-up needed)</option>
                        <option value="At Risk">At Risk (Competitor / Unhappy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Next Follow-Up Date</label>
                      <input
                        type="date"
                        value={isCreatingContact ? formData.next_follow_up_date : editFormData.next_follow_up_date || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, next_follow_up_date: v });
                          else setEditFormData({ ...editFormData, next_follow_up_date: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Current Situation Overview (What is happening right now?)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Explain where things stand. e.g., 'Evaluating pilot contract for Q4 rollout. Waiting for board approval next Tuesday. Highly likes Telegram ordering.'"
                      value={isCreatingContact ? formData.current_situation : editFormData.current_situation || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isCreatingContact) setFormData({ ...formData, current_situation: v });
                        else setEditFormData({ ...editFormData, current_situation: v });
                      }}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: PERSONAL TOUCH & SPECIAL DAYS */}
              {formTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Date of Birth (Birthday)</label>
                      <input
                        type="date"
                        value={isCreatingContact ? formData.date_of_birth : editFormData.date_of_birth || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, date_of_birth: v });
                          else setEditFormData({ ...editFormData, date_of_birth: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Used for automated birthday alerts</span>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Preferred Communication</label>
                      <select
                        value={isCreatingContact ? formData.preferred_communication : editFormData.preferred_communication || 'WhatsApp'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, preferred_communication: v });
                          else setEditFormData({ ...editFormData, preferred_communication: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      >
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Phone Call">Phone Call</option>
                        <option value="Email">Email</option>
                        <option value="Telegram">Telegram</option>
                        <option value="In-Person">In-Person Meeting</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Special Day Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Company Anniversary, Promotion"
                        value={isCreatingContact ? formData.special_day_title : editFormData.special_day_title || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, special_day_title: v });
                          else setEditFormData({ ...editFormData, special_day_title: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Special Day Date</label>
                      <input
                        type="date"
                        value={isCreatingContact ? formData.special_day_date : editFormData.special_day_date || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCreatingContact) setFormData({ ...formData, special_day_date: v });
                          else setEditFormData({ ...editFormData, special_day_date: v });
                        }}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Personal Interests, Hobbies & Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 'Avid runner, loves espresso, watches Premier League, son plays junior tennis.'"
                      value={isCreatingContact ? formData.personal_interests : editFormData.personal_interests || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isCreatingContact) setFormData({ ...formData, personal_interests: v });
                        else setEditFormData({ ...editFormData, personal_interests: v });
                      }}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: WHAT THEY TOLD US */}
              {formTab === 'insights' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      What did they tell you about? (Key Client Voice / Pain Points)
                    </label>
                    <textarea
                      rows={5}
                      placeholder='e.g., "Told us their biggest pain point is losing customer personal notes like birthdays and meeting takeaways across spreadsheets. Wants something clean and easy to use."'
                      value={isCreatingContact ? formData.what_they_told_us : editFormData.what_they_told_us || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isCreatingContact) setFormData({ ...formData, what_they_told_us: v });
                        else setEditFormData({ ...editFormData, what_they_told_us: v });
                      }}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-200">
                <div className="flex gap-2">
                  {formTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formTab === 'insights') setFormTab('personal');
                        else if (formTab === 'personal') setFormTab('situation');
                        else if (formTab === 'situation') setFormTab('basic');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                    >
                      &larr; Back
                    </button>
                  )}
                  {formTab !== 'insights' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formTab === 'basic') setFormTab('situation');
                        else if (formTab === 'situation') setFormTab('personal');
                        else if (formTab === 'personal') setFormTab('insights');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                    >
                      Next Step &rarr;
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsCreatingContact(false); setIsEditingContact(false); }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
                  >
                    {isCreatingContact ? 'Save Contact Dossier' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMART CONTACT EMAIL DISPATCH MODAL */}
      {emailingContact && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailingContact(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-fade-in cursor-default">
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">ABADI GURU Smart Contact Emailer</h3>
                  <div className="text-xs text-slate-300">
                    To: {emailingContact.first_name} {emailingContact.last_name} &bull; {emailingContact.account_name || 'Client'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailingContact(null)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendContactEmailSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-700">
                <div>
                  <span className="font-bold block text-slate-900 text-xs">{emailingContact.first_name} {emailingContact.last_name}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{emailingContact.email}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {emailingContact.relationship_health || 'Client'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Template</label>
                <select
                  value={emailForm.template_name}
                  onChange={(e) => {
                    const tmpl = templates.find(t => t.name === e.target.value);
                    if (tmpl) {
                      const rendered = tmpl.body
                        .replace(/{{name}}/g, emailingContact.first_name)
                        .replace(/{{company}}/g, emailingContact.account_name || 'your company');
                      setEmailForm({
                        subject: tmpl.subject,
                        body: rendered,
                        template_name: tmpl.name,
                      });
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden font-medium"
                >
                  <option value="">Custom / Freeform Email</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Message Body *</label>
                <textarea
                  rows={5}
                  required
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-sans leading-relaxed text-slate-700"
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
                      Records entry in contact activity timeline
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEmailingContact(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs flex items-center gap-1.5 transition-colors"
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

      {/* WhatsApp Sales Connect Modal */}
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
