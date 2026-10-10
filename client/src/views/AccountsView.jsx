import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Globe,
  DollarSign,
  Users,
  Briefcase,
  ChevronRight,
  X,
  MapPin,
  Trash2,
  Edit2
} from 'lucide-react';
import { crmApi } from '../api';

export default function AccountsView({ onNavigate, selectedAccountId }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('All');

  const [activeAccount, setActiveAccount] = useState(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    website: '',
    industry: 'Technology',
    annual_revenue: '',
    employees: '',
    billing_street: '',
    billing_city: '',
    billing_state: '',
    billing_country: 'USA',
    description: '',
  });

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (industryFilter !== 'All') params.industry = industryFilter;
      if (search) params.q = search;
      const data = await crmApi.getAccounts(params);
      setAccounts(data);

      if (selectedAccountId) {
        const found = data.find(a => a.id === Number(selectedAccountId));
        if (found) openAccountDetails(found.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [industryFilter, search, selectedAccountId]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeAccount) setActiveAccount(null);
        if (isCreatingAccount) setIsCreatingAccount(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAccount, isCreatingAccount]);

  const openAccountDetails = async (id) => {
    try {
      const full = await crmApi.getAccount(id);
      setActiveAccount(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createAccount(formData);
      setIsCreatingAccount(false);
      setFormData({
        name: '',
        phone: '',
        website: '',
        industry: 'Technology',
        annual_revenue: '',
        employees: '',
        billing_street: '',
        billing_city: '',
        billing_state: '',
        billing_country: 'USA',
        description: '',
      });
      loadAccounts();
    } catch (err) {
      alert('Error creating account: ' + err.message);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    try {
      await crmApi.deleteAccount(id);
      if (activeAccount?.id === id) setActiveAccount(null);
      loadAccounts();
    } catch (err) {
      alert('Error deleting account: ' + err.message);
    }
  };

  // Add Note to Account
  const [noteContent, setNoteContent] = useState('');
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !activeAccount) return;
    try {
      await crmApi.createNote({
        related_to_type: 'account',
        related_to_id: activeAccount.id,
        content: noteContent,
        created_by_name: 'Alex Mercer',
      });
      setNoteContent('');
      openAccountDetails(activeAccount.id);
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Accounts & Organizations</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
              {accounts.length} Companies
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zoho 360-degree account view. Manage client companies, subsidiaries, contacts, and active pipelines.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingAccount(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Account
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies by name or city..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500 font-medium">Industry:</label>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Transportation & Logistics">Transportation & Logistics</option>
            <option value="Retail & E-commerce">Retail & E-commerce</option>
            <option value="Finance & Banking">Finance & Banking</option>
            <option value="Manufacturing">Manufacturing</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading corporate accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No accounts found</h3>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Phone & Web</th>
                  <th className="py-3 px-4 text-center">Contacts</th>
                  <th className="py-3 px-4 text-center">Deals</th>
                  <th className="py-3 px-4 text-right">Annual Revenue</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openAccountDetails(acc.id)}
                        className="font-bold text-slate-900 hover:text-rose-600 text-left flex items-center gap-2"
                      >
                        <Building2 className="w-4 h-4 text-blue-500" />
                        {acc.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {acc.industry}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {[acc.billing_city, acc.billing_state].filter(Boolean).join(', ') || 'USA'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      <div>{acc.phone || '—'}</div>
                      {acc.website && (
                        <a href={acc.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {acc.website.replace('https://', '')}
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {acc.contact_count || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {acc.deal_count || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      ${Number(acc.annual_revenue || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openAccountDetails(acc.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACCOUNT 360 DETAIL MODAL */}
      {activeAccount && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveAccount(null);
          }}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end cursor-pointer"
        >
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto cursor-default">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeAccount.name}</h2>
                  <div className="text-xs text-slate-500">{activeAccount.industry} &bull; {activeAccount.ownership || 'Private'}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveAccount(null)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Annual Revenue</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ${Number(activeAccount.annual_revenue || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Employees</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {activeAccount.employees || 0} staff
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Owner</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {activeAccount.owner_name}
                  </span>
                </div>
              </div>

              {/* Associated Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" /> Key Contacts ({activeAccount.contacts?.length || 0})
                  </h4>
                  <button
                    onClick={() => { setActiveAccount(null); onNavigate('contacts'); }}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeAccount.contacts?.map(c => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                      <div className="text-[11px] text-slate-500">{c.title || 'Contact'}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{c.email} &bull; {c.phone}</div>
                    </div>
                  ))}
                  {activeAccount.contacts?.length === 0 && (
                    <p className="text-slate-400 italic col-span-2">No contacts registered for this account.</p>
                  )}
                </div>
              </div>

              {/* Associated Deals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Pipeline Deals ({activeAccount.deals?.length || 0})
                  </h4>
                  <button
                    onClick={() => { setActiveAccount(null); onNavigate('deals'); }}
                    className="text-rose-600 font-bold hover:underline"
                  >
                    View Deals &rarr;
                  </button>
                </div>
                <div className="space-y-2">
                  {activeAccount.deals?.map(d => (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{d.name}</div>
                        <div className="text-[11px] text-slate-500">Stage: {d.stage} ({d.probability}%) &bull; Close: {d.closing_date}</div>
                      </div>
                      <span className="font-extrabold text-slate-900">${Number(d.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {activeAccount.deals?.length === 0 && (
                    <p className="text-slate-400 italic">No deals attached to this account.</p>
                  )}
                </div>
              </div>

              {/* Discussion & Notes */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Account Notes</h4>
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Log strategic account update or executive summary..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!noteContent.trim()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      Post Note
                    </button>
                  </div>
                </form>

                <div className="mt-3 space-y-2">
                  {activeAccount.notes?.map(n => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
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

            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                onClick={() => handleDeleteAccount(activeAccount.id)}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Account
              </button>
              <button
                onClick={() => setActiveAccount(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      {isCreatingAccount && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreatingAccount(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Account (Company)</h3>
              <button
                type="button"
                onClick={() => setIsCreatingAccount(false)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Industry</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Transportation & Logistics">Transportation & Logistics</option>
                    <option value="Retail & E-commerce">Retail & E-commerce</option>
                    <option value="Finance & Banking">Finance & Banking</option>
                    <option value="Manufacturing">Manufacturing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Annual Revenue ($)</label>
                  <input
                    type="number"
                    placeholder="10000000"
                    value={formData.annual_revenue}
                    onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Website</label>
                  <input
                    type="text"
                    placeholder="https://acmecorp.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Billing City</label>
                  <input
                    type="text"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">State / Province</label>
                  <input
                    type="text"
                    value={formData.billing_state}
                    onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.billing_country}
                    onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingAccount(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
