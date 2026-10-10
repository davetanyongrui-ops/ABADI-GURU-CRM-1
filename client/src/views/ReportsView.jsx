import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  Sparkles,
  ArrowRight,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  Zap,
  DollarSign,
  ChevronRight,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';
import { crmApi } from '../api';

export default function ReportsView({ onNavigate }) {
  const [funnelData, setFunnelData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [quotasData, setQuotasData] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('revenue'); // 'revenue' | 'pipeline'

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const [funnel, trend, quotas, ins] = await Promise.all([
          crmApi.getFunnelReport(),
          crmApi.getMonthlyTrendReport(),
          crmApi.getQuotasReport(),
          crmApi.getInsightsReport(),
        ]);
        setFunnelData(funnel);
        setTrendData(trend);
        setQuotasData(quotas);
        setInsights(ins);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          Calculating Sales Velocity & Conversion Analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Executive BI & Analytics</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-500" /> ABADI GURU Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Conversion drop-off funnels, 6-month revenue trajectories, and rep quota attainment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print BI Brief
          </button>
        </div>
      </div>

      {/* AI Sales Pulse Narrative Insights */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-3">
          <Zap className="w-4 h-4 fill-rose-400" /> Executive Sales Pulse & Forecast Insights
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {insights.map((item) => (
            <div
              key={item.id}
              className="bg-white/10 hover:bg-white/15 p-3.5 rounded-xl backdrop-blur-xs border border-white/10 transition-colors flex flex-col justify-between"
            >
              <div>
                <span className="font-extrabold text-white text-xs block mb-1">
                  {item.title}
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {item.summary}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit mt-3 ${
                item.priority === 'positive' ? 'bg-emerald-500/20 text-emerald-300' :
                item.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300' :
                item.priority === 'high' ? 'bg-amber-500/20 text-amber-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {item.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Sales Funnel Visualization */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-600" /> Pipeline Conversion Funnel
            </h2>
            <p className="text-xs text-slate-500">
              Drop-off velocity from initial lead inquiry down to closed won revenue
            </p>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Benchmark Target: &gt; 15% Total Funnel Conversion
          </div>
        </div>

        {/* Funnel Steps */}
        <div className="space-y-3">
          {funnelData.map((stage, idx) => {
            // Visual width proportion (from 100% down to minimum 25%)
            const widthPct = Math.max(25, stage.conversionPct);

            return (
              <div key={stage.step} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                      {stage.step}
                    </span>
                    <span className="text-slate-900 font-bold">{stage.name}</span>
                    <span className="text-[11px] text-slate-400 font-normal hidden md:inline">
                      &bull; {stage.description}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-900">
                      {stage.count} {stage.count === 1 ? 'record' : 'records'}
                    </span>
                    <span className="text-slate-500 text-[11px] font-mono">
                      ${Number(stage.value).toLocaleString()}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      stage.conversionPct >= 70 ? 'bg-emerald-100 text-emerald-800' :
                      stage.conversionPct >= 40 ? 'bg-blue-100 text-blue-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {stage.conversionPct}%
                    </span>
                  </div>
                </div>

                {/* Funnel Bar Container */}
                <div className="w-full bg-slate-100 rounded-lg h-7 overflow-hidden p-0.5 flex">
                  <div
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color,
                    }}
                    className="h-full rounded-md transition-all duration-500 flex items-center px-3 text-white text-[10px] font-bold shadow-xs justify-between"
                  >
                    <span className="truncate">{stage.name}</span>
                    <span className="font-mono">{stage.conversionPct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6-Month Revenue & Pipeline Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> 6-Month Revenue & Pipeline Trend ($)
              </h2>
              <p className="text-xs text-slate-500">Historical performance vs Q4 targets and projected momentum</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Won Revenue
              </span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="flex items-center gap-1 text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Pipeline Created
              </span>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="pipelineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `$${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                />
                <Tooltip
                  formatter={(val) => [`$${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="pipeline"
                  name="Pipeline Created"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pipelineGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="won"
                  name="Closed Won Revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#wonGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rep Quota Attainment Leaderboard */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Q4 Sales Quota Attainment
              </h2>
              <p className="text-xs text-slate-500">Individual rep pacing against quarterly goal</p>
            </div>

            <div className="space-y-4">
              {quotasData.map((quota) => (
                <div key={quota.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{quota.user_name}</span>
                      <span className="text-[10px] text-slate-400">Target: ${Number(quota.target_amount).toLocaleString()}</span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      quota.percentage >= 100 ? 'bg-emerald-100 text-emerald-800' :
                      quota.percentage >= 70 ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {quota.percentage}% Attained
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quota.percentage >= 100 ? 'bg-emerald-500' :
                        quota.percentage >= 70 ? 'bg-blue-500' :
                        'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, quota.percentage)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>Achieved: <strong>${Number(quota.achieved_amount).toLocaleString()}</strong></span>
                    <span>Gap: <strong>${Number(quota.remaining).toLocaleString()}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Team is tracking <strong>114% of plan</strong> for the current quarter.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
