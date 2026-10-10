import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  FileSpreadsheet,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  Zap,
  Crown,
  DollarSign,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  HelpCircle,
  Send,
  Smartphone,
  Layers,
  Activity,
  FileText,
  BarChart3,
  Globe,
  Award,
  Clock,
  Laptop,
  CheckSquare,
  Search,
  ExternalLink,
  Download,
  Share2
} from 'lucide-react';
import { crmApi } from '../api';

export default function AuthView({ onAuthSuccess }) {
  // Page Navigation: 'home' | 'features' | 'pricing' | 'solutions' | 'faq'
  const [activePage, setActivePage] = useState('home');

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign In State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up State (Company Profile + Administrator Setup)
  const [signupForm, setSignupForm] = useState({
    company_name: '',
    company_reg_no: '',
    company_phone: '',
    company_email: '',
    company_address: '',
    industry: 'Technology',
    currency_symbol: '$',
    name: '',
    email: '',
    password: '',
    tier: 'Professional'
  });

  // Pricing Billing Toggle
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'

  // Interactive Live Product Preview Tab on Home
  const [previewTab, setPreviewTab] = useState('desktop'); // 'desktop' | 'mobile' | 'invoicing' | 'scoring'

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  const openAuth = (mode = 'signin', preselectedTier = null) => {
    setAuthMode(mode);
    if (preselectedTier) {
      setSignupForm(prev => ({ ...prev, tier: preselectedTier }));
    }
    setError('');
    setLoginEmail('');
    setLoginPassword('');
    setAuthModalOpen(true);
  };

  useEffect(() => {
    if (!authModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await crmApi.login(loginEmail, loginPassword);
      localStorage.setItem('alfa_crm_token', res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (email, pwd) => {
    setLoginEmail(email);
    setLoginPassword(pwd);
    setError('');
    setLoading(true);
    crmApi.login(email, pwd)
      .then(res => {
        localStorage.setItem('alfa_crm_token', res.token);
        onAuthSuccess(res.user);
      })
      .catch(err => {
        setError(err.message || 'Demo login failed');
        setLoading(false);
      });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await crmApi.signup(signupForm);
      localStorage.setItem('alfa_crm_token', res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white relative">
      
      {/* ============================================================ */}
      {/* 1. TOP NAVBAR (Zoho Enterprise Grade) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div 
            onClick={() => { setActivePage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-rose-950/50 group-hover:scale-105 transition-transform">
              AG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-white">ABADI GURU CRM</span>
                <span className="hidden sm:inline-block text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Enterprise Cloud
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium block -mt-0.5">High-Velocity Sales Suite</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold text-slate-300">
            <button
              onClick={() => setActivePage('home')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activePage === 'home' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActivePage('features')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activePage === 'features' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Features
            </button>
            <button
              onClick={() => setActivePage('pricing')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activePage === 'pricing' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Pricing & Plans
            </button>
            <button
              onClick={() => setActivePage('solutions')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activePage === 'solutions' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Solutions
            </button>
            <button
              onClick={() => setActivePage('faq')}
              className={`px-4 py-2 rounded-xl transition-all ${
                activePage === 'faq' ? 'bg-rose-600 text-white shadow-xs' : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              FAQ
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleQuickDemoLogin('alex.mercer@abadiguru.com', 'admin123')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              title="1-Click Instant Demo Login as Alex Mercer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Demo</span>
            </button>

            <button
              onClick={() => openAuth('signin')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Sign In
            </button>

            <button
              onClick={() => openAuth('signup', 'Professional')}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-extrabold shadow-lg shadow-rose-950/60 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-2 text-[11px] font-bold text-slate-400 bg-slate-950/90 overflow-x-auto">
          {['home', 'features', 'pricing', 'solutions', 'faq'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActivePage(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize whitespace-nowrap ${
                activePage === tab ? 'bg-rose-600 text-white' : 'hover:text-white'
              }`}
            >
              {tab === 'home' ? 'Overview' : tab}
            </button>
          ))}
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. BODY CONTENT */}
      {/* ============================================================ */}
      <main className="flex-1">

        {/* ---------------------------------------------------------- */}
        {/* TAB 1: OVERVIEW / HOME */}
        {/* ---------------------------------------------------------- */}
        {activePage === 'home' && (
          <div className="space-y-24 pb-24">
            
            {/* HERO SECTION */}
            <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
              
              {/* Top Tagline Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-6 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>The Modern Alternative to Zoho & HubSpot CRM</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400 font-medium">Built for Fast Revenue Teams</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
                Close More Deals in Half the Time with <span className="bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">AI & 24/7 Mobile Control</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Manage 7-stage visual pipelines, auto-generate official PDF invoices, and control your entire CRM remotely from Telegram without ever turning on a laptop.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => openAuth('signup', 'Professional')}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-sm shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <span>Start 14-Day Free Pro Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleQuickDemoLogin('alex.mercer@abadiguru.com', 'admin123')}
                  className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Laptop className="w-4 h-4 text-rose-400" />
                  <span>Explore Interactive Workspace Demo</span>
                </button>
              </div>

              <div className="mt-4 text-[11px] text-slate-500 flex items-center justify-center gap-5">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> 14-day full Pro access</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Cancel anytime</span>
              </div>
            </section>

            {/* TRUSTED BY LOGO STRIP (Enterprise Credibility) */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-6">
                TRUSTED BY HIGH-GROWTH REVENUE TEAMS GLOBALLY
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-center justify-center opacity-70 grayscale hover:grayscale-0 transition-all text-xs font-black tracking-widest text-slate-400">
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">◆ HYPERION DATA</div>
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">▲ APEX CAPITAL</div>
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">● STRATA SYSTEMS</div>
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">■ NEUROCLOUD AI</div>
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-center">◈ VELOCE TECH</div>
              </div>
            </section>

            {/* HIGH-FIDELITY PRODUCT VISUAL SHOWCASE */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                
                {/* Visual View Switcher */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-rose-500" />
                      Live Software Interface & Device Architecture
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Toggle views to inspect the desktop workspace, mobile Telegram bot, and invoicing engine.</p>
                  </div>

                  <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto">
                    {[
                      { id: 'desktop', label: 'Desktop CRM Board', icon: Laptop },
                      { id: 'mobile', label: 'Telegram Mobile Bot', icon: Smartphone },
                      { id: 'invoicing', label: 'Official PDF Invoicing', icon: FileSpreadsheet },
                      { id: 'scoring', label: 'Predictive AI Scoring', icon: TrendingUp },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setPreviewTab(tab.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                            previewTab === tab.id
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* VISUAL 1: HIGH-RES MACOS DESKTOP WINDOW MOCKUP */}
                {previewTab === 'desktop' && (
                  <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 overflow-hidden shadow-2xl animate-fade-in font-sans">
                    {/* macOS Chrome Header */}
                    <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                      </div>
                      <div className="flex items-center gap-2 px-4 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>https://app.abadiguru.com/pipeline/deals</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-slate-300">Alex Mercer (Enterprise)</span>
                      </div>
                    </div>

                    {/* Window Inner Body */}
                    <div className="grid grid-cols-12 min-h-[460px]">
                      {/* Mini Left Sidebar */}
                      <div className="col-span-2 bg-slate-900/90 border-r border-slate-800/80 p-3 space-y-4 hidden md:block text-xs">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                          <div className="w-6 h-6 rounded-md bg-rose-600 text-white font-black text-xs flex items-center justify-center">AG</div>
                          <span className="font-bold text-white text-xs">ABADI GURU CRM</span>
                        </div>
                        <div className="space-y-1 text-slate-400 font-medium">
                          <div className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
                          </div>
                          <div className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Leads (98)
                          </div>
                          <div className="px-2 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" /> Pipeline Deals
                          </div>
                          <div className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Invoices
                          </div>
                          <div className="px-2 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-2">
                            <Bot className="w-3.5 h-3.5 text-sky-400" /> Telegram Bot
                          </div>
                        </div>
                      </div>

                      {/* Main Kanban Board Canvas */}
                      <div className="col-span-12 md:col-span-10 p-5 space-y-4 bg-slate-950">
                        {/* Board Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-white text-sm">Active Sales Pipeline</h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                              $2,450,000 Pipeline
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold font-mono">
                              Weighted: $1,420,000
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Pacing: 114% of Q4 Quota</span>
                          </div>
                        </div>

                        {/* 4 Rich Kanban Columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          {/* Col 1 */}
                          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 pb-1 border-b border-slate-800">
                              <span>Qualification (10%)</span>
                              <span className="text-slate-200 font-mono">$185k</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 hover:border-slate-700 transition-colors shadow-xs">
                              <div className="flex justify-between items-center">
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-extrabold text-[9px]">HIGH PRIORITY</span>
                                <span className="text-[10px] text-slate-500 font-mono">2d in stage</span>
                              </div>
                              <div className="font-bold text-white leading-tight">FinTech Security Cloud</div>
                              <div className="text-[11px] text-slate-400">Apex Global Logistics</div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                                <span className="font-bold text-white">$85,000</span>
                                <span className="text-slate-400">Alex M.</span>
                              </div>
                            </div>
                          </div>

                          {/* Col 2 */}
                          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex justify-between items-center text-[11px] font-bold text-amber-400 pb-1 border-b border-slate-800">
                              <span>Proposal / Quote (60%)</span>
                              <span className="text-slate-200 font-mono">$540k</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 hover:border-slate-700 transition-colors shadow-xs">
                              <div className="flex justify-between items-center">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[9px]">PROPOSAL DELIVERED</span>
                                <span className="text-[10px] text-slate-500 font-mono">4d</span>
                              </div>
                              <div className="font-bold text-white leading-tight">Enterprise AI Integration</div>
                              <div className="text-[11px] text-slate-400">Cyberdyne Systems</div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                                <span className="font-bold text-white">$145,000</span>
                                <button className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold">
                                  + Invoice
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Col 3 */}
                          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-3">
                            <div className="flex justify-between items-center text-[11px] font-bold text-orange-400 pb-1 border-b border-slate-800">
                              <span>Negotiation (80%)</span>
                              <span className="text-slate-200 font-mono">$620k</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 hover:border-slate-700 transition-colors shadow-xs">
                              <div className="flex justify-between items-center">
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-extrabold text-[9px]">FINAL REVIEW</span>
                                <span className="text-[10px] text-slate-500 font-mono">1d</span>
                              </div>
                              <div className="font-bold text-white leading-tight">Cloud Architecture Migration</div>
                              <div className="text-[11px] text-slate-400">Quantum Labs Corp</div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                                <span className="font-bold text-white">$190,000</span>
                                <span className="text-emerald-400">$152k wt</span>
                              </div>
                            </div>
                          </div>

                          {/* Col 4 */}
                          <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/30 space-y-3">
                            <div className="flex justify-between items-center text-[11px] font-bold text-emerald-400 pb-1 border-b border-emerald-500/30">
                              <span>Closed Won (100%)</span>
                              <span className="text-emerald-300 font-mono font-bold">$1,105k</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-lg border border-emerald-500/40 space-y-2 shadow-xs">
                              <div className="flex justify-between items-center">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[9px]">WON</span>
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">Paid</span>
                              </div>
                              <div className="font-bold text-emerald-300 leading-tight">Global Infrastructure SLA</div>
                              <div className="text-[11px] text-slate-400">Starlight Tech Group</div>
                              <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-mono text-[11px]">
                                <span className="font-bold text-emerald-400">$215,000</span>
                                <span className="text-slate-400">Elena V.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VISUAL 2: REALISTIC IPHONE 16 PRO TELEGRAM BOT MOCKUP */}
                {previewTab === 'mobile' && (
                  <div className="mt-6 flex justify-center animate-fade-in py-4">
                    {/* iPhone Frame */}
                    <div className="w-full max-w-[340px] bg-slate-950 rounded-[44px] border-[6px] border-slate-700 shadow-2xl p-3 relative overflow-hidden">
                      {/* Dynamic Island Pill */}
                      <div className="w-24 h-4 bg-black rounded-full mx-auto mb-2 flex items-center justify-end px-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>

                      {/* iOS Header */}
                      <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800 text-[10px] text-slate-400">
                        <span>9:41 AM</span>
                        <div className="flex items-center gap-1 font-bold text-white">
                          <span>5G</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Telegram App Bar */}
                      <div className="flex items-center gap-2.5 py-2.5 px-2 bg-slate-900 rounded-xl mt-1 border border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-black text-xs shadow-xs">
                          AG
                        </div>
                        <div className="flex-1 leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-white">ABADI GURU Bot</span>
                            <CheckCircle2 className="w-3 h-3 text-sky-400 inline" />
                          </div>
                          <span className="text-[10px] text-sky-400 font-medium">bot • 24/7 cloud server</span>
                        </div>
                      </div>

                      {/* Telegram Chat Feed */}
                      <div className="space-y-3 py-3 text-[11px]">
                        <div className="bg-sky-600 text-white p-2.5 rounded-2xl rounded-tr-xs ml-auto max-w-[85%] font-mono">
                          /summary
                        </div>

                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-xs space-y-1 text-slate-200">
                          <div className="font-bold text-amber-300">[EXECUTIVE SUMMARY]</div>
                          <div>• Pipeline: <strong>$2,450,000</strong> (14 deals)</div>
                          <div>• Closed Won: <strong>$1,105,000</strong> (Pacing: 114%)</div>
                          <div>• Active Leads: <strong>48</strong> (8 Hot)</div>
                        </div>

                        <div className="bg-sky-600 text-white p-2.5 rounded-2xl rounded-tr-xs ml-auto max-w-[85%] font-mono">
                          /invoice Cyberdyne | 85000 | AI Consulting
                        </div>

                        {/* PDF File Attachment Card in Telegram */}
                        <div className="bg-slate-900 border border-sky-500/30 p-3 rounded-2xl rounded-tl-xs space-y-2">
                          <div className="text-emerald-400 font-bold">[INVOICE GENERATED]</div>
                          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
                              PDF
                            </div>
                            <div className="flex-1 truncate">
                              <span className="font-bold text-white block truncate text-[10px]">Invoice-QT-2026-9122.pdf</span>
                              <span className="text-[9px] text-slate-400 block">184 KB • Vector PDF</span>
                            </div>
                            <Download className="w-4 h-4 text-sky-400" />
                          </div>
                          <div className="text-[10px] text-slate-400">Total: $91,800.00 (Due Net 30)</div>
                        </div>
                      </div>

                      {/* Phone Bottom Home Bar */}
                      <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                    </div>
                  </div>
                )}

                {/* VISUAL 3: EXECUTIVE INVOICE DOCUMENT PREVIEW */}
                {previewTab === 'invoicing' && (
                  <div className="mt-6 flex justify-center animate-fade-in py-2">
                    <div className="w-full max-w-xl bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-300 font-sans text-xs space-y-6">
                      <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white font-black flex items-center justify-center text-xs">
                            AG
                          </div>
                          <div>
                            <span className="font-black text-sm text-slate-900 block">Abadi Guru Enterprise Inc.</span>
                            <span className="text-[10px] text-slate-500">Official Sales & Billing Invoice</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-slate-900 block">QT-2026-8812</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">CONFIRMED</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-400 uppercase text-[9px] block">Billed To</span>
                          <strong className="text-slate-900 block text-xs">Apex Global Logistics Corp.</strong>
                          <span className="text-slate-600">100 Logistics Way, Suite 400</span>
                          <span className="text-slate-600 block">billing@apexlogistics.io</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-400 uppercase text-[9px] block">Invoice Dates</span>
                          <span className="text-slate-600 block">Issued: <strong>Oct 09, 2026</strong></span>
                          <span className="text-slate-600 block">Due: <strong>Nov 08, 2026 (Net 30)</strong></span>
                        </div>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-left text-[11px] border-t border-slate-200">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2">Item Description</th>
                            <th className="py-2 text-center">Qty</th>
                            <th className="py-2 text-right">Unit Price</th>
                            <th className="py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-2 font-medium">Enterprise Cloud Infrastructure Migration</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-right">$65,000.00</td>
                            <td className="py-2 text-right font-bold">$65,000.00</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">24/7 Dedicated Technical SLA Retainer</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-right">$10,000.00</td>
                            <td className="py-2 text-right font-bold">$10,000.00</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="flex justify-end pt-2 border-t border-slate-200">
                        <div className="w-48 space-y-1 text-right text-[11px]">
                          <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span>$75,000.00</span></div>
                          <div className="flex justify-between text-slate-600"><span>Tax (8.0%):</span><span>$6,000.00</span></div>
                          <div className="flex justify-between text-slate-900 font-extrabold text-sm font-mono pt-1 border-t border-slate-200">
                            <span>Grand Total:</span>
                            <span className="text-emerald-700">$81,000.00</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 text-[10px] text-slate-400 text-center border-t border-slate-100">
                        Generated automatically via ABADI GURU Intelligence™ Enterprise Billing Engine • www.abadiguru.com
                      </div>
                    </div>
                  </div>
                )}

                {/* VISUAL 4: PREDICTIVE SCORING MOCKUP */}
                {previewTab === 'scoring' && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">Arthur Pendleton</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-black text-xs font-mono">94 PTS</span>
                      </div>
                      <div className="text-xs text-slate-400">Apex Global • $12.5M Revenue</div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full w-[94%]" />
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> High Purchase Intent (Tier 1 - Hot)
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">Marcus Sterling</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs font-mono">82 PTS</span>
                      </div>
                      <div className="text-xs text-slate-400">Sterling Logistics • $6.2M Revenue</div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full w-[82%]" />
                      </div>
                      <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active Proposal Evaluation (Tier 2 - Warm)
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs">Elena Rostova</span>
                        <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-black text-xs font-mono">76 PTS</span>
                      </div>
                      <div className="text-xs text-slate-400">Quantum Labs • $4.0M Revenue</div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-sky-400 h-full rounded-full w-[76%]" />
                      </div>
                      <div className="text-[11px] text-sky-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Discovery Sequence Active
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </section>

            {/* REAL CLIENT TESTIMONIALS (Credibility Wall) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-xl mx-auto mb-10">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block mb-2">Verified Revenue Impact</span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Why Sales Leaders Switch to ABADI GURU CRM</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "The Telegram bot transformed our deal cycles. Reps log notes, qualify leads, and generate PDF invoices on their phones between client meetings. Our pipeline velocity increased 35% in 60 days."
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center font-bold text-white text-xs">MV</div>
                    <div>
                      <strong className="text-xs text-white block">Marcus Vance</strong>
                      <span className="text-[10px] text-slate-400">VP of Revenue • Apex Systems</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "We migrated our 12-person sales team from Zoho. ABADI GURU CRM has zero legacy bloat, native AI scoring that works immediately, and none of Zoho's hidden add-on bills."
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">EC</div>
                    <div>
                      <strong className="text-xs text-white block">Elena Chen</strong>
                      <span className="text-[10px] text-slate-400">Co-Founder & CEO • NeuroCloud AI</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "Being able to convert a Closed Won deal directly into an official invoice and have it automatically pushed to client email and Telegram is a game-changer for cash flow."
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">DK</div>
                    <div>
                      <strong className="text-xs text-white block">David Kowalski</strong>
                      <span className="text-[10px] text-slate-400">Director of Operations • Strata Global</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* TAB 2: FEATURES */}
        {/* ---------------------------------------------------------- */}
        {activePage === 'features' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 animate-fade-in">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Feature Suite</span>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Enterprise Sales Infrastructure</h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Every feature in ABADI GURU CRM has been engineered to eliminate manual rep busywork, increase closing velocity, and give leadership unmatched visibility.
              </p>
            </div>

            <div className="space-y-12">
              
              {/* Feature 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-slate-900/60 p-8 rounded-3xl border border-slate-800">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                    <Layers className="w-3.5 h-3.5" /> Pipeline Management
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Visual Kanban Deals & Probability Telemetry</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Track sales deals across 7 standardized stages: Qualification (10%), Needs Analysis (20%), Value Proposition (40%), Proposal / Price Quote (60%), Negotiation / Review (80%), and Closed Won (100%).
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real-time weighted revenue calculations (Amount × Probability)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1-Click "Convert to Invoice" button on won deals</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Drag-and-drop Kanban cards with stage aging flags</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-xs font-mono space-y-3">
                  <div className="text-slate-400 pb-2 border-b border-slate-800 flex justify-between">
                    <span>FORECASTING ALGORITHM</span>
                    <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </div>
                  <div className="text-slate-300">Deal: Enterprise Migration ($120,000)</div>
                  <div className="text-amber-400">Stage: Proposal / Quote (60% win probability)</div>
                  <div className="text-emerald-400 font-bold">Weighted Cash-flow: $72,000.00</div>
                  <div className="text-slate-500 text-[11px] pt-2 border-t border-slate-800">Telemetry updated across all executive dashboards in real-time.</div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-slate-900/60 p-8 rounded-3xl border border-slate-800">
                <div className="order-2 lg:order-1 bg-slate-950 p-6 rounded-2xl border border-slate-800 text-xs font-mono space-y-2">
                  <div className="text-sky-400 pb-2 border-b border-slate-800 flex justify-between">
                    <span>TELEGRAM CLOUD BRIDGE</span>
                    <span>@abadi_guru_bot</span>
                  </div>
                  <div className="text-slate-400">$ /add_lead Sarah Connor, Cyberdyne, sconnor@cd.io</div>
                  <div className="text-emerald-400">[LEAD CREATED]: Sarah Connor (Cyberdyne)</div>
                  <div className="text-slate-400">$ /invoice Cyberdyne | 45000 | Consulting</div>
                  <div className="text-emerald-400">[INVOICE GENERATED]: #QT-2026-9122 PDF Dispatched</div>
                </div>
                <div className="order-1 lg:order-2 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold border border-sky-500/20">
                    <Smartphone className="w-3.5 h-3.5" /> Mobile Automation
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">24/7 Telegram Mobile Bot Remote Control</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sales leaders don’t sit in front of laptops all day. ABADI GURU CRM connects directly to Telegram so you can check revenue pacing, query top deals, add leads, and generate PDF invoices while traveling.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Operates 24/7 without needing your laptop switched on</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Receive instant notifications when team members close a deal</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Powered by ABADI GURU Intelligence conversational engine</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* TAB 3: PRICING (Zoho-Style) */}
        {/* ---------------------------------------------------------- */}
        {activePage === 'pricing' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 animate-fade-in">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Transparent SaaS Plans</span>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Predictable Pricing for Sales Teams</h1>
              <p className="text-sm text-slate-400">Start with our 14-day free trial. No credit card required upfront. Upgrade or downgrade anytime.</p>
              
              {/* Billing Switcher */}
              <div className="pt-4 flex items-center justify-center gap-3">
                <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>
                  Monthly Billing
                </span>
                <button
                  type="button"
                  onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                  className="w-14 h-7 bg-slate-900 border border-slate-700 rounded-full p-1 transition-colors relative"
                >
                  <div
                    className={`w-5 h-5 bg-rose-500 rounded-full shadow-md transition-transform ${
                      billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${billingCycle === 'annual' ? 'text-white' : 'text-slate-500'}`}>
                    Annual Billing
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                    Save 20%
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              
              {/* Plan 1 */}
              <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-8 flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Starter</h3>
                  <p className="text-xs text-slate-400 mt-1">For solo consultants and early-stage reps.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white font-mono">
                      ${billingCycle === 'annual' ? '24' : '29'}
                    </span>
                    <span className="text-xs text-slate-400">/ user / mo</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {billingCycle === 'annual' ? 'Billed annually ($288/yr)' : 'Billed monthly'}
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Up to 1,000 Active Leads</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> 3 Custom Kanban Pipelines</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Standard Quotes & Invoices</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Activity & Task Management</li>
                    <li className="flex items-center gap-2 text-slate-500"><X className="w-4 h-4 shrink-0" /> Telegram Mobile Bot</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('signup', 'Starter')}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                >
                  Start 14-Day Starter Trial
                </button>
              </div>

              {/* Plan 2: Pro */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl border-2 border-rose-500 p-8 flex flex-col justify-between space-y-6 relative shadow-2xl shadow-rose-950/40">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md">
                  Most Popular • Best Value
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">Professional</h3>
                  <p className="text-xs text-slate-400 mt-1">For active revenue teams requiring mobile & AI automation.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white font-mono">
                      ${billingCycle === 'annual' ? '64' : '79'}
                    </span>
                    <span className="text-xs text-slate-400">/ user / mo</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {billingCycle === 'annual' ? 'Billed annually ($768/yr)' : 'Billed monthly'}
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-rose-400 shrink-0" /> <strong>Unlimited</strong> Leads, Deals & Accounts</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-rose-400 shrink-0" /> Unlimited Kanban Pipelines</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-rose-400 shrink-0" /> <strong>24/7 Telegram Mobile Bot</strong></li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-rose-400 shrink-0" /> <strong>Predictive AI Scoring</strong></li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-rose-400 shrink-0" /> Automated PDF Invoices & Delivery</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('signup', 'Professional')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02]"
                >
                  Start 14-Day Pro Trial
                </button>
              </div>

              {/* Plan 3: Enterprise */}
              <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-8 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Enterprise</h3>
                    <Crown className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Full corporate power with custom LLMs & SLA.</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white font-mono">
                      ${billingCycle === 'annual' ? '159' : '199'}
                    </span>
                    <span className="text-xs text-slate-400">/ user / mo</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {billingCycle === 'annual' ? 'Billed annually ($1,908/yr)' : 'Billed monthly'}
                  </div>

                  <ul className="mt-8 space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> Everything in Professional Plan</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> <strong>ABADI GURU Neural Intelligence</strong></li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> Custom LLM Integrations</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> Unlimited Team Seats & Permissions</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400 shrink-0" /> 99.9% Uptime SLA Guarantee</li>
                  </ul>
                </div>

                <button
                  onClick={() => openAuth('signup', 'Enterprise')}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                >
                  Start Enterprise Trial
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* TAB 4: SOLUTIONS */}
        {/* ---------------------------------------------------------- */}
        {activePage === 'solutions' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 animate-fade-in">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">Solutions</span>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Tailored for High-Growth Sales Models</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm border border-rose-500/20">
                  <Laptop className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Founders & Early-Stage Teams</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Close initial customers without complex onboarding. Move deals and dispatch official PDF invoices on the go directly from Telegram.
                </p>
              </div>

              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Scaling B2B Revenue Teams</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Eliminate revenue leakage with predictive AI scoring, automated task workflows, and weighted probability forecasting that aligns reps with targets.
                </p>
              </div>

              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/20">
                  <Crown className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Enterprise Organizations</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  White-label corporate branding, dedicated 99.9% SLAs, custom LLM connectivity, and role-based permissions with audit compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* TAB 5: FAQ */}
        {/* ---------------------------------------------------------- */}
        {activePage === 'faq' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-fade-in">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block">FAQ</span>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Frequently Asked Questions</h1>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'Do I need a credit card to start the free trial?',
                  a: 'No! You get 14 days of full Professional tier access without entering any payment information.'
                },
                {
                  q: 'How does the Telegram bot work when my laptop is turned off?',
                  a: 'ABADI GURU CRM runs on a persistent cloud backend. The Telegram bot connects directly to the server database, allowing you to manage deals and export invoices from your phone 24/7.'
                },
                {
                  q: 'Can I generate PDF invoices from my phone?',
                  a: 'Yes. Simply send /invoice Client | Amount | Description or /pdf <Invoice#> to the bot, and it returns the official vector PDF invoice immediately in chat.'
                },
                {
                  q: 'Can I cancel or switch subscription plans at any time?',
                  a: 'Yes. You can upgrade, downgrade, or cancel anytime with one click in your account settings.'
                }
              ].map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between font-bold text-sm text-white"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-rose-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* ============================================================ */}
      {/* 3. FOOTER */}
      {/* ============================================================ */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center text-white font-black text-xs">
                AG
              </div>
              <span className="font-extrabold text-white text-base">ABADI GURU CRM</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              The high-velocity Zoho CRM alternative designed for modern revenue teams. Control pipelines, generate PDF invoices, and close deals directly from Telegram.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Product</h4>
            <ul className="space-y-2 text-[11px]">
              <li><button onClick={() => setActivePage('features')} className="hover:text-white">Pipeline Kanban</button></li>
              <li><button onClick={() => setActivePage('features')} className="hover:text-white">Telegram Remote Bot</button></li>
              <li><button onClick={() => setActivePage('features')} className="hover:text-white">Predictive AI Scoring</button></li>
              <li><button onClick={() => setActivePage('features')} className="hover:text-white">PDF Invoicing Engine</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Plans & Pricing</h4>
            <ul className="space-y-2 text-[11px]">
              <li><button onClick={() => setActivePage('pricing')} className="hover:text-white">Starter Plan ($29)</button></li>
              <li><button onClick={() => setActivePage('pricing')} className="hover:text-white">Professional Plan ($79)</button></li>
              <li><button onClick={() => setActivePage('pricing')} className="hover:text-white">Enterprise Suite ($199)</button></li>
              <li><button onClick={() => openAuth('signup')} className="hover:text-white">14-Day Free Trial</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-3">Security & Compliance</h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 256-bit AES Data Encryption
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> SOC2 Type II Certified
              </div>
              <p className="text-[10px] text-slate-600 pt-2">© 2026 Abadi Guru Enterprise Inc. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* 4. MODAL AUTHENTICATION */}
      {/* ============================================================ */}
      {authModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalOpen(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in font-sans cursor-pointer"
        >
          <div className={`bg-slate-900 border border-slate-800 rounded-3xl w-full p-6 sm:p-8 shadow-2xl relative text-white my-8 transition-all cursor-default ${
            authMode === 'signup' ? 'max-w-2xl' : 'max-w-lg'
          }`}>
            
            {/* Prominent Always-Visible Close Button */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close modal"
              title="Close (Esc)"
              className="absolute top-5 right-5 p-2 text-slate-300 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all cursor-pointer shadow-md z-20 flex items-center justify-center"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'signin' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In to Workspace
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  authMode === 'signup' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 inline mr-1" /> Register New Company
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                {error}
              </div>
            )}

            {/* SIGN IN FORM */}
            {authMode === 'signin' && (
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Sign in to workspace</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Enter your email and password to access your CRM.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        name="crm_work_email"
                        autoComplete="off"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="alex.mercer@abadiguru.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        name="crm_work_password"
                        autoComplete="new-password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all mt-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* 1-Click Quick Demo Sign In */}
                <div className="pt-4 border-t border-slate-800/80">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-2">
                    Or sign in with 1-click test accounts:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('alex.mercer@abadiguru.com', 'admin123')}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bold text-slate-200 text-xs">Alex Mercer</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Enterprise Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('elena.vance@abadiguru.com', 'admin123')}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-rose-400" />
                        <span className="font-bold text-slate-200 text-xs">Elena Vance</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">VP Sales (Pro)</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* SIGN UP FORM (REGISTER NEW COMPANY PROFILE) */}
            {authMode === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white font-black shadow-lg shadow-rose-950/40 shrink-0">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                      Register New Company Profile
                      <span className="hidden sm:inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                        Private Database
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Signing up creates your company profile & dedicated workspace.</p>
                  </div>
                </div>

                {/* Privacy & Isolation Callout */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2.5 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Physical Database Isolation:</strong> Each company gets its own independent database file. Your team tokens, customer profiles, and quotations remain 100% private.
                  </div>
                </div>

                {/* SECTION 1: Company Profile */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> 1. Company Profile
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Used for quotes & invoices</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={signupForm.company_name}
                        onChange={(e) => setSignupForm({ ...signupForm, company_name: e.target.value })}
                        placeholder="e.g. Apex Global Logistics Ltd"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Reg No. / Tax ID
                      </label>
                      <input
                        type="text"
                        value={signupForm.company_reg_no}
                        onChange={(e) => setSignupForm({ ...signupForm, company_reg_no: e.target.value })}
                        placeholder="e.g. 2026-CO-8910"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Phone
                      </label>
                      <input
                        type="text"
                        value={signupForm.company_phone}
                        onChange={(e) => setSignupForm({ ...signupForm, company_phone: e.target.value })}
                        placeholder="e.g. +1 (555) 019-2834"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Company Billing Email
                      </label>
                      <input
                        type="email"
                        value={signupForm.company_email}
                        onChange={(e) => setSignupForm({ ...signupForm, company_email: e.target.value })}
                        placeholder="e.g. billing@apex.io"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        HQ Address
                      </label>
                      <input
                        type="text"
                        value={signupForm.company_address}
                        onChange={(e) => setSignupForm({ ...signupForm, company_address: e.target.value })}
                        placeholder="e.g. Level 28, Tower 1, Financial District"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Base Currency
                      </label>
                      <select
                        value={signupForm.currency_symbol}
                        onChange={(e) => setSignupForm({ ...signupForm, currency_symbol: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      >
                        <option value="$">$ (USD / SGD / CAD / AUD)</option>
                        <option value="€">€ (EUR - Euro)</option>
                        <option value="£">£ (GBP - British Pound)</option>
                        <option value="RM">RM (MYR - Malaysian Ringgit)</option>
                        <option value="Rp">Rp (IDR - Indonesian Rupiah)</option>
                        <option value="¥">¥ (JPY / CNY)</option>
                        <option value="₹">₹ (INR - Indian Rupee)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Company Administrator Account */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> 2. Company Administrator Account
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Owner login credentials</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Admin Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={signupForm.name}
                        onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                        placeholder="e.g. Alex Mercer"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Login Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        placeholder="alex@apex.io"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Password (6+ chars) *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={signupForm.password}
                        onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tier Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Select Plan Tier (Includes 14-Day Free Access)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Starter', name: 'Starter', price: '$29/mo' },
                      { id: 'Professional', name: 'Professional', price: '$79/mo', popular: true },
                      { id: 'Enterprise', name: 'Enterprise', price: '$199/mo' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSignupForm({ ...signupForm, tier: t.id })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          signupForm.tier === t.id
                            ? 'border-rose-500 bg-rose-500/10 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-xs text-white">{t.name}</div>
                        <div className="text-[11px] text-rose-400 font-extrabold">{t.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all mt-3 cursor-pointer"
                >
                  {loading ? 'Creating company workspace & database...' : 'Register Company & Launch CRM'}
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
