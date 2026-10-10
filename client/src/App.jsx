import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ReportsView from './views/ReportsView';
import LeadsView from './views/LeadsView';
import DealsView from './views/DealsView';
import AccountsView from './views/AccountsView';
import ContactsView from './views/ContactsView';
import ActivitiesView from './views/ActivitiesView';
import ProductsView from './views/ProductsView';
import QuotesView from './views/QuotesView';
import WorkflowsView from './views/WorkflowsView';
import SettingsView from './views/SettingsView';
import AuthView from './views/AuthView';
import ClientPortalView from './views/ClientPortalView';
import SubscriptionModal from './components/SubscriptionModal';
import AICopilotDrawer from './components/AICopilotDrawer';
import { Lock, AlertCircle } from 'lucide-react';
import { crmApi } from './api';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [navParams, setNavParams] = useState({});
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // Load Initial Metadata & Analytics
  const loadGlobalData = async (user = currentUser) => {
    try {
      const [statsData, usersData] = await Promise.all([
        crmApi.getDashboardStats(),
        crmApi.getUsers(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      if (!user && usersData.length > 0) {
        setCurrentUser(usersData[0]);
      }
    } catch (err) {
      console.error('Failed to load CRM global stats:', err);
    }
  };

  // Check persistent session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('alfa_crm_token');
      if (token) {
        try {
          const res = await crmApi.getCurrentUser();
          if (res?.user) {
            setCurrentUser(res.user);
            await loadGlobalData(res.user);
            if (res.user.subscription_status === 'expired') {
              setIsSubscriptionModalOpen(true);
            }
          } else {
            localStorage.removeItem('alfa_crm_token');
          }
        } catch (err) {
          localStorage.removeItem('alfa_crm_token');
        }
      }
      setAuthChecking(false);
    };

    initAuth();
  }, []);

  // Trigger Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Cross-module navigation handler
  const handleNavigate = (view, params = {}) => {
    setCurrentView(view);
    setNavParams(params);
  };

  // Quick Add handler
  const handleQuickAdd = (type) => {
    if (type === 'lead') handleNavigate('leads', { openCreate: true });
    else if (type === 'deal') handleNavigate('deals', { openCreate: true });
    else if (type === 'account') handleNavigate('accounts', { openCreate: true });
    else if (type === 'contact') handleNavigate('contacts', { openCreate: true });
    else if (type === 'task' || type === 'call') handleNavigate('activities', { openCreateType: type });
    else if (type === 'quote') handleNavigate('quotes', { openCreate: true });
  };

  // Demo reset
  const handleResetData = async () => {
    if (!window.confirm('Reset all CRM data back to the default demo accounts, deals, and leads?')) return;
    try {
      await crmApi.resetDemoData();
      showToast('Database reset to fresh Zoho-style enterprise demo state!');
      await loadGlobalData();
      // force reload view
      setNavParams({ refresh: Date.now() });
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  // Quick task toggle in dashboard
  const handleToggleTaskStatus = async (id) => {
    try {
      await crmApi.toggleActivityStatus(id);
      loadGlobalData();
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Handlers
  const handleAuthSuccess = async (user) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name}!`);
    await loadGlobalData(user);
    if (user.subscription_status === 'expired') {
      setIsSubscriptionModalOpen(true);
    }
  };

  const handleLogout = async () => {
    try {
      await crmApi.logout();
    } catch (e) {}
    localStorage.removeItem('alfa_crm_token');
    setCurrentUser(null);
    showToast('Signed out of workspace.');
  };

  // Public Customer Document Portal View (Zero-Auth Required)
  const isPortalRoute = window.location.pathname.startsWith('/portal/doc/') || window.location.hash.startsWith('#/portal/doc/');
  if (isPortalRoute) {
    const portalToken = window.location.pathname.startsWith('/portal/doc/')
      ? window.location.pathname.replace('/portal/doc/', '')
      : window.location.hash.replace('#/portal/doc/', '');
    return <ClientPortalView token={portalToken} />;
  }

  // Splash loading screen while verifying JWT session
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center font-black text-lg shadow-xl shadow-rose-900/50 animate-pulse mb-3">
          AG
        </div>
        <div className="text-sm font-bold text-slate-200">ABADI GURU CRM Enterprise</div>
        <div className="text-xs text-slate-500 mt-1">Verifying secure workspace session...</div>
      </div>
    );
  }

  // If not logged in, render Sign In / Sign Up SaaS Auth Screen
  if (!currentUser) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  // Module permission check for views
  const isViewLocked = (view) => {
    if (!currentUser || currentUser.role === 'admin') return false;
    const p = currentUser.permissions || {};
    const map = {
      leads: p.leads,
      contacts: p.contacts,
      accounts: p.accounts,
      deals: p.deals,
      products: p.products,
      quotes: p.quotes,
      workflows: p.automation,
      settings: p.settings,
      reports: p.reports,
    };
    return map[view] === 'none';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-900">
      {/* Trial Expired Alert Banner */}
      {currentUser.subscription_status === 'expired' && (
        <div className="bg-rose-600 text-white text-xs font-bold py-2 px-4 flex items-center justify-between shadow-md z-50">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            Your free trial has expired. Subscribe to an active plan to continue full CRM access.
          </span>
          <button
            onClick={() => setIsSubscriptionModalOpen(true)}
            className="px-3 py-1 bg-white text-rose-700 rounded-lg text-xs font-extrabold hover:bg-rose-50 transition-colors shadow-xs"
          >
            Upgrade Plan Now
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        onQuickAdd={handleQuickAdd}
        onNavigate={handleNavigate}
        onResetData={handleResetData}
        onToggleAiCopilot={() => setIsAiDrawerOpen(prev => !prev)}
        onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Workspace: Sidebar + View Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          setCurrentView={(v) => { setCurrentView(v); setNavParams({}); }}
          stats={stats?.summary}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          currentUser={currentUser}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-bounce">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {toastMessage}
            </div>
          )}

          {/* Access Restricted Screen if currentView is locked */}
          {isViewLocked(currentView) ? (
            <div className="flex-1 h-full min-h-[70vh] flex items-center justify-center p-8">
              <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                  <Lock className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Access Restricted</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Your sales agent account does not have permission to view or manage the <span className="font-semibold text-slate-800 capitalize">{currentView}</span> module.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Please contact your company administrator or workspace owner to request permission.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Core Views */}
              {currentView === 'dashboard' && (
                <DashboardView
                  stats={stats}
                  onNavigate={handleNavigate}
                  onToggleTaskStatus={handleToggleTaskStatus}
                  onRefresh={loadGlobalData}
                />
              )}

              {currentView === 'reports' && (
                <ReportsView
                  onNavigate={handleNavigate}
                />
              )}

              {currentView === 'leads' && (
                <LeadsView
                  onNavigate={handleNavigate}
                  selectedLeadId={navParams.leadId}
                  key={navParams.refresh || 'leads'}
                />
              )}

              {currentView === 'deals' && (
                <DealsView
                  onNavigate={handleNavigate}
                  selectedDealId={navParams.dealId}
                  onRefreshStats={loadGlobalData}
                  key={navParams.refresh || 'deals'}
                />
              )}

              {currentView === 'accounts' && (
                <AccountsView
                  onNavigate={handleNavigate}
                  selectedAccountId={navParams.accountId}
                  key={navParams.refresh || 'accounts'}
                />
              )}

              {currentView === 'contacts' && (
                <ContactsView
                  onNavigate={handleNavigate}
                  selectedContactId={navParams.contactId}
                  key={navParams.refresh || 'contacts'}
                />
              )}

              {currentView === 'activities' && (
                <ActivitiesView
                  onRefreshStats={loadGlobalData}
                  key={navParams.refresh || 'activities'}
                />
              )}

              {currentView === 'products' && (
                <ProductsView
                  key={navParams.refresh || 'products'}
                />
              )}

              {currentView === 'quotes' && (
                <QuotesView
                  navParams={navParams}
                  onNavigate={handleNavigate}
                  key={navParams.refresh || 'quotes'}
                />
              )}

              {currentView === 'workflows' && (
                <WorkflowsView
                  key={navParams.refresh || 'workflows'}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView
                  onResetData={handleResetData}
                  key={navParams.refresh || 'settings'}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* AI Sales Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Subscription & Pricing Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          showToast(`Plan updated to ${updatedUser.subscription_tier}!`);
        }}
      />
    </div>
  );
}
