import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Bell, RotateCcw, User, CheckCircle2, 
  Building2, Users, Briefcase, Calendar, FileText, ExternalLink,
  ChevronDown, Sparkles, X, PhoneCall, CheckSquare,
  LogOut, Zap, Crown, AlertCircle, Shield
} from 'lucide-react';
import { crmApi } from '../api';

export default function Header({ 
  currentUser, 
  setCurrentUser, 
  users = [], 
  onQuickAdd, 
  onNavigate,
  onResetData,
  onToggleAiCopilot,
  onOpenSubscription,
  onLogout,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Workflow Executed', desc: 'Instant Welcome Task created for Arthur Pendleton', time: '10m ago', unread: true },
    { id: 2, title: 'Deal Updated', desc: 'Nova Cloud deal moved to Negotiation / Review ($145,000)', time: '1h ago', unread: true },
    { id: 3, title: 'Quote Delivered', desc: 'Quote QT-2026-001 sent to Apex Global Logistics', time: '3h ago', unread: false },
  ]);

  const searchContainerRef = useRef(null);
  const quickAddRef = useRef(null);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await crmApi.search(searchQuery.trim());
        setSearchResults(results);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listeners
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) {
        setShowQuickAddMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResults = searchResults 
    ? (searchResults.leads?.length || 0) + 
      (searchResults.accounts?.length || 0) + 
      (searchResults.contacts?.length || 0) + 
      (searchResults.deals?.length || 0) + 
      (searchResults.activities?.length || 0)
    : 0;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Brand & Left Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 flex items-center justify-center text-white font-black text-sm shadow-sm tracking-tight">
            AG
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 tracking-tight text-base">ABADI GURU</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                CRM
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 block">Enterprise Cloud</span>
          </div>
        </div>
      </div>

      {/* Global Search Bar (Zoho-style unified omnibar) */}
      <div className="flex-1 max-w-xl mx-4 relative" ref={searchContainerRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults) setShowSearchDropdown(true); }}
            placeholder="Search leads, accounts, contacts, deals, tasks... (e.g. Apex, Nova, Marcus)"
            className="w-full pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-lg border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Search Results Popup */}
        {showSearchDropdown && searchResults && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-[460px] overflow-y-auto z-50">
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Found {totalResults} result{totalResults === 1 ? '' : 's'} for "{searchQuery}"</span>
              {isSearching && <span className="animate-pulse text-rose-600">Searching...</span>}
            </div>

            {totalResults === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No matching records found. Try searching for a company, deal name, or contact.
              </div>
            ) : (
              <div className="p-2 divide-y divide-slate-100 text-sm">
                {/* Leads */}
                {searchResults.leads?.length > 0 && (
                  <div className="py-2 first:pt-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 px-2.5 mb-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Leads ({searchResults.leads.length})
                    </div>
                    {searchResults.leads.map(lead => (
                      <button
                        key={`lead-${lead.id}`}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          onNavigate('leads', { leadId: lead.id });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-xs group-hover:text-rose-600">
                            {lead.first_name} {lead.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{lead.company} &bull; {lead.email || 'No email'}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {lead.lead_status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Accounts */}
                {searchResults.accounts?.length > 0 && (
                  <div className="py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 px-2.5 mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Accounts ({searchResults.accounts.length})
                    </div>
                    {searchResults.accounts.map(acc => (
                      <button
                        key={`acc-${acc.id}`}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          onNavigate('accounts', { accountId: acc.id });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-xs group-hover:text-blue-600">{acc.name}</div>
                          <div className="text-[11px] text-slate-500">{acc.industry} &bull; {acc.phone || acc.website || ''}</div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Deals */}
                {searchResults.deals?.length > 0 && (
                  <div className="py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 px-2.5 mb-1 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Deals ({searchResults.deals.length})
                    </div>
                    {searchResults.deals.map(deal => (
                      <button
                        key={`deal-${deal.id}`}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          onNavigate('deals', { dealId: deal.id });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-xs group-hover:text-emerald-600">{deal.name}</div>
                          <div className="text-[11px] text-slate-500">{deal.account_name} &bull; Stage: {deal.stage}</div>
                        </div>
                        <span className="font-bold text-slate-900 text-xs">
                          ${Number(deal.amount).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Contacts */}
                {searchResults.contacts?.length > 0 && (
                  <div className="py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600 px-2.5 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Contacts ({searchResults.contacts.length})
                    </div>
                    {searchResults.contacts.map(contact => (
                      <button
                        key={`contact-${contact.id}`}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          onNavigate('contacts', { contactId: contact.id });
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-xs group-hover:text-purple-600">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500">{contact.title || 'Contact'} &bull; {contact.account_name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Actions & Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Add Menu "+" */}
        <div className="relative" ref={quickAddRef}>
          <button
            onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-xs"
            title="Quick Create"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {showQuickAddMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
              <div className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                Quick Actions
              </div>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('lead'); }}
                className="w-full px-3 py-2 text-left hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <Users className="w-4 h-4 text-rose-500" /> New Lead
              </button>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('contact'); }}
                className="w-full px-3 py-2 text-left hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <User className="w-4 h-4 text-purple-500" /> New Contact
              </button>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('account'); }}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <Building2 className="w-4 h-4 text-blue-500" /> New Account
              </button>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('deal'); }}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <Briefcase className="w-4 h-4 text-emerald-500" /> New Deal
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('task'); }}
                className="w-full px-3 py-2 text-left hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <CheckSquare className="w-4 h-4 text-amber-500" /> New Task
              </button>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('call'); }}
                className="w-full px-3 py-2 text-left hover:bg-cyan-50 hover:text-cyan-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <PhoneCall className="w-4 h-4 text-cyan-500" /> Log Call
              </button>
              <button
                onClick={() => { setShowQuickAddMenu(false); onQuickAdd('quote'); }}
                className="w-full px-3 py-2 text-left hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 text-slate-700 font-medium"
              >
                <FileText className="w-4 h-4 text-indigo-500" /> Create Quote
              </button>
            </div>
          )}
        </div>

        {/* AI Copilot & Hermes Launcher Button */}
        <button
          onClick={onToggleAiCopilot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold text-xs shadow-xs hover:shadow transition-all group"
          title="Open AI Sales Copilot (Hermes / Local / Cloud)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">AI Copilot</span>
          <span className="px-1.5 py-0.2 bg-white/20 text-[9px] rounded font-bold tracking-wider uppercase">
            Hermes
          </span>
        </button>

        {/* Demo Data Reset Button */}
        <button
          onClick={onResetData}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative"
          title="Reset to Fresh Demo Dataset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-3.5 py-1.5 flex items-center justify-between border-b border-slate-100">
                <span className="font-bold text-xs text-slate-800">Notifications & Alerts</span>
                <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">
                  2 unread
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3 text-xs hover:bg-slate-50 transition-colors ${n.unread ? 'bg-rose-50/30' : ''}`}>
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{n.time}</span>
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">{n.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subscription Status Pill */}
        {currentUser && (
          <button
            onClick={onOpenSubscription}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
              currentUser.subscription_status === 'active'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : currentUser.subscription_status === 'expired'
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 animate-pulse'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {currentUser.subscription_status === 'active' ? (
              <>
                <Crown className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currentUser.subscription_tier || 'Pro'} Plan</span>
              </>
            ) : currentUser.subscription_status === 'expired' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Trial Expired &bull; Upgrade</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Pro Trial &bull; <span className="underline">Upgrade</span></span>
              </>
            )}
          </button>
        )}

        {/* Active User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'}
              alt={currentUser?.name || 'User'}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-rose-200"
            />
            <div className="hidden md:block leading-none">
              <div className="text-xs font-bold text-slate-800">{currentUser?.name || 'Alex Mercer'}</div>
              <div className="text-[10px] text-slate-500 font-medium">{currentUser?.company || currentUser?.role || 'Sales Rep'}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 overflow-hidden">
              {/* User Identity Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="font-extrabold text-xs text-slate-900">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{currentUser?.email}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{currentUser?.company || 'Enterprise Suite'}</div>
              </div>

              {/* Subscription Card in Dropdown */}
              <div className="p-3 bg-gradient-to-r from-rose-50 to-indigo-50 border-b border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Subscription
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white text-rose-600 border border-rose-200">
                    {currentUser?.subscription_tier || 'Professional'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onOpenSubscription) onOpenSubscription();
                  }}
                  className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {currentUser?.subscription_status === 'active' ? 'Manage Subscription' : 'Upgrade Plan'}
                </button>
              </div>

              {/* Quick Workspace Navigation */}
              <div className="p-1.5 border-b border-slate-100 space-y-0.5">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onNavigate) onNavigate('settings');
                  }}
                  className="w-full p-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-rose-600" />
                  <span>Company Profile & Branding</span>
                </button>
              </div>

              {/* Team Profile Switcher */}
              {users.filter(u => u.id !== currentUser?.id).length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Switch Sales Profile
                  </div>
                  <div className="space-y-0.5 max-h-36 overflow-y-auto">
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setCurrentUser(u);
                          setShowUserMenu(false);
                        }}
                        className={`w-full p-1.5 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                          currentUser?.id === u.id ? 'bg-rose-50 text-rose-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                          <div className="leading-tight">
                            <div className="font-bold text-xs">{u.name}</div>
                            <div className="text-[9px] text-slate-400">{u.role}</div>
                          </div>
                        </div>
                        {currentUser?.id === u.id && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign Out Button */}
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full p-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
