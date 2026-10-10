import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  PhoneCall,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
  Sparkles,
  Zap,
  Info,
  BarChart3,
  Award,
  ChevronRight,
  ArrowDownRight,
  Cake,
  MessageCircle,
  Mail,
  Heart,
  Plus,
  X,
  Lock,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { crmApi } from '../api';
import WhatsAppConnectModal from '../components/WhatsAppConnectModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const STAGE_COLORS = {
  'Qualification': '#94a3b8',
  'Needs Analysis': '#60a5fa',
  'Value Proposition': '#38bdf8',
  'Proposal / Price Quote': '#fbbf24',
  'Negotiation / Review': '#f97316',
  'Closed Won': '#10b981',
  'Closed Lost': '#ef4444',
};

const PIE_COLORS = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function DashboardView({ stats, onNavigate, onToggleTaskStatus, onRefresh }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('quarter'); // 'month' | 'quarter' | 'year'
  const [specialDays, setSpecialDays] = useState([]);
  const [whatsAppData, setWhatsAppData] = useState(null);

  // Sales Agent Creation & Management State
  const [createAgentModalOpen, setCreateAgentModalOpen] = useState(false);
  const [createAgentForm, setCreateAgentForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Sales Agent',
    phone: '',
    quota_target: 50000
  });
  const [createAgentLoading, setCreateAgentLoading] = useState(false);
  const [createAgentError, setCreateAgentError] = useState('');
  const [createAgentSuccess, setCreateAgentSuccess] = useState(null);
  const [salesAgents, setSalesAgents] = useState(stats?.salesAgents || []);

  React.useEffect(() => {
    if (stats?.salesAgents) {
      setSalesAgents(stats.salesAgents);
    }
  }, [stats?.salesAgents]);

  const handleCreateAgentSubmit = async (e) => {
    e.preventDefault();
    setCreateAgentLoading(true);
    setCreateAgentError('');
    setCreateAgentSuccess(null);
    try {
      const res = await crmApi.createSalesAgent(createAgentForm);
      setCreateAgentSuccess({
        message: res.message,
        agent: res.agent,
        credentials: {
          email: createAgentForm.email,
          password: createAgentForm.password
        }
      });
      setCreateAgentForm({
        name: '',
        email: '',
        password: '',
        role: 'Sales Agent',
        phone: '',
        quota_target: 50000
      });
      if (onRefresh) onRefresh();
      crmApi.getSalesAgents().then(agents => setSalesAgents(agents)).catch(() => {});
    } catch (err) {
      setCreateAgentError(err.message || 'Failed to create sales agent account');
    } finally {
      setCreateAgentLoading(false);
    }
  };

  React.useEffect(() => {
    crmApi.getSpecialDays().then(res => setSpecialDays(res || [])).catch(() => {});
  }, []);

  // Close modals on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (createAgentModalOpen) {
          setCreateAgentModalOpen(false);
          setCreateAgentSuccess(null);
        }
        if (whatsAppData) {
          setWhatsAppData(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createAgentModalOpen, whatsAppData]);

  if (!stats) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Loading Executive Sales Dashboard...
        </div>
      </div>
    );
  }

  const {
    summary = {},
    pipelineByStage = [],
    leadSources = [],
    salesRepPerformance = [],
    recentActivities = [],
    topAccounts = []
  } = stats;

  const totalClosedRevenue = summary.wonRevenue || 0;
  const totalOpenPipeline = summary.pipelineValue || 0;
  const weightedPipeline = summary.weightedPipeline || 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Executive Welcome & Pacing Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" /> Executive Pulse
            </span>
            <span className="text-slate-400 text-xs">Q4 2026 Fiscal Quarter</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Enterprise Sales Overview
          </h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Overall revenue pacing is <strong>+24.8% ahead of target</strong>. Total active pipeline of <strong>${Number(totalOpenPipeline).toLocaleString()}</strong> with an estimated weighted forecast of <strong>${Number(weightedPipeline).toLocaleString()}</strong>.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('reports')}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Full BI Reports & Funnel
          </button>
          <button
            onClick={() => onNavigate('deals')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl backdrop-blur-xs transition-colors flex items-center gap-1.5 border border-white/10"
          >
            <Briefcase className="w-3.5 h-3.5" /> Open Kanban Pipeline
          </button>
        </div>
      </div>

      {/* High-Impact Stat Cards with Clear Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Pipeline */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Pipeline Value
              <span title="Total sum of all non-closed deals" className="text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              ${Number(summary.pipelineValue || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-bold text-blue-600">{summary.pipelineCount || 0} active deals</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Weighted Forecast:</span>
            <span className="font-bold text-slate-700 font-mono">${Number(summary.weightedPipeline || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Closed Won Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Won Revenue
              <span title="Revenue officially signed and executed" className="text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              ${Number(summary.wonRevenue || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +24% vs Q3 Goal
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Deals Closed Won:</span>
            <span className="font-bold text-slate-700">{summary.wonCount || 0} contracts</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Sales Win Rate
              <span title="Percentage of concluded deals that resulted in a win" className="text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.winRate || 0}%
            </div>
            <div className="text-[11px] text-purple-700 font-semibold mt-1">
              Top Quartile Performance
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Concluded Deals:</span>
            <span className="font-bold text-slate-700">{summary.wonCount || 0} of {summary.wonCount || 0} won</span>
          </div>
        </div>

        {/* Active Leads */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Prospect Leads
              <span title="Unconverted incoming prospects" className="text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Target className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {summary.activeLeadsCount || 0}
            </div>
            <div className="text-[11px] text-rose-700 font-bold mt-1 flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> 3 Hot Tier Leads
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Converted to Accounts:</span>
            <span className="font-bold text-slate-700">{summary.convertedLeadsCount || 0} qualified</span>
          </div>
        </div>

        {/* Pending Activities */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              Tasks Due
              <span title="Action items due on or before today" className="text-slate-400 cursor-help">
                <Info className="w-3 h-3" />
              </span>
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              {summary.pendingTasksToday || 0}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              Requires Touchpoint
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Scheduled Today:</span>
            <span className="font-bold text-slate-700">Follow-ups active</span>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Value by Stage Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-rose-600" /> Pipeline Deal Value by Stage ($)
              </h2>
              <p className="text-xs text-slate-500">Financial distribution across active sales steps</p>
            </div>
            <button
              onClick={() => onNavigate('deals')}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 self-start sm:self-auto"
            >
              Open Kanban Board <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineByStage} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="stage" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  tickFormatter={(val) => `$${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`} 
                />
                <Tooltip
                  formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Deal Value']}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[6, 6, 0, 0]}
                  fill="#e11d48"
                >
                  {pipelineByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage] || '#e11d48'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Breakdown Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" /> Lead Channel Attribution
            </h2>
            <p className="text-xs text-slate-500">Volume distribution of prospect origins</p>
          </div>

          <div className="flex-1 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadSources}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {leadSources.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val, name) => [`${val} prospects`, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales Rep Leaderboard & Recent Activities Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Team Roster & Quota Pacing */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Sales Team & Rep Quotas
                </h2>
                <p className="text-xs text-slate-500">Live agent metrics, won revenue, and quota progress</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateAgentSuccess(null); setCreateAgentError(''); setCreateAgentModalOpen(true); }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Sales Agent
                </button>
                <button
                  onClick={() => onNavigate('reports')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 hidden sm:inline"
                >
                  Quotas &rarr;
                </button>
              </div>
            </div>

            {/* Quota Progress Bar (shown when sales agents exist) */}
            {(() => {
              const actualSalesAgents = (salesAgents || []).filter(a => !a.isOwner && !a.role?.toLowerCase().includes('admin') && !a.role?.toLowerCase().includes('owner'));
              if (actualSalesAgents.length === 0) return null;
              const targetQuota = actualSalesAgents.reduce((sum, a) => sum + (Number(a.quotaTarget || a.quota_target) || 0), 0);
              const progressPct = targetQuota > 0 ? Math.min(100, Math.round((totalClosedRevenue / targetQuota) * 100)) : 0;

              return (
                <div className="mb-4 p-3 bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-rose-500" /> Team Target (${targetQuota.toLocaleString()})
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {progressPct}% Attained
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${progressPct}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500"
                      title={`Won: $${totalClosedRevenue.toLocaleString()}`}
                    />
                    <div
                      style={{ width: `${Math.min(100 - progressPct, Math.round((totalOpenPipeline * 0.4 / (targetQuota || 1)) * 100))}%` }}
                      className="bg-blue-400 h-full transition-all duration-500 opacity-60"
                      title={`Pipeline Projection`}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5">
                    <span>Won: <strong className="text-emerald-700 font-mono">${totalClosedRevenue.toLocaleString()}</strong></span>
                    <span>Forecast: <strong className="text-blue-700 font-mono">${(totalClosedRevenue + Math.round(totalOpenPipeline * 0.4)).toLocaleString()}</strong></span>
                    <span>Remaining: <strong className="text-slate-700 font-mono">${Math.max(0, targetQuota - totalClosedRevenue).toLocaleString()}</strong></span>
                  </div>
                </div>
              );
            })()}

            {/* Sales Agents Roster */}
            <div className="space-y-2.5">
              {(() => {
                const actualSalesAgents = (salesAgents || []).filter(a => !a.isOwner && !a.role?.toLowerCase().includes('admin') && !a.role?.toLowerCase().includes('owner'));
                if (actualSalesAgents.length === 0) {
                  return (
                    <div className="p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-xs text-slate-800">No Sales Agent Accounts Yet</div>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                        This company workspace is new. You have not added any sales representatives yet. Click below to create your first sales agent account with custom permissions.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => { setCreateAgentSuccess(null); setCreateAgentError(''); setCreateAgentModalOpen(true); }}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Sales Agent Account</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return actualSalesAgents.map((agent, idx) => {
                  const name = agent.name;
                  const role = agent.role || 'Sales Agent';
                  const won = Number(agent.wonAmount || 0);
                  const pipeline = Number(agent.pipelineAmount || 0);
                  const deals = agent.dealCount || 0;
                  const quota = Number(agent.quotaTarget || agent.quota_target || 50000);
                  const progress = quota > 0 ? Math.min(100, Math.round((won / quota) * 100)) : 0;

                  return (
                    <div key={agent.id || agent.name || idx} className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-100/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={agent.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0284c7,e11d48,6366f1`}
                            alt={name}
                            className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 object-cover"
                          />
                          <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white absolute -bottom-0.5 -right-0.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              {role}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {agent.email ? (
                              <span>{agent.email}</span>
                            ) : (
                              <span>{deals} deals &bull; Pipeline: ${pipeline.toLocaleString()}</span>
                            )}
                            {agent.phone && <span>&bull; {agent.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end">
                        <div className="text-xs font-mono font-extrabold text-emerald-600">
                          ${won.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Quota: ${quota.toLocaleString()} ({progress}%)
                        </div>
                        <div className="w-20 bg-slate-200 h-1 rounded-full overflow-hidden mt-1 hidden sm:block">
                          <div
                            style={{ width: `${progress}%` }}
                            className="bg-emerald-500 h-full"
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-slate-400" /> All agents share your private company database</span>
            <button
              onClick={() => { setCreateAgentSuccess(null); setCreateAgentError(''); setCreateAgentModalOpen(true); }}
              className="text-rose-600 hover:text-rose-700 font-bold"
            >
              + Add Agent Seat
            </button>
          </div>
        </div>

        {/* Recent Activities Timeline with 1-click checkboxes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Scheduled Customer Tasks
              </h2>
              <p className="text-xs text-slate-500">Direct client touchpoints and discovery calls</p>
            </div>
            <button
              onClick={() => onNavigate('activities')}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              All Activities <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentActivities.map((act) => (
              <div key={act.id} className="py-3 flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => onToggleTaskStatus(act.id)}
                    className="mt-0.5 text-slate-300 hover:text-emerald-600 transition-colors"
                    title="Toggle completed status"
                  >
                    {act.is_closed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <div className="w-4 h-4 rounded border border-slate-300 hover:border-slate-500" />
                    )}
                  </button>

                  <div>
                    <div className={`text-xs font-semibold ${act.is_closed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {act.title}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="capitalize font-bold text-slate-700">{act.type}</span>
                      <span>&bull;</span>
                      <span className="text-slate-600">{act.related_to_name}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400">{act.due_date} {act.due_time}</span>
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  act.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {act.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client Milestones & Relationship Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Client Birthdays & Special Days */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" /> Upcoming Client Celebrations (Next 45 Days)
              </h2>
              <p className="text-xs text-slate-500">Birthdays and special milestones to build stronger relationships</p>
            </div>
            <button
              onClick={() => onNavigate('contacts')}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700"
            >
              All Contacts &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {specialDays.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                No celebrations coming up in the next 45 days. Add customer birthdays in the Contacts directory!
              </div>
            ) : (
              specialDays.slice(0, 4).map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-pink-50/40 border border-pink-100 flex items-center justify-between hover:bg-pink-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 font-extrabold flex items-center justify-center text-xs">
                      {item.type === 'birthday' ? <Cake className="w-4 h-4 text-pink-600" /> : <Award className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>{item.personName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({item.companyName || 'Individual'})</span>
                      </div>
                      <div className="text-[11px] text-pink-700 font-semibold mt-0.5">
                        {item.eventTitle}: {item.daysUntil === 0 ? 'Today' : `in ${item.daysUntil} days (${item.formattedDate})`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.phone && (
                      <button
                        onClick={() => {
                          setWhatsAppData({
                            recipient: {
                              name: item.personName,
                              first_name: item.personName.split(' ')[0],
                              company: item.companyName,
                              phone: item.phone,
                              special_day_title: item.eventTitle,
                              id: item.id,
                              type: item.type === 'lead' ? 'lead' : 'contact'
                            },
                            template: 'birthday'
                          });
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                        title="Send Greeting via WhatsApp Sales Connect"
                      >
                        <MessageCircle className="w-3 h-3" /> Wish
                      </button>
                    )}
                    {item.email && (
                      <a
                        href={`mailto:${item.email}?subject=${encodeURIComponent(`Happy ${item.eventTitle.replace(/[^a-zA-Z]/g, '')}!`)}&body=${encodeURIComponent(`Hi ${item.personName.split(' ')[0]},\n\nWishing you a fantastic celebration!\n\nBest regards.`)}`}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Send Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Client Current Situations Watchlist */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" /> Client Situations Watchlist
              </h2>
              <p className="text-xs text-slate-500">Live context snapshots: know exactly what is happening before you call</p>
            </div>
            <button
              onClick={() => onNavigate('contacts')}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700"
            >
              View Directory &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {specialDays.filter(x => x.situation).length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                No active client situations logged yet. Keep your team informed by recording situations in client profiles!
              </div>
            ) : (
              specialDays.filter(x => x.situation).slice(0, 3).map((item) => (
                <div key={`sit-${item.id}`} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <strong className="text-purple-700">{item.personName}</strong>
                      <span className="text-slate-400 font-normal">({item.companyName})</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {item.relationshipHealth || 'Strong & Warm'}
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-200/60">
                    "{item.situation}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Sales Outreach Modal */}
      {whatsAppData && (
        <WhatsAppConnectModal
          isOpen={true}
          onClose={() => setWhatsAppData(null)}
          recipient={whatsAppData.recipient}
          defaultTemplateType={whatsAppData.template}
        />
      )}

      {/* Create Sales Agent Account Modal */}
      {createAgentModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCreateAgentModalOpen(false);
              setCreateAgentSuccess(null);
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans cursor-pointer"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-fade-in text-slate-900 my-8 cursor-default">
            {/* Close */}
            <button
              type="button"
              onClick={() => { setCreateAgentModalOpen(false); setCreateAgentSuccess(null); }}
              title="Close (Esc)"
              aria-label="Close"
              className="absolute top-5 right-5 p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {createAgentSuccess ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-900">Sales Agent Account Created!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Your sales representative can now sign in to your company workspace.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Agent Name:</span>
                    <strong className="text-slate-900">{createAgentSuccess.agent?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Login Email:</span>
                    <strong className="text-slate-900 font-mono">{createAgentSuccess.credentials?.email}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Initial Password:</span>
                    <strong className="text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {createAgentSuccess.credentials?.password}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Role:</span>
                    <strong className="text-blue-700">{createAgentSuccess.agent?.role}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Monthly Target:</span>
                    <strong className="text-emerald-700 font-mono">${Number(createAgentSuccess.agent?.quota_target || 50000).toLocaleString()}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setCreateAgentModalOpen(false); setCreateAgentSuccess(null); }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Done & Back to Dashboard
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateAgentSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Create Sales Agent Account</h3>
                    <p className="text-xs text-slate-500">Provision a sales representative seat for your company</p>
                  </div>
                </div>

                {createAgentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                    {createAgentError}
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Company Workspace Access:</strong> This agent logs directly into your company CRM database with their own credentials.
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Agent Full Name *</label>
                    <input
                      type="text"
                      required
                      value={createAgentForm.name}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, name: e.target.value })}
                      placeholder="e.g. Dominic Torres"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={createAgentForm.email}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, email: e.target.value })}
                        placeholder="dominic@company.com"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Initial Password *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={createAgentForm.password}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Assigned Role</label>
                      <select
                        value={createAgentForm.role}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, role: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                      >
                        <option value="Sales Agent">Sales Agent</option>
                        <option value="Account Executive">Account Executive</option>
                        <option value="Senior Sales Rep">Senior Sales Rep</option>
                        <option value="Sales Manager">Sales Manager</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Monthly Quota ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={createAgentForm.quota_target}
                        onChange={(e) => setCreateAgentForm({ ...createAgentForm, quota_target: e.target.value })}
                        placeholder="50000"
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Phone / WhatsApp (Optional)</label>
                    <input
                      type="text"
                      value={createAgentForm.phone}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, phone: e.target.value })}
                      placeholder="+1 (555) 234-5678"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createAgentLoading}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
                >
                  {createAgentLoading ? 'Creating Agent Seat...' : 'Create Sales Agent Account'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
