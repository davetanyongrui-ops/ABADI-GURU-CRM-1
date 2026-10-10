import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Building2,
  User,
  ChevronRight,
  TrendingUp,
  X,
  CheckCircle2,
  List,
  Layers,
  ArrowRight,
  Trash2,
  Edit3,
  FileText,
  AlertTriangle,
  Clock,
  Sparkles,
  Award,
  HelpCircle,
  Receipt,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Download
} from 'lucide-react';
import { crmApi } from '../api';

const PIPELINE_STAGES = [
  { name: 'Qualification', prob: 10, color: 'border-t-slate-400 bg-slate-50/50' },
  { name: 'Needs Analysis', prob: 20, color: 'border-t-blue-400 bg-blue-50/20' },
  { name: 'Value Proposition', prob: 40, color: 'border-t-sky-400 bg-sky-50/20' },
  { name: 'Proposal / Price Quote', prob: 60, color: 'border-t-amber-400 bg-amber-50/20' },
  { name: 'Negotiation / Review', prob: 80, color: 'border-t-orange-400 bg-orange-50/20' },
  { name: 'Closed Won', prob: 100, color: 'border-t-emerald-500 bg-emerald-50/20' },
  { name: 'Closed Lost', prob: 0, color: 'border-t-rose-400 bg-rose-50/20' },
];

export default function DealsView({ onNavigate, selectedDealId, onRefreshStats }) {
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [segmentFilter, setSegmentFilter] = useState('All'); // 'All' | 'Large' | 'ClosingSoon' | 'HighProb'
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [showPipelineGuide, setShowPipelineGuide] = useState(false);

  // Modals & Details
  const [activeDeal, setActiveDeal] = useState(null);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [draggedDealId, setDraggedDealId] = useState(null);

  // New Deal Form
  const [dealForm, setDealForm] = useState({
    name: '',
    account_id: '',
    account_name: '',
    contact_id: '',
    contact_name: '',
    amount: '',
    stage: 'Qualification',
    closing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    type: 'New Business',
    lead_source: 'Web Form',
    priority: 'High',
    description: '',
  });

  const loadDeals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (ownerFilter !== 'All') params.owner = ownerFilter;
      if (search) params.q = search;
      const data = await crmApi.getDeals(params);
      setDeals(data);

      if (selectedDealId) {
        const found = data.find(d => d.id === Number(selectedDealId));
        if (found) openDealDetails(found.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
    try {
      const [accs, cons] = await Promise.all([crmApi.getAccounts(), crmApi.getContacts()]);
      setAccounts(accs);
      setContacts(cons);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDeals();
    loadLookups();

    // Auto-sync in background so changes from Telegram or AI appear instantly
    const timer = setInterval(async () => {
      try {
        const params = {};
        if (ownerFilter !== 'All') params.owner = ownerFilter;
        if (search) params.q = search;
        const data = await crmApi.getDeals(params);
        setDeals(data);
      } catch (err) {}
    }, 4000);

    return () => clearInterval(timer);
  }, [ownerFilter, search, selectedDealId]);

  // Global Escape key listener to close modals / drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isCreatingDeal) setIsCreatingDeal(false);
        else if (activeDeal) setActiveDeal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreatingDeal, activeDeal]);

  const openDealDetails = async (id) => {
    try {
      const full = await crmApi.getDeal(id);
      setActiveDeal(full);
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, dealId) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    const dealId = draggedDealId || Number(e.dataTransfer.getData('text/plain'));
    if (!dealId) return;

    try {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d));
      await crmApi.updateDealStage(dealId, targetStage);
      setDraggedDealId(null);
      loadDeals();
      if (onRefreshStats) onRefreshStats();
      if (activeDeal && activeDeal.id === dealId) {
        openDealDetails(dealId);
      }
    } catch (err) {
      alert('Error updating deal stage: ' + err.message);
      loadDeals();
    }
  };

  const advanceDealStage = async (e, deal, direction = 1) => {
    if (e) e.stopPropagation();
    const currentIdx = PIPELINE_STAGES.findIndex(s => s.name === deal.stage);
    if (currentIdx === -1) return;
    const targetIdx = currentIdx + direction;
    if (targetIdx >= 0 && targetIdx < PIPELINE_STAGES.length) {
      const targetStage = PIPELINE_STAGES[targetIdx].name;
      try {
        setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d));
        await crmApi.updateDealStage(deal.id, targetStage);
        loadDeals();
        if (onRefreshStats) onRefreshStats();
        if (activeDeal && activeDeal.id === deal.id) {
          openDealDetails(deal.id);
        }
      } catch (err) {
        alert('Failed to update stage: ' + err.message);
        loadDeals();
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createDeal(dealForm);
      setIsCreatingDeal(false);
      setDealForm({
        name: '',
        account_id: '',
        account_name: '',
        contact_id: '',
        contact_name: '',
        amount: '',
        stage: 'Qualification',
        closing_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        type: 'New Business',
        lead_source: 'Web Form',
        priority: 'High',
        description: '',
      });
      loadDeals();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert('Error creating deal: ' + err.message);
    }
  };

  const handleDeleteDeal = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deal?')) return;
    try {
      await crmApi.deleteDeal(id);
      if (activeDeal?.id === id) setActiveDeal(null);
      loadDeals();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert('Error deleting deal: ' + err.message);
    }
  };

  // Note in deal drawer
  const [noteContent, setNoteContent] = useState('');
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || !activeDeal) return;
    try {
      await crmApi.createNote({
        related_to_type: 'deal',
        related_to_id: activeDeal.id,
        content: noteContent,
        created_by_name: 'Alex Mercer',
      });
      setNoteContent('');
      openDealDetails(activeDeal.id);
    } catch (err) {
      alert('Failed to add note: ' + err.message);
    }
  };

  // Segment Filtered deals
  const filteredDeals = deals.filter(d => {
    if (segmentFilter === 'Large') return Number(d.amount) >= 50000;
    if (segmentFilter === 'HighProb') return Number(d.probability) >= 60;
    if (segmentFilter === 'ClosingSoon') {
      const closing = new Date(d.closing_date);
      const now = new Date();
      return (closing - now) <= 30 * 86400000;
    }
    return true;
  });

  const totalPipeline = filteredDeals.reduce((acc, d) => d.stage !== 'Closed Lost' ? acc + Number(d.amount) : acc, 0);
  const totalWeighted = filteredDeals.reduce((acc, d) => d.stage !== 'Closed Lost' ? acc + Number(d.expected_revenue || 0) : acc, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-full mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Deals & Pipeline Stage Velocity</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 font-mono">
              Total: ${totalPipeline.toLocaleString()}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 font-mono">
              Weighted: ${totalWeighted.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zoho Kanban Pipeline with priority indicators, stage aging telemetry, and live probability recalculation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Pipeline Kanban"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
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
          </div>

          <a
            href={crmApi.getExportUrl('deals')}
            download="abadi_guru_deals_export.csv"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200 shadow-2xs flex items-center gap-1.5"
            title="Export full deals pipeline to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </a>

          <button
            onClick={() => setIsCreatingDeal(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Deal
          </button>
        </div>
      </div>

      {/* Educational Pipeline Guide Accordion */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-indigo-900/60 shadow-xs">
        <div 
          onClick={() => setShowPipelineGuide(!showPipelineGuide)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-xs tracking-tight text-white block">
                How Deals & The Sales Pipeline Work in ABADI GURU CRM
              </span>
              <span className="text-[11px] text-slate-300">
                {showPipelineGuide ? 'Click to hide explainer guide' : 'Click to learn how deals, 7-stage probabilities, and 1-click invoice conversions work'}
              </span>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white p-1">
            {showPipelineGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showPipelineGuide && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs animate-fade-in">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5 mb-1">
                <Briefcase className="w-3.5 h-3.5" /> 1. Lead vs Deal
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                A <strong>Lead</strong> is an unqualified contact. A <strong>Deal</strong> is a qualified opportunity with a committed dollar budget ($) and expected closing date.
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5" /> 2. Stage Progression
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Move deals left-to-right across the 7 stages as client negotiations advance. Win probability scales from <strong>10% (Qualification)</strong> to <strong>100% (Closed Won)</strong>.
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5" /> 3. Weighted Forecast
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Expected revenue = <code>Deal Amount × Probability %</code>. This provides sales managers with an accurate, probability-weighted revenue projection.
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5" /> 4. Convert to Invoice
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                When a deal reaches <strong>Proposal</strong> or <strong>Closed Won</strong>, click <em>Invoice</em> on the deal card to instantly generate a client invoice & export PDF.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar with Quick Segment Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals by title or account name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Quick Segment Filter */}
          <label className="text-slate-500 font-medium">Filter:</label>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Pipeline Deals</option>
            <option value="Large">Enterprise Deals (&gt; $50k)</option>
            <option value="HighProb">High Probability (&ge; 60%)</option>
            <option value="ClosingSoon">Closing Next 30 Days</option>
          </select>

          <label className="text-slate-500 font-medium ml-2">Sales Rep:</label>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Representatives</option>
            <option value="Alex Mercer">Alex Mercer</option>
            <option value="Elena Vance">Elena Vance</option>
            <option value="David Chen">David Chen</option>
          </select>
        </div>
      </div>

      {/* Pipeline Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading pipeline opportunities...</div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 overflow-x-auto pb-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.name);
            const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.amount), 0);
            const stageWeighted = stageDeals.reduce((sum, d) => sum + Number(d.expected_revenue || 0), 0);

            return (
              <div
                key={stage.name}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.name)}
                className={`flex flex-col rounded-xl border border-slate-200 border-t-4 ${stage.color} p-2.5 min-w-[245px] max-w-[280px] shadow-2xs transition-colors`}
              >
                {/* Column Header */}
                <div className="mb-2.5 pb-2 border-b border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-slate-900 tracking-tight leading-tight">
                      {stage.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                      {stage.prob}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="font-bold text-slate-900 font-mono">${stageTotal.toLocaleString()}</span>
                    <span className="text-slate-400 font-medium">{stageDeals.length} deals</span>
                  </div>

                  <div className="text-[10px] text-emerald-600 font-semibold font-mono mt-0.5">
                    wt: ${stageWeighted.toLocaleString()}
                  </div>
                </div>

                {/* Deal Cards Container */}
                <div className="space-y-2.5 flex-1 min-h-[320px]">
                  {stageDeals.map((deal) => {
                    const days = deal.days_in_stage || 3;
                    const isAging = days >= 6 && deal.stage !== 'Closed Won' && deal.stage !== 'Closed Lost';

                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onClick={() => openDealDetails(deal.id)}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:shadow-md cursor-grab active:cursor-grabbing transition-all text-xs space-y-2 select-none group relative"
                      >
                        {/* Priority Flag & Aging Indicator */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                            deal.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                            deal.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {deal.priority || 'Normal'}
                          </span>

                          {isAging ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1" title="Deal has been in stage over 5 days">
                              <AlertTriangle className="w-3 h-3 text-amber-500" /> {days}d in stage
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {days}d
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-900 group-hover:text-rose-600 leading-snug">
                          {deal.name}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{deal.account_name}</span>
                        </div>

                        {/* Probability Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${deal.probability}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="font-extrabold text-slate-900 font-mono">
                            ${Number(deal.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {deal.closing_date}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate">{deal.owner_name}</span>
                          <span className="text-emerald-600 font-semibold font-mono">
                            ${Number(deal.expected_revenue || 0).toLocaleString()} wt
                          </span>
                        </div>

                        {/* 1-Click Actions: Stage Progression & Quotation / Invoice */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                          {/* Stage Navigation Arrows */}
                          <div className="flex items-center gap-0.5">
                            {PIPELINE_STAGES.findIndex(s => s.name === deal.stage) > 0 && (
                              <button
                                type="button"
                                onClick={(e) => advanceDealStage(e, deal, -1)}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                title="Move to previous stage"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">#{deal.id}</span>
                            {PIPELINE_STAGES.findIndex(s => s.name === deal.stage) < PIPELINE_STAGES.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => advanceDealStage(e, deal, 1)}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                title="Advance to next stage"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigate) onNavigate('quotes', { createFromDeal: deal, docType: 'Quotation' });
                              }}
                              className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded text-[10px] flex items-center gap-0.5 transition-colors border border-sky-100"
                              title="Generate Price Quotation from this Deal"
                            >
                              <FileText className="w-2.5 h-2.5 text-sky-600" /> Quote
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigate) onNavigate('quotes', { createFromDeal: deal, docType: 'Invoice' });
                              }}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[10px] flex items-center gap-0.5 transition-colors border border-emerald-100"
                              title="Generate Tax Invoice from this Deal"
                            >
                              <Receipt className="w-2.5 h-2.5 text-emerald-600" /> Invoice
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stageDeals.length === 0 && (
                    <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-[11px] text-slate-400">
                      Drop deals here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Deal Name</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Probability</th>
                  <th className="py-3 px-4 text-right">Amount ($)</th>
                  <th className="py-3 px-4">Closing Date</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openDealDetails(deal.id)}
                        className="font-bold text-slate-900 hover:text-rose-600 text-left"
                      >
                        {deal.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        deal.priority === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {deal.priority || 'Normal'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {deal.account_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {deal.contact_name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                        {deal.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {deal.probability}%
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900 font-mono">
                      ${Number(deal.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {deal.closing_date}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {deal.owner_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDealDetails(deal.id)}
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

      {/* DEAL DETAIL DRAWER */}
      {activeDeal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveDeal(null);
          }}
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end cursor-pointer"
        >
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto cursor-default">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-sm">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeDeal.name}</h2>
                  <div className="text-xs text-slate-500">{activeDeal.account_name} &bull; {activeDeal.type}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveDeal(null)}
                aria-label="Close drawer"
                title="Close (Esc)"
                className="p-2 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ZOHO STAGE CHEVRON PROGRESS BAR */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Pipeline Stage Progression
              </div>
              <div className="flex items-center gap-1 min-w-[500px]">
                {PIPELINE_STAGES.map((s, idx) => {
                  const currentIdx = PIPELINE_STAGES.findIndex(item => item.name === activeDeal.stage);
                  const isCurrent = s.name === activeDeal.stage;
                  const isCompleted = idx < currentIdx;

                  return (
                    <button
                      key={s.name}
                      onClick={() => handleDrop({ preventDefault: () => {} }, s.name)}
                      className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded text-center transition-all ${
                        isCurrent
                          ? 'bg-rose-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* Quick Conversion & Actions Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDeal(null);
                    if (onNavigate) onNavigate('quotes', { createFromDeal: activeDeal, docType: 'Quotation' });
                  }}
                  className="py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileText className="w-4 h-4" /> Create Quotation
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveDeal(null);
                    if (onNavigate) onNavigate('quotes', { createFromDeal: activeDeal, docType: 'Invoice' });
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Receipt className="w-4 h-4" /> Issue Invoice
                </button>

                {activeDeal.stage !== 'Closed Won' ? (
                  <button
                    type="button"
                    onClick={() => handleDrop({ preventDefault: () => {} }, 'Closed Won')}
                    className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Award className="w-4 h-4" /> Mark as Closed Won
                  </button>
                ) : (
                  <div className="py-2.5 px-3 bg-emerald-100 text-emerald-800 font-bold rounded-xl flex items-center justify-center gap-1.5 text-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Deal Won
                  </div>
                )}
              </div>

              {/* Financial Box */}
              <div className="grid grid-cols-3 gap-3 bg-slate-900 text-white p-4 rounded-xl shadow-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Deal Amount</span>
                  <span className="text-base font-black text-white font-mono">${Number(activeDeal.amount).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Probability</span>
                  <span className="text-base font-black text-amber-400">{activeDeal.probability}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Weighted Value</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    ${Number(activeDeal.expected_revenue || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Deal Details Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Account</span>
                  <span className="font-semibold text-slate-800">{activeDeal.account_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Primary Contact</span>
                  <span className="font-semibold text-slate-800">{activeDeal.contact_name || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected Close</span>
                  <span className="font-semibold text-slate-800">{activeDeal.closing_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Deal Owner</span>
                  <span className="font-semibold text-slate-800">{activeDeal.owner_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Priority Tier</span>
                  <span className="font-semibold text-slate-800">{activeDeal.priority || 'High'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Business Type</span>
                  <span className="font-semibold text-slate-800">{activeDeal.type}</span>
                </div>
              </div>

              {/* Scope */}
              {activeDeal.description && (
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">Scope & Objectives</h4>
                  <p className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                    {activeDeal.description}
                  </p>
                </div>
              )}

              {/* Discussion & Stage History Notes */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Deal History & Notes</h4>
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Log update, client meeting notes, or next steps..."
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
                  {activeDeal.notes?.map(n => (
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

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-between bg-slate-50">
              <button
                onClick={() => handleDeleteDeal(activeDeal.id)}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Deal
              </button>
              <button
                onClick={() => setActiveDeal(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DEAL MODAL */}
      {isCreatingDeal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreatingDeal(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Create New Opportunity / Deal</h3>
              <button
                type="button"
                onClick={() => setIsCreatingDeal(false)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Deal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp - Enterprise Cloud Migration"
                  value={dealForm.name}
                  onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Account (Company) *</label>
                  <select
                    required
                    value={dealForm.account_id}
                    onChange={(e) => {
                      const selected = accounts.find(a => a.id === Number(e.target.value));
                      setDealForm({
                        ...dealForm,
                        account_id: e.target.value,
                        account_name: selected ? selected.name : ''
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="">Select Account...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
                  <select
                    value={dealForm.contact_id}
                    onChange={(e) => {
                      const selected = contacts.find(c => c.id === Number(e.target.value));
                      setDealForm({
                        ...dealForm,
                        contact_id: e.target.value,
                        contact_name: selected ? `${selected.first_name} ${selected.last_name}` : ''
                      });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="">Select Contact...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.account_name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Deal Amount ($) *</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={dealForm.amount}
                    onChange={(e) => setDealForm({ ...dealForm, amount: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Pipeline Stage</label>
                  <select
                    value={dealForm.stage}
                    onChange={(e) => setDealForm({ ...dealForm, stage: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    {PIPELINE_STAGES.map(s => <option key={s.name} value={s.name}>{s.name} ({s.prob}%)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Priority</label>
                  <select
                    value={dealForm.priority}
                    onChange={(e) => setDealForm({ ...dealForm, priority: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Closing Date</label>
                <input
                  type="date"
                  required
                  value={dealForm.closing_date}
                  onChange={(e) => setDealForm({ ...dealForm, closing_date: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Description / Requirements</label>
                <textarea
                  rows={2}
                  value={dealForm.description}
                  onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
                  placeholder="Key project goals and deal parameters..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingDeal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
