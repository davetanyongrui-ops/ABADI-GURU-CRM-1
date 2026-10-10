import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Zap,
  Crown,
  Sparkles,
  ShieldCheck,
  Bot,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { crmApi } from '../api';

export default function SubscriptionModal({ isOpen, onClose, currentUser, onUserUpdated }) {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [loadingTier, setLoadingTier] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  if (!isOpen) return null;

  const currentTier = currentUser?.subscription_tier || 'Professional';
  const status = currentUser?.subscription_status || 'trial';
  const isExpired = status === 'expired';

  const handleUpgrade = async (tierId) => {
    setLoadingTier(tierId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await crmApi.upgradeSubscription(tierId, billingCycle);
      setSuccessMessage(res.message || `Subscribed to ${tierId}!`);
      if (onUserUpdated) onUserUpdated(res.user);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1600);
    } catch (err) {
      setErrorMessage(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const plans = [
    {
      id: 'Starter',
      name: 'Starter',
      priceMonthly: 29,
      priceAnnual: 24,
      desc: 'Ideal for solo consultants and early-stage reps.',
      features: [
        'Up to 1,000 Active Leads',
        '3 Custom Pipelines & Kanban View',
        'Standard Quotes & Invoices',
        'Activity & Task Schedule',
        'Standard Email Templates',
        'Community Support'
      ]
    },
    {
      id: 'Professional',
      name: 'Professional',
      priceMonthly: 79,
      priceAnnual: 64,
      popular: true,
      desc: 'Best for active sales teams requiring mobile bot & AI.',
      features: [
        'Unlimited Leads, Deals & Accounts',
        'Unlimited Pipelines & Multi-Stage Kanban',
        'ABADI GURU Intelligence Predictive Lead Scoring (0-100)',
        '24/7 Telegram Mobile Bot Remote Control',
        'Automated PDF Invoice Generation & Export',
        'Workflow Automation Rules',
        'Priority Technical Support'
      ]
    },
    {
      id: 'Enterprise',
      name: 'Enterprise',
      priceMonthly: 199,
      priceAnnual: 159,
      desc: 'Full corporate power with custom LLMs & SLA.',
      features: [
        'Everything in Professional Plan',
        'ABADI GURU Intelligence™ Executive Neural Engine',
        'Unlimited Team Seats & Permissions',
        'Advanced BI Funnel & Cohort Reports',
        'Custom Field Builder on All Modules',
        'Dedicated Account Manager & 99.9% SLA',
        'Enterprise Data Migration & Backup'
      ]
    }
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-sans cursor-pointer"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative text-white my-8 cursor-default">
        
        {/* Prominent Always-Visible Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          title="Close (Esc)"
          className="absolute top-5 right-5 p-2 text-slate-300 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all cursor-pointer shadow-md z-20 flex items-center justify-center"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          {isExpired ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-1">
              <AlertCircle className="w-4 h-4" /> Free Trial Expired
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-1">
              <Sparkles className="w-4 h-4" /> ABADI GURU CRM Subscription
            </div>
          )}

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {isExpired ? 'Subscribe to Unlock Full Access' : 'Upgrade Your Sales Superpowers'}
          </h2>
          <p className="text-xs text-slate-400">
            Choose the subscription plan that fits your deal volume. Switch plans or cancel anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-3 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'annual' : 'monthly')}
              className="w-12 h-6 bg-slate-800 rounded-full p-1 border border-slate-700 transition-colors relative"
            >
              <div className={`w-4 h-4 bg-rose-500 rounded-full transition-transform ${billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-white' : 'text-slate-400'}`}>
              Annual Billing
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30">
                Save 20%
              </span>
            </span>
          </div>
        </div>

        {/* Success or Error Banners */}
        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold text-center">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold text-center">
            {errorMessage}
          </div>
        )}

        {/* Plan Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = currentTier === p.id && status === 'active';
            const price = billingCycle === 'annual' ? p.priceAnnual : p.priceMonthly;

            return (
              <div
                key={p.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                  p.popular
                    ? 'bg-slate-900 border-rose-500 shadow-xl shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    {p.id === 'Enterprise' ? (
                      <Crown className="w-4 h-4 text-amber-400" />
                    ) : p.id === 'Professional' ? (
                      <Zap className="w-4 h-4 text-rose-400" />
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 min-h-[32px]">{p.desc}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">${price}</span>
                    <span className="text-xs text-slate-400 font-semibold">/ user / mo</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
                      Billed annually (${price * 12}/yr)
                    </span>
                  )}

                  {/* Features List */}
                  <div className="mt-5 space-y-2.5 pt-4 border-t border-slate-800/80">
                    {p.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold text-center">
                      Current Active Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(p.id)}
                      disabled={loadingTier === p.id}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                        p.popular
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      {loadingTier === p.id ? 'Activating...' : `Subscribe ${p.name}`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Security / Guarantee Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted payment processing &bull; 30-Day Money-Back Guarantee</span>
          </div>
          <div>
            <span>Need enterprise custom invoice billing? </span>
            <a href="mailto:sales@abadiguru.com" className="text-rose-400 font-bold hover:underline">
              Contact Sales
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
