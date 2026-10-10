import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, X, Send, Bot, User, Trash2, ArrowRight,
  CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
  TrendingUp, Users, DollarSign, Calendar, Cpu
} from 'lucide-react';
import { crmApi } from '../api';

const QUICK_PROMPTS = [
  { label: 'Pipeline summary', prompt: 'Give me a complete pipeline and revenue summary.' },
  { label: 'Top open deals', prompt: 'List all open deals and which ones are closest to closing.' },
  { label: 'Fresh leads', prompt: 'Show me recent leads and their current status.' },
  { label: 'Add new lead', prompt: 'Add a new lead: Elena Rostova, VP Engineering at Quantum Labs, elena@quantumlabs.io, +1 415 889 0122' },
  { label: 'Add new deal', prompt: 'Create a new deal named Cloud Migration Phase 2 for $75,000 in Negotiation stage.' },
];

export default function AICopilotDrawer({ isOpen, onClose, onNavigate }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your **ABADI GURU Intelligence Copilot**, your executive sales assistant embedded in ABADI GURU CRM.\n\nI can analyze your pipeline, find leads, create deals, log tasks, or answer any sales question in real-time. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSettings, setAiSettings] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadSettings = async () => {
    try {
      const data = await crmApi.getAISettings();
      setAiSettings(data);
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    }
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build history for API (filter out welcome)
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await crmApi.chatWithAI(query, history);

      const botMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'No response returned.',
        tool_results: res.tool_results || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Failed to get AI response: ${err.message}. Check your AI Copilot settings in the Settings view.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat cleared. Ask me anything about deals, leads, revenue forecasts, or create new records!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in cursor-pointer"
    >
      {/* Background dismissal backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left cursor-default">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight">ABADI GURU Intelligence Copilot</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/30 text-violet-200 border border-violet-400/30">
                  ABADI GURU Neural Engine
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-time CRM Intelligence</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                if (onNavigate) onNavigate('settings');
              }}
              title="Configure AI & Hermes Model"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
            </button>
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-1.5 scrollbar-thin">
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp.prompt)}
              disabled={isLoading}
              className="shrink-0 px-2.5 py-1 bg-white hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 text-slate-700 text-[11px] font-medium rounded-full border border-slate-200 shadow-2xs transition-all disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs leading-relaxed ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white shadow-2xs ${
                    isUser
                      ? 'bg-slate-800'
                      : m.isError
                      ? 'bg-rose-600'
                      : 'bg-gradient-to-tr from-violet-600 to-indigo-600'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div className={`max-w-[85%] space-y-1.5`}>
                  <div
                    className={`p-3.5 rounded-2xl shadow-2xs whitespace-pre-wrap ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : m.isError
                        ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                    }`}
                  >
                    {/* Render tool executions badge if any */}
                    {m.tool_results && m.tool_results.length > 0 && (
                      <div className="mb-2.5 space-y-1.5">
                        {m.tool_results.map((tr, tIdx) => (
                          <div
                            key={tIdx}
                            className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-[11px] text-slate-700 flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-900 font-mono flex items-center gap-1">
                                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                                {tr.tool}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Result: {typeof tr.result === 'object' ? JSON.stringify(tr.result).slice(0, 80) + '...' : String(tr.result)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.content}
                  </div>

                  <div
                    className={`text-[10px] text-slate-400 px-1 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 text-xs leading-relaxed">
              <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-xs shadow-2xs flex items-center gap-2 text-slate-500 text-xs">
                <RefreshCw className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                <span>Hermes AI is thinking & querying CRM...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions / Navigation Pills */}
        <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-violet-600" />
            <span>Tools: Pipeline, Deals, Leads, Tasks</span>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onNavigate) onNavigate('deals');
            }}
            className="hover:text-indigo-600 font-semibold flex items-center gap-1"
          >
            Kanban Board <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Hermes: 'What is our Q4 pipeline?' or 'Add deal...'"
              className="flex-1 bg-transparent border-0 outline-hidden resize-none text-xs p-2 max-h-24 text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium shadow-xs transition-colors shrink-0"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-1.5 px-1 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Press Enter to send, Shift+Enter for newline</span>
            <span>Local & Cloud AI Compatible</span>
          </div>
        </div>
      </div>
    </div>
  );
}
