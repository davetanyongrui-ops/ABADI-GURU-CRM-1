import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  Building2,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CreditCard,
  Mail,
  Phone,
  Globe,
  MapPin,
  AlertCircle,
  Check,
  Lock,
  X
} from 'lucide-react';

export default function ClientPortalView({ token }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Digital Signature Modal
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signConsent, setSignConsent] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    if (!isSignModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSignModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSignModalOpen]);

  const fetchDoc = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/portal/doc/${encodeURIComponent(token)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}: Document unavailable`);
      }
      const json = await res.json();
      setData(json);
      if (json.doc?.accepted_at) {
        setSignSuccess(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDoc();
    }
  }, [token]);

  const handleAcceptQuote = async (e) => {
    e.preventDefault();
    if (!signerName.trim() || !signConsent) return;
    try {
      setSubmittingSign(true);
      const res = await fetch(`/api/portal/doc/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName.trim() })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit digital acceptance');
      }
      const resData = await res.json();
      setSignSuccess(true);
      setIsSignModalOpen(false);
      setData(prev => ({
        ...prev,
        doc: {
          ...prev.doc,
          quote_stage: 'Confirmed',
          accepted_at: resData.doc?.accepted_at || new Date().toISOString(),
          accepted_by: signerName.trim()
        }
      }));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingSign(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-600">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-lg animate-pulse mb-4">
          AG
        </div>
        <div className="font-bold text-sm text-slate-800">ABADI GURU Secure Document Portal</div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Loading document verification...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Document Unavailable</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'This document link may have expired or is no longer valid. Please contact the issuing organization.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-xs"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { doc, items = [], company = {} } = data;
  const isQuotation = (doc.doc_type || 'Quotation').toLowerCase().includes('quotation');
  const isInvoice = (doc.doc_type || '').toLowerCase().includes('invoice');
  const isDO = (doc.doc_type || '').toLowerCase().includes('delivery');
  const currency = company.currency_symbol || '$';
  const isAccepted = !!doc.accepted_at;

  return (
    <div className="min-h-screen bg-slate-100/80 font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-900 py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Floating Control Bar */}
        <header className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-950 text-white flex items-center justify-center font-black text-sm shadow-xs">
              AG
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>{company.company_name || 'Abadi Guru Enterprise'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-emerald-600" /> Verified Portal
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {doc.doc_type || 'Document'}: <span className="text-slate-800 font-bold">{doc.quote_number}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Download Official PDF */}
            <a
              href={`/api/portal/doc/${encodeURIComponent(token)}/pdf`}
              download={`${doc.quote_number}.pdf`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>

            {/* Accept & Sign Button (Only on Quotations not yet signed) */}
            {isQuotation && !isAccepted && (
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Accept & Approve Quote</span>
              </button>
            )}

            {isAccepted && (
              <span className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-2xs">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>Accepted & Approved</span>
              </span>
            )}
          </div>
        </header>

        {/* Digital Acceptance Banner */}
        {isAccepted && (
          <div className="bg-emerald-500 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-black">Official Digital Acceptance Verified</div>
                <div className="text-xs text-emerald-100 mt-0.5">
                  Signed and approved by <strong className="text-white underline">{doc.accepted_by || 'Authorized Representative'}</strong> on{' '}
                  {doc.accepted_at ? new Date(doc.accepted_at).toLocaleString() : 'Recent'}.
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono bg-emerald-700/60 px-3 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-100 shrink-0">
              AUDIT RECORD #{doc.id}-{doc.quote_number}
            </div>
          </div>
        )}

        {/* Main Document Sheet (Modern Corporate Paper Preview) */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Branded Document Header */}
          <div className="p-6 sm:p-10 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
              {/* Organization Profile */}
              <div className="space-y-2">
                {company.company_logo_url ? (
                  <img
                    src={company.company_logo_url}
                    alt={company.company_name}
                    className="h-12 w-auto object-contain rounded mb-2"
                  />
                ) : (
                  <div className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-black">
                      AG
                    </span>
                    <span>{company.company_name || 'Abadi Guru Enterprise'}</span>
                  </div>
                )}
                <div className="text-xs text-slate-500 space-y-1">
                  {company.company_address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{company.company_address}</span>
                    </div>
                  )}
                  {company.company_email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{company.company_email}</span>
                    </div>
                  )}
                  {company.company_phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{company.company_phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Identity Box */}
              <div className="sm:text-right space-y-1 self-stretch sm:self-auto">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isAccepted ? 'bg-emerald-100 text-emerald-800' :
                  isInvoice ? 'bg-purple-100 text-purple-800' :
                  isDO ? 'bg-teal-100 text-teal-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {doc.doc_type || 'Quotation'}
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  {doc.quote_number}
                </div>
                <div className="text-xs text-slate-500">
                  Status: <strong className="text-slate-800">{doc.quote_stage || 'Active'}</strong>
                </div>
              </div>
            </div>

            {/* Recipient / Client Details */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                  Prepared For / Client
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {doc.account_name || 'Valued Client'}
                </div>
                {doc.contact_name && (
                  <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Attention: {doc.contact_name}</span>
                  </div>
                )}
                {(doc.recipient_address || doc.billing_street) && (
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {doc.recipient_address || `${doc.billing_street}, ${doc.billing_city || ''} ${doc.billing_state || ''}`}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Issue Date</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {doc.created_at ? doc.created_at.split(' ')[0] : new Date().toISOString().split('T')[0]}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">
                    {isDO ? 'Delivery Date' : (isInvoice ? 'Payment Due' : 'Valid Until')}
                  </div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {doc.delivery_date || doc.valid_until || '—'}
                  </div>
                </div>
                {doc.customer_po_number && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Customer PO #</div>
                    <div className="font-mono font-bold text-slate-800 mt-0.5">{doc.customer_po_number}</div>
                  </div>
                )}
                {doc.tracking_number && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Tracking Number</div>
                    <div className="font-mono font-bold text-indigo-700 mt-0.5">{doc.tracking_number}</div>
                  </div>
                )}
              </div>
            </div>

            {doc.subject && (
              <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-slate-800">
                <span className="font-bold text-indigo-900">Subject: </span>
                <span>{doc.subject}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="p-6 sm:p-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="pb-3 w-8">#</th>
                    <th className="pb-3">Item Specification / Service Description</th>
                    <th className="pb-3 text-right w-20">Qty</th>
                    <th className="pb-3 text-right w-28">Unit Price</th>
                    {doc.discount_percent > 0 && <th className="pb-3 text-right w-20">Disc %</th>}
                    <th className="pb-3 text-right w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3.5 text-slate-900 font-semibold">{item.product_name}</td>
                      <td className="py-3.5 text-right text-slate-700 font-mono">{item.quantity}</td>
                      <td className="py-3.5 text-right text-slate-700 font-mono">
                        {currency}{Number(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {doc.discount_percent > 0 && (
                        <td className="py-3.5 text-right text-amber-600 font-mono">
                          {item.discount_percent ? `${item.discount_percent}%` : '—'}
                        </td>
                      )}
                      <td className="py-3.5 text-right font-bold text-slate-900 font-mono">
                        {currency}{Number(item.line_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotal, Tax, Grand Total Calculation */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-6">
              {/* Payment Details / Bank Wire Instructions */}
              <div className="sm:max-w-xs w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> Payment & Banking Details
                </div>
                {company.bank_name ? (
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div>Bank: <strong className="text-slate-800">{company.bank_name}</strong></div>
                    <div>Account No: <strong className="text-slate-800 font-mono">{company.bank_account_no}</strong></div>
                    <div>Beneficiary: <strong className="text-slate-800">{company.bank_account_holder}</strong></div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">
                    Please remit payment according to your master corporate service agreement.
                  </div>
                )}
                {company.payment_terms && (
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 leading-normal">
                    {company.payment_terms}
                  </div>
                )}
              </div>

              {/* Total Calculation Card */}
              <div className="sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">
                    {currency}{Number(doc.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {doc.discount_percent > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount ({doc.discount_percent}%)</span>
                    <span className="font-mono font-medium">
                      -{currency}{(Number(doc.subtotal || 0) * (doc.discount_percent / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Sales Tax ({doc.tax_percent || 8}%)</span>
                  <span className="font-mono font-medium">
                    {currency}{(Number(doc.grand_total || 0) - Number(doc.subtotal || 0) * (1 - (doc.discount_percent || 0)/100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-slate-900">Total Due</span>
                  <span className="text-2xl font-black text-rose-600 font-mono">
                    {currency}{Number(doc.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            {doc.terms_conditions && (
              <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                  Terms & Commercial Conditions
                </div>
                <div className="whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px]">
                  {doc.terms_conditions}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 py-4 space-y-1">
          <div>ABADI GURU CRM Secure Customer Portal &bull; Encrypted Audit Trail Verification</div>
          <div className="text-[10px] text-slate-400">
            Questions regarding this document? Contact {company.company_email || 'the account manager'}.
          </div>
        </footer>
      </div>

      {/* Digital Acceptance Signature Modal */}
      {isSignModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSignModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 cursor-default">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Accept & Approve Quotation</h3>
                  <p className="text-xs text-slate-500">Document #{doc.quote_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSignModalOpen(false)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAcceptQuote} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Your Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor, Chief Technology Officer"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] space-y-1.5">
                <div className="font-bold text-slate-800">Commercial Summary:</div>
                <div className="flex justify-between">
                  <span>Document:</span>
                  <span className="font-mono font-bold text-slate-800">{doc.quote_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Grand Total:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {currency}{Number(doc.grand_total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Client Account:</span>
                  <span className="font-semibold text-slate-800">{doc.account_name || 'Client'}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  required
                  checked={signConsent}
                  onChange={(e) => setSignConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  I confirm that I am authorized to digitally accept this proposal on behalf of{' '}
                  <strong className="text-slate-900">{doc.account_name || 'my organization'}</strong> and agree to the specified terms and pricing.
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSignModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSign || !signerName.trim() || !signConsent}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {submittingSign ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Signature...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirm Digital Acceptance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
