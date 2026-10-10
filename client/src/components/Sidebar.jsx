import React from 'react';
import {
  LayoutDashboard,
  Target,
  Users,
  Building2,
  Briefcase,
  CalendarCheck,
  Package,
  FileSpreadsheet,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Lock
} from 'lucide-react';

const PERM_KEY_MAP = {
  leads: 'leads',
  contacts: 'contacts',
  accounts: 'accounts',
  deals: 'deals',
  products: 'products',
  quotes: 'quotes',
  workflows: 'automation',
  settings: 'settings',
  reports: 'reports',
};

export default function Sidebar({ currentView, setCurrentView, stats, collapsed, setCollapsed, currentUser }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports & BI', icon: BarChart3, badge: 'AI', badgeColor: 'bg-rose-500 text-white font-bold' },
    { 
      id: 'leads', 
      label: 'Leads', 
      icon: Target, 
      badge: stats?.activeLeadsCount > 0 ? stats.activeLeadsCount : null,
      badgeColor: 'bg-rose-100 text-rose-700'
    },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'accounts', label: 'Accounts', icon: Building2 },
    { 
      id: 'deals', 
      label: 'Deals / Pipeline', 
      icon: Briefcase,
      badge: stats?.pipelineCount > 0 ? stats.pipelineCount : null,
      badgeColor: 'bg-emerald-100 text-emerald-700'
    },
    { 
      id: 'activities', 
      label: 'Activities', 
      icon: CalendarCheck,
      badge: stats?.pendingTasksToday > 0 ? `${stats.pendingTasksToday}` : null,
      badgeColor: 'bg-amber-100 text-amber-700'
    },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'quotes', label: 'Quotes & Invoices', icon: FileSpreadsheet },
    { id: 'workflows', label: 'Automation & Rules', icon: Zap },
    { id: 'settings', label: 'Settings & Import', icon: Settings },
  ];

  return (
    <aside
      className={`relative bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 z-20 shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Navigation Menu */}
      <div className="flex-1 py-4 px-2.5 space-y-1 overflow-y-auto">
        <div className="px-2 mb-2">
          {!collapsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Core Modules
            </span>
          )}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const permKey = PERM_KEY_MAP[item.id];
          const isRestricted = currentUser && currentUser.role !== 'admin' && currentUser.permissions && permKey && currentUser.permissions[permKey] === 'none';

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-rose-600 text-white font-semibold shadow-sm'
                  : isRestricted
                    ? 'hover:bg-slate-800 text-slate-500 hover:text-slate-400 opacity-75'
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
              title={collapsed ? (isRestricted ? `${item.label} (Locked)` : item.label) : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isActive ? 'text-white' : isRestricted ? 'text-slate-500' : 'text-slate-400 group-hover:text-white'
                }`}
              />

              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {isRestricted ? (
                    <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                  ) : item.badge ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white text-rose-700' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Tooltip on collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {item.label} {isRestricted && '(Locked)'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Mini Pipeline Indicator at Bottom */}
      {!collapsed && stats?.pipelineValue > 0 && (
        <div className="m-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Pipeline Forecast
            </span>
            <span className="text-emerald-400 font-bold">{stats.winRate}% Win</span>
          </div>
          <div className="mt-1 text-sm font-extrabold text-white tracking-tight">
            ${Number(stats.pipelineValue).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Weighted: ${Number(stats.weightedPipeline).toLocaleString()}
          </div>
        </div>
      )}

      {/* Collapse Toggle Footer */}
      <div className="p-2 border-t border-slate-800 flex justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full flex items-center justify-center"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
