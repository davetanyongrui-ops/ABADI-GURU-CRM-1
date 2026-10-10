import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Printer,
  Download,
  Building2,
  User,
  DollarSign,
  ChevronRight,
  X,
  Trash2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Layers,
  Truck,
  Receipt,
  FileText,
  ArrowRight,
  ShieldCheck,
  Check,
  Mail,
  Send,
  RefreshCw,
  Share2,
  Copy,
  MessageCircle,
  Link as LinkIcon
} from 'lucide-react';
import { crmApi } from '../api';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';

const QUOTE_STAGES = ['Draft', 'Delivered', 'On Hold', 'Confirmed', 'Closed Won', 'Closed Lost'];

export default function QuotesView({ navParams }) {
  const [quotes, setQuotes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [products, setProducts] = useState([]);
  const [branding, setBranding] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all'); // 'all' | 'Quotation' | 'Delivery Order' | 'Invoice'

  // Modals
  const [isCreating, setIsCreating] = useState(false);
  const [printableQuote, setPrintableQuote] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [emailModalDoc, setEmailModalDoc] = useState(null);
  const [emailDocForm, setEmailDocForm] = useState({ recipient_email: '', custom_message: '' });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [whatsAppModalData, setWhatsAppModalData] = useState(null);

  const handleCopyShareLink = (q) => {
    const token = q.share_token || q.id;
    const url = `${window.location.origin}/portal/doc/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedTokenId(q.id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Document Form
  const [quoteForm, setQuoteForm] = useState({
    doc_type: 'Quotation',
    subject: '',
    account_id: '',
    account_name: '',
    contact_id: '',
    contact_name: '',
    deal_id: '',
    deal_name: '',
    quote_stage: 'Draft',
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    tracking_number: '',
    recipient_address: '',
    customer_po_number: '',
    discount_percent: 0,
    tax_percent: 8.0,
    terms_conditions: '',
    description: '',
    items: [
      { product_id: '', product_name: '', unit_price: 1200, quantity: 1, discount_percent: 0 }
    ]
  });

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [qs, accs, cons, dls, prods, bnd] = await Promise.all([
        crmApi.getQuotes(),
        crmApi.getAccounts(),
        crmApi.getContacts(),
        crmApi.getDeals(),
        crmApi.getProducts(),
        crmApi.getBrandingSettings().catch(() => ({}))
      ]);
      setQuotes(qs);
      setAccounts(accs);
      setContacts(cons);
      setDeals(dls);
      setProducts(prods);
      setBranding(bnd || {});
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (printableQuote) setPrintableQuote(null);
        if (emailModalDoc) setEmailModalDoc(null);
        if (isCreating) setIsCreating(false);
        if (whatsAppModalData) setWhatsAppModalData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printableQuote, emailModalDoc, isCreating, whatsAppModalData]);

  useEffect(() => {
    loadData();

    // Auto-fill form if initiated from a Deal
    if (navParams?.createFromDeal) {
      const d = navParams.createFromDeal;
      const targetDocType = navParams.docType || 'Invoice';
      const isQuote = targetDocType === 'Quotation';
      setQuoteForm({
        doc_type: targetDocType,
        subject: isQuote ? `Price Quotation - ${d.name}` : `Sales Invoice - ${d.name}`,
        account_id: d.account_id || '',
        account_name: d.account_name || '',
        contact_id: d.contact_id || '',
        contact_name: d.contact_name || '',
        deal_id: d.id,
        deal_name: d.name,
        quote_stage: isQuote ? 'Draft' : 'Confirmed',
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        delivery_date: new Date().toISOString().split('T')[0],
        tracking_number: '',
        recipient_address: '',
        customer_po_number: '',
        discount_percent: 0,
        tax_percent: 8.0,
        terms_conditions: isQuote
          ? (branding.quote_default_terms || 'Quotation valid for 30 days from date of issue.')
          : (branding.invoice_default_terms || 'Payment net 30 days. Wire transfer to bank accounts specified.'),
        description: `Generated from Sales Pipeline Deal: ${d.name}`,
        items: [
          { product_id: '', product_name: d.name, unit_price: Number(d.amount) || 1000, quantity: 1, discount_percent: 0 }
        ]
      });
      setIsCreating(true);
    }

    // Auto-sync in background so invoices generated via Telegram or AI appear instantly
    const timer = setInterval(() => {
      crmApi.getQuotes().then(qs => setQuotes(qs)).catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [navParams]);

  const currency = branding.currency_symbol || '$';

  const openPrintableQuote = async (id) => {
    try {
      const full = await crmApi.getQuote(id);
      setPrintableQuote(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStage = async (id, stage) => {
    try {
      await crmApi.updateQuoteStage(id, stage);
      loadData(true);
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await crmApi.deleteQuote(id);
      loadData(true);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Convert Quote -> Delivery Order
  const handleConvertToDo = async (id) => {
    try {
      setConvertingId(id);
      const created = await crmApi.convertQuoteToDo(id);
      await loadData(true);
      alert(`Successfully converted to Delivery Order #${created.quote_number}!`);
    } catch (err) {
      alert('Error converting to Delivery Order: ' + err.message);
    } finally {
      setConvertingId(null);
    }
  };

  // Convert Quote or DO -> Tax Invoice
  const handleConvertToInvoice = async (id) => {
    try {
      setConvertingId(id);
      const created = await crmApi.convertQuoteToInvoice(id);
      await loadData(true);
      alert(`Successfully converted to Tax Invoice #${created.quote_number}!`);
    } catch (err) {
      alert('Error converting to Invoice: ' + err.message);
    } finally {
      setConvertingId(null);
    }
  };

  // Email Branded Document with attached PDF
  const openEmailDocModal = (doc) => {
    // Match linked contact or account to discover recipient email
    const linkedContact = contacts.find(c => c.id === doc.contact_id || `${c.first_name} ${c.last_name}`.toLowerCase() === (doc.contact_name || '').toLowerCase());
    const linkedAccount = accounts.find(a => a.id === doc.account_id || a.name?.toLowerCase() === (doc.account_name || '').toLowerCase());
    const defaultEmail = linkedContact?.email || linkedAccount?.email || '';

    setEmailModalDoc(doc);
    setEmailDocForm({
      recipient_email: defaultEmail,
      custom_message: `Dear ${doc.contact_name || doc.account_name || 'Valued Client'},\n\nPlease find attached the official ${doc.doc_type || 'document'} #${doc.quote_number} for your company's records and processing.\n\nSummary:\n• Reference: ${doc.quote_number}\n• Total: ${currency}${Number(doc.grand_total).toLocaleString()}\n• Status: ${doc.quote_stage}\n\nFeel free to contact us if you have any questions or require revisions.\n\nWarm regards,\n${branding.company_name || 'ABADI GURU CRM Sales Operations'}`,
    });
    setEmailResult(null);
  };

  const handleSendDocumentEmail = async (e) => {
    e.preventDefault();
    if (!emailModalDoc || !emailDocForm.recipient_email) return;

    try {
      setIsSendingEmail(true);
      const res = await crmApi.emailQuote(emailModalDoc.id, {
        recipient_email: emailDocForm.recipient_email,
        custom_message: emailDocForm.custom_message,
      });
      setEmailResult(res);
      await loadData(true);
    } catch (err) {
      alert('Failed to send document email: ' + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Line item handlers
  const handleAddItem = () => {
    setQuoteForm({
      ...quoteForm,
      items: [
        ...quoteForm.items,
        { product_id: '', product_name: '', unit_price: 0, quantity: 1, discount_percent: 0 }
      ]
    });
  };

  const handleRemoveItem = (index) => {
    if (quoteForm.items.length <= 1) return;
    setQuoteForm({
      ...quoteForm,
      items: quoteForm.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...quoteForm.items];
    newItems[index][field] = value;

    if (field === 'product_id') {
      const prod = products.find(p => p.id === Number(value));
      if (prod) {
        newItems[index].product_name = prod.name;
        newItems[index].unit_price = prod.unit_price;
      }
    }

    setQuoteForm({ ...quoteForm, items: newItems });
  };

  // Compute live subtotal & grand total for modal
  const liveSubtotal = quoteForm.items.reduce((sum, itm) => {
    const p = Number(itm.unit_price) || 0;
    const q = Number(itm.quantity) || 1;
    const d = Number(itm.discount_percent) || 0;
    return sum + (p * q * (1 - d / 100));
  }, 0);

  const liveTotalAfterDiscount = liveSubtotal * (1 - (Number(quoteForm.discount_percent) || 0) / 100);
  const liveTax = liveTotalAfterDiscount * ((Number(quoteForm.tax_percent) || 0) / 100);
  const liveGrandTotal = Math.round((liveTotalAfterDiscount + liveTax) * 100) / 100;

  const handleOpenCreateModal = (type = 'Quotation') => {
    const defaultTerms = type === 'Delivery Order'
      ? (branding.do_default_terms || 'Goods received in good order and condition. Please sign and return duplicate copy.')
      : (type === 'Invoice'
        ? (branding.invoice_default_terms || 'Payment due within 30 days. Wire transfer to bank accounts specified.')
        : (branding.quote_default_terms || 'Quotation valid for 30 days from date of issue. Prices subject to delivery terms.'));

    setQuoteForm({
      doc_type: type,
      subject: '',
      account_id: '',
      account_name: '',
      contact_id: '',
      contact_name: '',
      deal_id: '',
      deal_name: '',
      quote_stage: type === 'Invoice' ? 'Confirmed' : (type === 'Delivery Order' ? 'Delivered' : 'Draft'),
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0],
      tracking_number: '',
      recipient_address: '',
      customer_po_number: '',
      discount_percent: 0,
      tax_percent: Number(branding.invoice_default_tax) || 8.0,
      terms_conditions: defaultTerms,
      description: '',
      items: [
        { product_id: '', product_name: '', unit_price: 1000, quantity: 1, discount_percent: 0 }
      ]
    });
    setIsCreating(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createQuote(quoteForm);
      setIsCreating(false);
      loadData(true);
    } catch (err) {
      alert('Error creating document: ' + err.message);
    }
  };

  // Filtered documents
  const filteredQuotes = quotes.filter(q => {
    const matchesDocType = docTypeFilter === 'all' || (q.doc_type || (q.quote_number?.startsWith('DO-') ? 'Delivery Order' : (q.quote_number?.startsWith('INV-') ? 'Invoice' : 'Quotation'))) === docTypeFilter;
    const matchesSearch = !search ||
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.subject?.toLowerCase().includes(search.toLowerCase()) ||
      q.account_name?.toLowerCase().includes(search.toLowerCase());
    return matchesDocType && matchesSearch;
  });

  const countQuotes = quotes.filter(q => (q.doc_type || 'Quotation') === 'Quotation').length;
  const countDOs = quotes.filter(q => q.doc_type === 'Delivery Order' || q.quote_number?.startsWith('DO-')).length;
  const countInvoices = quotes.filter(q => q.doc_type === 'Invoice' || q.quote_number?.startsWith('INV-')).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Quotes, Delivery Orders & Invoices</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
              Full Lifecycle
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete sales execution: create Quotations, convert to Delivery Orders (DO), and issue final Tax Invoices with custom branding.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={crmApi.getExportUrl('quotes')}
            download="abadi_guru_documents_export.csv"
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs border border-slate-200 transition-colors flex items-center gap-1.5"
            title="Export all quotes, DOs, and invoices to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </a>
          <button
            onClick={() => handleOpenCreateModal('Quotation')}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Quotation
          </button>
          <button
            onClick={() => handleOpenCreateModal('Delivery Order')}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4" /> New Delivery Order
          </button>
          <button
            onClick={() => handleOpenCreateModal('Invoice')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setDocTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              docTypeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Documents ({quotes.length})
          </button>
          <button
            onClick={() => setDocTypeFilter('Quotation')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              docTypeFilter === 'Quotation'
                ? 'bg-white text-sky-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Quotations</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-bold">{countQuotes}</span>
          </button>
          <button
            onClick={() => setDocTypeFilter('Delivery Order')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              docTypeFilter === 'Delivery Order'
                ? 'bg-white text-teal-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Delivery Orders</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 font-bold">{countDOs}</span>
          </button>
          <button
            onClick={() => setDocTypeFilter('Invoice')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              docTypeFilter === 'Invoice'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Tax Invoices</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">{countInvoices}</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search document #, subject, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-rose-500 outline-hidden"
          />
        </div>
      </div>

      {/* Table of Documents */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading billing documents...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No documents found</h3>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filter or create a new Quotation, DO, or Invoice above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Doc Type & #</th>
                  <th className="py-3 px-4">Subject & Reference</th>
                  <th className="py-3 px-4">Client Organization</th>
                  <th className="py-3 px-4">Stage / Status</th>
                  <th className="py-3 px-4">Date / Due</th>
                  <th className="py-3 px-4 text-right">Amount ({currency})</th>
                  <th className="py-3 px-4 text-right">Actions & Lifecycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredQuotes.map((q) => {
                  const resolvedType = q.doc_type || (q.quote_number?.startsWith('DO-') ? 'Delivery Order' : (q.quote_number?.startsWith('INV-') ? 'Invoice' : 'Quotation'));
                  const isQuotation = resolvedType === 'Quotation';
                  const isDO = resolvedType === 'Delivery Order';
                  const isInvoice = resolvedType === 'Invoice';

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Document Type & Number */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isQuotation && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                              Quotation
                            </span>
                          )}
                          {isDO && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                              Delivery Order
                            </span>
                          )}
                          {isInvoice && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Tax Invoice
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => openPrintableQuote(q.id)}
                          className="font-mono font-bold text-slate-900 hover:text-rose-600 hover:underline"
                        >
                          {q.quote_number}
                        </button>
                      </td>

                      {/* Subject & Reference */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{q.subject}</div>
                        {q.parent_doc_number ? (
                          <div className="text-[11px] text-indigo-600 font-medium flex items-center gap-1 mt-0.5">
                            <span>↳ Ref:</span>
                            <span className="font-mono font-bold">{q.parent_doc_number}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">{q.deal_name || 'Direct Billing'}</div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {q.account_name || 'Client Account'}
                        {q.contact_name && <div className="text-[11px] text-slate-400 font-normal">Attn: {q.contact_name}</div>}
                      </td>

                      {/* Stage dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={q.quote_stage}
                          onChange={(e) => handleUpdateStage(q.id, e.target.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-transparent outline-hidden ${
                            q.quote_stage === 'Confirmed' || q.quote_stage === 'Closed Won'
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.quote_stage === 'Delivered'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {QUOTE_STAGES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        {q.accepted_at && (
                          <div className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1" title={`Digitally signed by ${q.accepted_by} on ${q.accepted_at}`}>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[110px]">Signed: {q.accepted_by || 'Client'}</span>
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {isDO ? (q.delivery_date || q.created_at?.split(' ')[0]) : (q.valid_until || q.created_at?.split(' ')[0])}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm font-mono">
                        {currency}{Number(q.grand_total).toLocaleString()}
                      </td>

                      {/* Actions & Lifecycle Conversion */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1-Click Copy Public Customer Portal Link */}
                          <button
                            onClick={() => handleCopyShareLink(q)}
                            className={`px-2 py-1 font-bold rounded text-[11px] flex items-center gap-1 transition-colors border ${
                              copiedTokenId === q.id
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                            title="Copy shareable customer portal review & signature link"
                          >
                            {copiedTokenId === q.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3 h-3 text-slate-600" /> Share
                              </>
                            )}
                          </button>

                          {/* WhatsApp Direct Share */}
                          <button
                            onClick={() => {
                              const contact = contacts.find(c => c.id === q.contact_id || c.account_id === q.account_id);
                              setWhatsAppModalData({
                                recipient: {
                                  name: q.contact_name || q.account_name,
                                  first_name: q.contact_name || q.account_name,
                                  company: q.account_name,
                                  phone: contact?.phone || contact?.mobile || '',
                                  id: q.contact_id || q.account_id,
                                  type: q.contact_id ? 'contact' : 'account'
                                },
                                template: isQuotation ? 'quote' : 'invoice',
                                extra: {
                                  quote_number: q.quote_number,
                                  grand_total: q.grand_total,
                                  share_token: q.share_token,
                                  due_date: q.valid_until
                                }
                              });
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] flex items-center gap-1 border border-emerald-200"
                            title="Send document portal link via WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" /> WhatsApp
                          </button>

                          {/* Conversion buttons */}
                          {isQuotation && (
                            <>
                              <button
                                onClick={() => handleConvertToDo(q.id)}
                                disabled={convertingId === q.id}
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded text-[11px] flex items-center gap-1 border border-teal-200"
                                title="Convert Quotation to Delivery Order"
                              >
                                <Truck className="w-3 h-3 text-teal-600" /> Convert to DO
                              </button>
                              <button
                                onClick={() => handleConvertToInvoice(q.id)}
                                disabled={convertingId === q.id}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] flex items-center gap-1 border border-emerald-200"
                                title="Convert Quotation to Tax Invoice"
                              >
                                <Receipt className="w-3 h-3 text-emerald-600" /> To Invoice
                              </button>
                            </>
                          )}

                          {isDO && (
                            <button
                              onClick={() => handleConvertToInvoice(q.id)}
                              disabled={convertingId === q.id}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] flex items-center gap-1 border border-emerald-200"
                              title="Convert Delivery Order to Tax Invoice"
                            >
                              <Receipt className="w-3 h-3 text-emerald-600" /> To Invoice
                            </button>
                          )}

                          {/* PDF Download Button */}
                          <a
                            href={`/api/quotes/${q.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            download={`${resolvedType}-${q.quote_number}.pdf`}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] flex items-center gap-1"
                            title="Download Branded PDF"
                          >
                            <Download className="w-3 h-3 text-slate-600" /> PDF
                          </a>

                          {/* Email PDF directly to Client */}
                          <button
                            onClick={() => openEmailDocModal(q)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[11px] flex items-center gap-1 border border-indigo-200"
                            title="Email official PDF directly to client"
                          >
                            <Mail className="w-3 h-3 text-indigo-600" /> Email
                          </button>

                          {/* Print / Preview Modal */}
                          <button
                            onClick={() => openPrintableQuote(q.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] flex items-center gap-1"
                            title="Print / View"
                          >
                            <Printer className="w-3 h-3 text-slate-500" /> Print
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINTABLE / VIEW MODAL WITH CUSTOM BRANDING & ADAPTIVE DOC TYPE */}
      {printableQuote && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintableQuote(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8 cursor-default">
            {/* Top Bar with Print & Download */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="font-bold text-xs flex items-center gap-2">
                <span>Official Document:</span>
                <span className="font-mono text-amber-400">{printableQuote.quote_number}</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/quotes/${printableQuote.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  download={`${printableQuote.doc_type || 'Document'}-${printableQuote.quote_number}.pdf`}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const doc = printableQuote;
                    setPrintableQuote(null);
                    openEmailDocModal(doc);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" /> Email to Client
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableQuote(null)}
                  title="Close (Esc)"
                  aria-label="Close"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 sm:p-12 text-slate-900 space-y-8 bg-white" id="printable-quote-body">
              {/* Header Banner */}
              <div className="flex items-start justify-between border-b pb-6 border-slate-200">
                <div className="flex items-center gap-4">
                  {branding.company_logo ? (
                    <img
                      src={branding.company_logo}
                      alt="Logo"
                      className="max-h-14 max-w-36 object-contain rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 flex items-center justify-center text-white font-black text-lg">
                      AG
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">
                      {branding.company_name || 'ABADI GURU CRM ENTERPRISE'}
                    </h2>
                    {branding.company_reg_no && (
                      <p className="text-xs text-slate-500 font-mono">Reg: {branding.company_reg_no}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {branding.company_address || 'Level 28, Tower 1, Business Financial District'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-2xl font-black tracking-tight ${
                    printableQuote.doc_type === 'Delivery Order'
                      ? 'text-teal-600'
                      : printableQuote.doc_type === 'Invoice'
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    {printableQuote.doc_type === 'Delivery Order' ? 'DELIVERY ORDER' : (printableQuote.doc_type === 'Invoice' ? 'TAX INVOICE' : 'PRICE QUOTE')}
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-700 mt-1">{printableQuote.quote_number}</div>
                  {printableQuote.parent_doc_number && (
                    <div className="text-xs text-indigo-600 font-semibold">Ref: {printableQuote.parent_doc_number}</div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">Date: {printableQuote.created_at?.split(' ')[0] || new Date().toISOString().split('T')[0]}</div>
                </div>
              </div>

              {/* Client & Metadata Info */}
              <div className="grid grid-cols-2 gap-8 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {printableQuote.doc_type === 'Delivery Order' ? 'Deliver To (Client)' : (printableQuote.doc_type === 'Invoice' ? 'Billed To (Client)' : 'Prepared For (Client)')}
                  </span>
                  <div className="font-extrabold text-slate-900 text-sm">{printableQuote.account_name}</div>
                  <div className="text-slate-600 mt-0.5">Attn: {printableQuote.contact_name || 'Authorized Representative'}</div>
                  <div className="text-slate-500 mt-1">
                    {printableQuote.recipient_address || printableQuote.billing_street || 'Corporate Office'}
                    {printableQuote.billing_city && <span>, {printableQuote.billing_city}</span>}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Document Details
                  </span>
                  <div><strong className="text-slate-700">Subject:</strong> {printableQuote.subject}</div>
                  {printableQuote.doc_type === 'Delivery Order' ? (
                    <>
                      <div><strong className="text-slate-700">Delivery Date:</strong> {printableQuote.delivery_date || 'Immediate'}</div>
                      <div><strong className="text-slate-700">Tracking / Courier:</strong> {printableQuote.tracking_number || 'Fleet Dispatch'}</div>
                      <div><strong className="text-slate-700">Status:</strong> {printableQuote.quote_stage}</div>
                    </>
                  ) : (
                    <>
                      <div><strong className="text-slate-700">Valid / Due Date:</strong> {printableQuote.valid_until}</div>
                      <div><strong className="text-slate-700">Representative:</strong> {printableQuote.owner_name}</div>
                      <div><strong className="text-slate-700">Current Stage:</strong> {printableQuote.quote_stage}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Item Description / Specification</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Unit Price ({currency})</th>
                      <th className="py-2.5 px-4 text-right">Total ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {printableQuote.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {item.product_name}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {Number(item.unit_price).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          {Number(item.line_total).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">{currency}{Number(printableQuote.subtotal).toLocaleString()}</span>
                  </div>
                  {printableQuote.discount_percent > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount ({printableQuote.discount_percent}%):</span>
                      <span className="font-mono font-bold">
                        -{currency}{Math.round(printableQuote.subtotal * (printableQuote.discount_percent / 100)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({printableQuote.tax_percent}%):</span>
                    <span className="font-mono font-bold">
                      {currency}{Math.round((printableQuote.subtotal * (1 - (printableQuote.discount_percent || 0) / 100)) * (printableQuote.tax_percent / 100)).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-rose-600 font-mono">{currency}{Number(printableQuote.grand_total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Sections customized per document type */}
              {printableQuote.doc_type === 'Delivery Order' ? (
                <div className="p-6 bg-slate-50 border border-slate-300 rounded-xl space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">GOODS RECEIVED IN GOOD ORDER & SATISFACTORY CONDITION</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{printableQuote.terms_conditions || branding.do_default_terms}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-12 pt-6">
                    <div className="border-t border-slate-400 pt-2 text-[11px]">
                      <span className="font-bold text-slate-800 block">Delivered By (Driver / Dispatcher)</span>
                      <span className="text-slate-500">Signature & Date</span>
                    </div>
                    <div className="border-t border-slate-400 pt-2 text-[11px]">
                      <span className="font-bold text-slate-800 block">Received By (Customer Chop & Signature)</span>
                      <span className="text-slate-500">Name / NRIC: _________________ Date: ________</span>
                    </div>
                  </div>
                </div>
              ) : printableQuote.doc_type === 'Invoice' ? (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Payment Instructions & Bank Remittance</h4>
                  <div className="grid grid-cols-2 gap-4 text-slate-700">
                    <div><strong>Bank:</strong> {branding.invoice_bank_name || 'Corporate Account'}</div>
                    <div><strong>Account No:</strong> <span className="font-mono font-bold">{branding.invoice_bank_account_no || 'Contact Finance'}</span></div>
                    <div><strong>Account Name:</strong> {branding.invoice_bank_account_name || branding.company_name}</div>
                    {branding.invoice_swift_code && <div><strong>SWIFT / Code:</strong> {branding.invoice_swift_code}</div>}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    {printableQuote.terms_conditions || branding.invoice_default_terms || 'Payment due within 30 days. Please quote invoice number upon remittance.'}
                  </p>
                </div>
              ) : (
                <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-4">
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Quotation Terms & Conditions:</span>
                    <p>{printableQuote.terms_conditions || branding.quote_default_terms}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-12 pt-8">
                    <div className="border-t border-slate-300 pt-2">
                      <span className="font-bold text-slate-700 block">Authorized Representative Signature</span>
                      <span className="text-[10px] text-slate-400">{branding.company_name || 'Abadi Guru Enterprise Inc.'}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-2">
                      <span className="font-bold text-slate-700 block">Client Acceptance Signature & Date</span>
                      <span className="text-[10px] text-slate-400">{printableQuote.account_name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE DOCUMENT MODAL */}
      {isCreating && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreating(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-6 cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900">
                  Create {quoteForm.doc_type}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-600">
                  {quoteForm.doc_type}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
              {/* Document Type Selector */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Document Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuoteForm({ ...quoteForm, doc_type: 'Quotation' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      quoteForm.doc_type === 'Quotation'
                        ? 'border-sky-500 bg-sky-50 text-sky-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Price Quotation
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteForm({ ...quoteForm, doc_type: 'Delivery Order' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      quoteForm.doc_type === 'Delivery Order'
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Delivery Order (DO)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteForm({ ...quoteForm, doc_type: 'Invoice' })}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all ${
                      quoteForm.doc_type === 'Invoice'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Official Tax Invoice
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Subject / Description Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud License + Installation Package"
                  value={quoteForm.subject}
                  onChange={(e) => setQuoteForm({ ...quoteForm, subject: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Account *</label>
                  <select
                    required
                    value={quoteForm.account_id}
                    onChange={(e) => {
                      const sel = accounts.find(a => a.id === Number(e.target.value));
                      setQuoteForm({
                        ...quoteForm,
                        account_id: e.target.value,
                        account_name: sel ? sel.name : '',
                        recipient_address: sel ? `${sel.billing_city || ''} ${sel.billing_state || ''}` : ''
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  >
                    <option value="">Select Company...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
                  <select
                    value={quoteForm.contact_id}
                    onChange={(e) => {
                      const sel = contacts.find(c => c.id === Number(e.target.value));
                      setQuoteForm({
                        ...quoteForm,
                        contact_id: e.target.value,
                        contact_name: sel ? `${sel.first_name} ${sel.last_name}` : ''
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  >
                    <option value="">Select Contact...</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Link Deal (Optional)</label>
                  <select
                    value={quoteForm.deal_id}
                    onChange={(e) => {
                      const sel = deals.find(d => d.id === Number(e.target.value));
                      setQuoteForm({
                        ...quoteForm,
                        deal_id: e.target.value,
                        deal_name: sel ? sel.name : ''
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                  >
                    <option value="">Link Pipeline Deal...</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Conditional Details based on Doc Type */}
              {quoteForm.doc_type === 'Delivery Order' ? (
                <div className="grid grid-cols-3 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
                  <div>
                    <label className="block text-teal-800 font-semibold mb-1">Delivery Date</label>
                    <input
                      type="date"
                      value={quoteForm.delivery_date}
                      onChange={(e) => setQuoteForm({ ...quoteForm, delivery_date: e.target.value })}
                      className="w-full p-2 bg-white border border-teal-200 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-teal-800 font-semibold mb-1">Tracking / Fleet</label>
                    <input
                      type="text"
                      placeholder="e.g. Courier AB12345 / Van #2"
                      value={quoteForm.tracking_number}
                      onChange={(e) => setQuoteForm({ ...quoteForm, tracking_number: e.target.value })}
                      className="w-full p-2 bg-white border border-teal-200 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-teal-800 font-semibold mb-1">Recipient Destination</label>
                    <input
                      type="text"
                      placeholder="Delivery site or address"
                      value={quoteForm.recipient_address}
                      onChange={(e) => setQuoteForm({ ...quoteForm, recipient_address: e.target.value })}
                      className="w-full p-2 bg-white border border-teal-200 rounded-lg outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      {quoteForm.doc_type === 'Invoice' ? 'Payment Due Date' : 'Valid Until'}
                    </label>
                    <input
                      type="date"
                      value={quoteForm.valid_until}
                      onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Customer PO Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2026-99"
                      value={quoteForm.customer_po_number}
                      onChange={(e) => setQuoteForm({ ...quoteForm, customer_po_number: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Line Items Builder */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800">Line Items & Deliverables</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {quoteForm.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          placeholder="Item name / spec"
                          value={item.product_name}
                          onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-hidden"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] outline-hidden text-slate-500"
                        >
                          <option value="">Preset...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-hidden text-right font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-hidden text-center font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-right font-bold font-mono text-slate-800 text-[11px]">
                        {currency}{Math.round((Number(item.unit_price) || 0) * (Number(item.quantity) || 1)).toLocaleString()}
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={quoteForm.items.length <= 1}
                          className="text-slate-300 hover:text-rose-600 disabled:opacity-20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={quoteForm.discount_percent}
                        onChange={(e) => setQuoteForm({ ...quoteForm, discount_percent: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-right font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Tax %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={quoteForm.tax_percent}
                        onChange={(e) => setQuoteForm({ ...quoteForm, tax_percent: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-right font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Terms & Conditions</label>
                    <textarea
                      rows="2"
                      value={quoteForm.terms_conditions}
                      onChange={(e) => setQuoteForm({ ...quoteForm, terms_conditions: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-xs"
                      placeholder="Payment terms, delivery condition notes..."
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-bold">{currency}{liveSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {quoteForm.discount_percent > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount ({quoteForm.discount_percent}%):</span>
                        <span>-{currency}{Math.round(liveSubtotal * (Number(quoteForm.discount_percent) / 100)).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Tax ({quoteForm.tax_percent}%):</span>
                      <span>{currency}{liveTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-rose-600 font-mono text-lg">{currency}{liveGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Create {quoteForm.doc_type}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL DOCUMENT & OFFICIAL BRANDED PDF MODAL */}
      {emailModalDoc && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmailModalDoc(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-fade-in cursor-default">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Email {emailModalDoc.doc_type || 'Document'} & PDF</h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    Ref: {emailModalDoc.quote_number} &bull; {currency}{Number(emailModalDoc.grand_total).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalDoc(null)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSendDocumentEmail} className="p-6 space-y-4 text-xs">
              {/* Document Pill Info */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-700 block tracking-wider">Client Recipient</span>
                  <span className="font-extrabold text-slate-900 text-xs">{emailModalDoc.account_name}</span>
                  {emailModalDoc.contact_name && <span className="text-slate-500 text-[11px]"> ({emailModalDoc.contact_name})</span>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Due</span>
                  <span className="font-black text-slate-900 font-mono text-sm">
                    {currency}{Number(emailModalDoc.grand_total).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Recipient Email Address Input */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. finance@clientcompany.com"
                  value={emailDocForm.recipient_email}
                  onChange={(e) => setEmailDocForm({ ...emailDocForm, recipient_email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-medium text-slate-800"
                />
              </div>

              {/* Attachment Preview Badge */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                <div className="leading-tight flex-1">
                  <span className="font-bold text-slate-800 block text-[11px]">
                    Auto-Attached: {(emailModalDoc.doc_type || 'Document').replace(/\s+/g, '_')}-{emailModalDoc.quote_number}.pdf
                  </span>
                  <span className="text-[10px] text-slate-500">
                    High-res PDF generated with your company logo, bank swift details & official terms.
                  </span>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Accompanying Message / Cover Note
                </label>
                <textarea
                  rows={4}
                  value={emailDocForm.custom_message}
                  onChange={(e) => setEmailDocForm({ ...emailDocForm, custom_message: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-sans leading-relaxed text-slate-700"
                />
              </div>

              {/* Success / Status Banner if dispatched */}
              {emailResult && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  emailResult.isLiveSent
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-[11px] leading-snug">
                    <span className="font-extrabold block">
                      {emailResult.isLiveSent ? 'Dispatched Live via ' + emailResult.providerUsed?.toUpperCase() : 'Document Email Processed'}
                    </span>
                    <span>
                      Delivery Status: <strong>{emailResult.deliveryStatus}</strong>. Logged into client timeline and audit history.
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmailModalDoc(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  {emailResult ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  {isSendingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating PDF & Delivering...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{emailResult ? 'Send Again' : 'Send Official PDF Email'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Sales Connect Modal */}
      {whatsAppModalData && (
        <WhatsAppConnectModal
          isOpen={true}
          onClose={() => setWhatsAppModalData(null)}
          recipient={whatsAppModalData.recipient}
          defaultTemplateType={whatsAppModalData.template}
          extraData={whatsAppModalData.extra}
          onLogged={() => loadData(true)}
        />
      )}
    </div>
  );
}
