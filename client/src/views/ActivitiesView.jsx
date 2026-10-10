import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Plus,
  CheckCircle2,
  Clock,
  PhoneCall,
  Calendar,
  Users,
  Search,
  Filter,
  CheckSquare,
  Video,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { crmApi } from '../api';

export default function ActivitiesView({ onRefreshStats }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('All'); // 'All' | 'task' | 'call' | 'meeting'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Not Started' | 'In Progress' | 'Completed'
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'

  // Current Calendar Month
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1)); // Oct 2026

  // Creation Modals
  const [modalType, setModalType] = useState(null); // 'task' | 'call' | 'meeting' | null

  const [form, setForm] = useState({
    title: '',
    type: 'task',
    priority: 'Normal',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '10:00',
    duration_minutes: 30,
    related_to_name: '',
    call_type: 'Outbound',
    call_result: 'Interested',
    meeting_location: 'Google Meet',
    description: '',
  });

  const loadActivities = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter !== 'All') params.type = typeFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search) params.q = search;
      const data = await crmApi.getActivities(params);
      setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [typeFilter, statusFilter, search]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalType) {
        setModalType(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalType]);

  const toggleStatus = async (id) => {
    try {
      await crmApi.toggleActivityStatus(id);
      loadActivities();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete activity?')) return;
    try {
      await crmApi.deleteActivity(id);
      loadActivities();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createActivity({
        ...form,
        type: modalType,
      });
      setModalType(null);
      setForm({
        title: '',
        type: 'task',
        priority: 'Normal',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '10:00',
        duration_minutes: 30,
        related_to_name: '',
        call_type: 'Outbound',
        call_result: 'Interested',
        meeting_location: 'Google Meet',
        description: '',
      });
      loadActivities();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      alert('Error creating activity: ' + err.message);
    }
  };

  // Calendar generation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Activities & Calendar</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
              {activities.filter(a => !a.is_closed).length} Open
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zoho unified schedule. Log client calls, organize tasks, and sync client meetings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          <button
            onClick={() => { setModalType('task'); setForm(f => ({ ...f, type: 'task' })); }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1"
          >
            <CheckSquare className="w-3.5 h-3.5" /> + Task
          </button>
          <button
            onClick={() => { setModalType('call'); setForm(f => ({ ...f, type: 'call' })); }}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1"
          >
            <PhoneCall className="w-3.5 h-3.5" /> Log Call
          </button>
          <button
            onClick={() => { setModalType('meeting'); setForm(f => ({ ...f, type: 'meeting' })); }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1"
          >
            <Video className="w-3.5 h-3.5" /> + Meeting
          </button>
        </div>
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
              placeholder="Search activities by subject or related entity..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500 font-medium">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Types</option>
            <option value="task">Tasks Only</option>
            <option value="call">Calls Only</option>
            <option value="meeting">Meetings Only</option>
          </select>

          <label className="text-slate-500 font-medium ml-2">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium outline-hidden"
          >
            <option value="All">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* List or Calendar View */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading activities...</div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-10">Done</th>
                  <th className="py-3 px-4">Subject & Type</th>
                  <th className="py-3 px-4">Related To</th>
                  <th className="py-3 px-4">Due Date & Time</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {activities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(act.id)}
                        className="text-slate-300 hover:text-emerald-600 transition-colors"
                        title="Toggle status"
                      >
                        {act.is_closed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-300 hover:border-slate-500" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className={`font-bold ${act.is_closed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {act.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 capitalize">
                        {act.type === 'task' && <CheckSquare className="w-3 h-3 text-amber-500" />}
                        {act.type === 'call' && <PhoneCall className="w-3 h-3 text-cyan-500" />}
                        {act.type === 'meeting' && <Video className="w-3 h-3 text-indigo-500" />}
                        <span>{act.type}</span>
                        {act.call_result && <span>&bull; Result: {act.call_result}</span>}
                        {act.meeting_location && <span>&bull; Location: {act.meeting_location}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {act.related_to_name || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div>{act.due_date}</div>
                      <div className="text-[10px] text-slate-400">{act.due_time} ({act.duration_minutes}m)</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        act.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                        act.priority === 'Normal' ? 'bg-slate-100 text-slate-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {act.priority}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        act.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                        act.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {act.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {act.owner_name}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(act.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete activity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* INTERACTIVE MONTHLY CALENDAR VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* Blank filler days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="h-28 bg-slate-50/50 rounded-lg p-1.5" />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayActivities = activities.filter(a => a.due_date === dateStr);

              return (
                <div
                  key={`day-${dayNum}`}
                  className="h-28 bg-white border border-slate-200 rounded-lg p-1.5 flex flex-col justify-between hover:border-rose-400 transition-colors overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-800">{dayNum}</span>
                    {dayActivities.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-20 text-[10px]">
                    {dayActivities.map(act => (
                      <div
                        key={act.id}
                        onClick={() => toggleStatus(act.id)}
                        className={`px-1.5 py-0.5 rounded font-medium truncate cursor-pointer transition-colors ${
                          act.is_closed
                            ? 'bg-slate-100 text-slate-400 line-through'
                            : act.type === 'meeting'
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : act.type === 'call'
                            ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        }`}
                        title={act.title}
                      >
                        {act.due_time} {act.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE ACTIVITY MODAL */}
      {modalType && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalType(null);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between capitalize">
              <h3 className="font-bold text-slate-900 text-sm">
                {modalType === 'call' ? 'Log Telephone Call' : modalType === 'meeting' ? 'Schedule Meeting' : 'Create Task'}
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                title="Close (Esc)"
                aria-label="Close"
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Subject / Title *</label>
                <input
                  type="text"
                  required
                  placeholder={modalType === 'call' ? 'e.g. Discuss Q4 SLA pricing' : 'e.g. Send technical architecture overview'}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Related Client / Entity</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Global Logistics / Marcus Brody"
                  value={form.related_to_name}
                  onChange={(e) => setForm({ ...form, related_to_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Time</label>
                  <input
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm({ ...form, due_time: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  >
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Call specific fields */}
              {modalType === 'call' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Call Direction</label>
                    <select
                      value={form.call_type}
                      onChange={(e) => setForm({ ...form, call_type: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    >
                      <option value="Outbound">Outbound</option>
                      <option value="Inbound">Inbound</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Call Result</label>
                    <select
                      value={form.call_result}
                      onChange={(e) => setForm({ ...form, call_result: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                    >
                      <option value="Interested">Interested / Qualified</option>
                      <option value="Left Message">Left Voicemail</option>
                      <option value="Busy">Busy / No Answer</option>
                      <option value="Follow-up Requested">Follow-up Requested</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Meeting specific fields */}
              {modalType === 'meeting' && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Location or Video URL</label>
                  <input
                    type="text"
                    placeholder="e.g. Zoom Conference / Google Meet"
                    value={form.meeting_location}
                    onChange={(e) => setForm({ ...form, meeting_location: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Key discussion points..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
