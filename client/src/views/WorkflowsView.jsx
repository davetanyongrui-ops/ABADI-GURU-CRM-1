import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { crmApi } from '../api';

export default function WorkflowsView() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    trigger_event: 'lead_created',
    description: '',
  });

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await crmApi.getWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCreating) {
        setIsCreating(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreating]);

  const handleToggle = async (id) => {
    try {
      await crmApi.toggleWorkflow(id);
      loadWorkflows();
    } catch (err) {
      alert('Error updating workflow: ' + err.message);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createWorkflow(form);
      setIsCreating(false);
      setForm({
        name: '',
        trigger_event: 'lead_created',
        description: '',
      });
      loadWorkflows();
    } catch (err) {
      alert('Error creating workflow: ' + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Automation & Workflows</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
              {workflows.filter(w => w.is_active).length} Active Rules
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zoho Workflow Automation Engine. Automatically schedule follow-ups, notify teams on deal milestones, and enforce sales processes.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Rule
        </button>
      </div>

      {/* Workflow Rule Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading workflow engine...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`p-5 rounded-2xl border bg-white shadow-xs transition-all flex flex-col justify-between ${
                wf.is_active ? 'border-slate-200 hover:border-amber-400' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      wf.is_active ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">{wf.name}</h3>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Trigger: {wf.trigger_event}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(wf.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title={wf.is_active ? 'Disable workflow' : 'Enable workflow'}
                  >
                    {wf.is_active ? (
                      <ToggleRight className="w-7 h-7 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  {wf.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <strong>{wf.execution_count}</strong> executions
                </span>
                <span>
                  {wf.last_triggered_at ? `Last run: ${wf.last_triggered_at.split(' ')[0]}` : 'Ready to trigger'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE WORKFLOW MODAL */}
      {isCreating && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreating(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">New Workflow Automation Rule</h3>
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

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High Value Deal Alert (> $100k)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Trigger Event</label>
                <select
                  value={form.trigger_event}
                  onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                >
                  <option value="lead_created">On New Lead Created</option>
                  <option value="deal_won">On Deal Stage Changed to "Closed Won"</option>
                  <option value="deal_created">On New Deal Created</option>
                  <option value="contact_created">On New Contact Registered</option>
                  <option value="lead_stale">On Inactive Lead (No activity &gt; 14 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Automation Action & Description</label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Explain automated task, webhook, or notification behavior..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Save & Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
