import React, { useState, useEffect } from 'react';
import {
  Settings, Plus, Download, Upload, RotateCcw, Sliders,
  CheckCircle2, AlertCircle, Trash2, FileSpreadsheet, X,
  Layers, Database, Building, Sparkles, Bot, Send,
  Cpu, Key, Globe, Terminal, RefreshCw, Eye, EyeOff,
  Check, Play, Square, MessageSquare, ArrowRight, ShieldCheck,
  Mail, Truck, Receipt, FileText, Image as ImageIcon, Lock,
  Users, Target, Award, Search, CheckSquare, Clock, Copy
} from 'lucide-react';
import { crmApi } from '../api';

const AI_PRESETS = {
  hermes_local: {
    name: 'Nous Hermes 3 (Ollama / Local)',
    provider: 'hermes_local',
    baseUrl: 'http://localhost:11434/v1',
    model: 'hermes-3-llama-3.1-8b',
    keyPlaceholder: 'Not required for local Ollama',
    description: 'Runs 100% offline on your machine with Ollama. Zero API costs, private data.',
    command: 'ollama run hermes-3-llama-3.1-8b',
  },
  hermes_openrouter: {
    name: 'Nous Hermes 3 (OpenRouter Cloud)',
    provider: 'hermes_openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'nousresearch/hermes-3-llama-3.1-405b',
    keyPlaceholder: 'sk-or-v1-...',
    description: 'State-of-the-art 405B Hermes parameter model with advanced function-calling.',
  },
  ollama: {
    name: 'Ollama General (Local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    keyPlaceholder: 'Not required for local Ollama',
    description: 'Any model in Ollama: LLaMA 3.2, Mistral, Qwen 2.5, Phi-3, Gemma.',
    command: 'ollama run llama3.2',
  },
  openai: {
    name: 'OpenAI (GPT-4o / GPT-4o-mini)',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyPlaceholder: 'sk-proj-...',
    description: 'High reliability OpenAI standard with function calling.',
  },
  groq: {
    name: 'Groq Cloud (Sub-Second LPU)',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    description: 'Ultra fast responses (~500 tokens/sec) on Groq LPUs.',
  },
  inception: {
    name: 'ABADI GURU Neural Engine (High-Speed Cloud)',
    provider: 'custom',
    baseUrl: 'https://api.inceptionlabs.ai/v1',
    model: 'abadi-guru-neural-core',
    keyPlaceholder: 'Your Neural Engine API Key',
    description: 'High-speed enterprise neural AI engine for predictive CRM automation.',
  },
  custom: {
    name: 'Custom OpenAI-Compatible API',
    provider: 'custom',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    keyPlaceholder: 'API Key (optional)',
    description: 'LM Studio, vLLM, FastChat, Together AI, or your private self-hosted endpoint.',
  },
};

export default function SettingsView({ onResetData }) {
  const [activeTab, setActiveTab] = useState('branding'); // 'branding' | 'email' | 'data' | 'ai' | 'telegram' | 'custom_fields'

  // Company Branding & Document Presets State
  const [brandingSettings, setBrandingSettings] = useState({
    company_name: '',
    company_reg_no: '',
    company_logo: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    currency_symbol: '$',
    quote_prefix: 'QT-',
    quote_validity_days: '30',
    quote_default_terms: '',
    quote_footer_note: '',
    do_prefix: 'DO-',
    do_default_terms: '',
    do_show_prices: '1',
    do_footer_note: '',
    invoice_prefix: 'INV-',
    invoice_payment_terms: 'Net 30 Days',
    invoice_default_tax: '8.0',
    invoice_bank_name: '',
    invoice_bank_account_no: '',
    invoice_bank_account_name: '',
    invoice_swift_code: '',
    invoice_default_terms: '',
    invoice_footer_note: '',
  });
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingSaveMsg, setBrandingSaveMsg] = useState(null);

  // Sales Team & Agent Management State
  const [salesAgents, setSalesAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [createAgentForm, setCreateAgentForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Sales Agent',
    phone: '',
    quota_target: 50000
  });
  const [creatingAgentLoading, setCreatingAgentLoading] = useState(false);
  const [agentCreatedSuccess, setAgentCreatedSuccess] = useState(null);
  const [agentError, setAgentError] = useState('');

  // Agent Permissions & Granular Access Control State
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedAgentForPerms, setSelectedAgentForPerms] = useState(null);
  const [loadingAgentPerms, setLoadingAgentPerms] = useState(false);
  const [savingAgentPerms, setSavingAgentPerms] = useState(false);
  const [permsForm, setPermsForm] = useState({
    leads: 'assigned',
    contacts: 'assigned',
    accounts: 'assigned',
    deals: 'assigned',
    products: 'none',
    quotes: 'assigned',
    automation: 'none',
    settings: 'none',
    reports: 'none'
  });
  const [grantedContactIds, setGrantedContactIds] = useState([]);
  const [allCompanyContacts, setAllCompanyContacts] = useState([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [permsSaveMsg, setPermsSaveMsg] = useState(null);

  // Outbound Email (SMTP / Resend) State
  const [emailSettings, setEmailSettings] = useState({
    email_delivery_provider: 'none',
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: '0',
    smtp_user: '',
    smtp_pass: '',
    smtp_from_email: '',
    smtp_from_name: '',
    resend_api_key: '',
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaveMsg, setEmailSaveMsg] = useState(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);

  // AI Settings State
  const [aiSettings, setAiSettings] = useState({
    ai_provider: 'hermes_local',
    ai_base_url: 'http://localhost:11434/v1',
    ai_api_key: '',
    ai_model: 'hermes-3-llama-3.1-8b',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiSaveMsg, setAiSaveMsg] = useState(null);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

  // Telegram Settings State
  const [tgSettings, setTgSettings] = useState({
    telegram_token: '',
    telegram_agent_token: '',
    telegram_enabled: 0,
    telegram_chat_id: '',
  });
  const [botStatus, setBotStatus] = useState({ running: false, botUser: null });
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [tgSaveMsg, setTgSaveMsg] = useState(null);
  const [isTogglingBot, setIsTogglingBot] = useState(false);
  const [testTgChatId, setTestTgChatId] = useState('');
  const [testTgText, setTestTgText] = useState('[ABADI GURU CRM] Test alert notification');
  const [isSendingTestTg, setIsSendingTestTg] = useState(false);
  const [tgTestResult, setTgTestResult] = useState(null);
  const [tgLogs, setTgLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Custom Fields & CSV State
  const [customFields, setCustomFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [entityFilter, setEntityFilter] = useState('leads');
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    entity_type: 'leads',
    field_label: '',
    field_type: 'text',
    optionsText: '',
  });
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  // Load Initial Settings
  useEffect(() => {
    loadAllSettings();
  }, []);

  // Global Escape Key to close any active modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (permissionsModalOpen) setPermissionsModalOpen(false);
        else if (isCreatingAgent) {
          setIsCreatingAgent(false);
          setAgentCreatedSuccess(null);
          setAgentError('');
        } else if (isAddingField) {
          setIsAddingField(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [permissionsModalOpen, isCreatingAgent, isAddingField]);

  const loadAllSettings = async () => {
    try {
      const [aiData, bData, eData] = await Promise.all([
        crmApi.getAISettings().catch(() => null),
        crmApi.getBrandingSettings().catch(() => null),
        crmApi.getEmailSettings().catch(() => null),
      ]);

      if (aiData) {
        setAiSettings({
          ai_provider: aiData.ai_provider || 'hermes_local',
          ai_base_url: aiData.ai_base_url || 'http://localhost:11434/v1',
          ai_api_key: aiData.ai_api_key || '',
          ai_model: aiData.ai_model || 'hermes-3-llama-3.1-8b',
        });
        setTgSettings({
          telegram_token: aiData.telegram_token || '',
          telegram_agent_token: aiData.telegram_agent_token || '',
          telegram_enabled: Number(aiData.telegram_enabled) || 0,
          telegram_chat_id: aiData.telegram_chat_id || '',
        });
        setTestTgChatId(aiData.telegram_chat_id || '');
        if (aiData.botStatus) {
          setBotStatus(aiData.botStatus);
        }
      }

      if (bData) {
        setBrandingSettings(prev => ({ ...prev, ...bData }));
      }

      if (eData) {
        setEmailSettings(prev => ({ ...prev, ...eData }));
      }

      loadSalesAgents();
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const loadCustomFields = async () => {
    try {
      setLoadingFields(true);
      const data = await crmApi.getCustomFields(entityFilter);
      setCustomFields(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') {
      loadSalesAgents();
    }
    if (activeTab === 'custom_fields') {
      loadCustomFields();
    }
    if (activeTab === 'telegram') {
      loadTelegramLogs();
      checkTelegramStatus();
    }
  }, [activeTab, entityFilter]);

  const loadTelegramLogs = async () => {
    try {
      setLoadingLogs(true);
      const logs = await crmApi.getTelegramLogs(25);
      setTgLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const checkTelegramStatus = async () => {
    try {
      const status = await crmApi.getTelegramStatus();
      setBotStatus(status);
    } catch (err) {
      console.error(err);
    }
  };

  // Select AI Preset
  const handleSelectPreset = (key) => {
    const preset = AI_PRESETS[key];
    if (preset) {
      setAiSettings(prev => ({
        ...prev,
        ai_provider: preset.provider,
        ai_base_url: preset.baseUrl,
        ai_model: preset.model,
      }));
      setAiTestResult(null);
    }
  };

  // Save Branding Settings & Document Presets
  const handleSaveBranding = async (e) => {
    e?.preventDefault();
    setIsSavingBranding(true);
    setBrandingSaveMsg(null);
    try {
      await crmApi.saveBrandingSettings(brandingSettings);
      setBrandingSaveMsg({ success: true, text: 'Company branding & document presets saved!' });
      setTimeout(() => setBrandingSaveMsg(null), 3500);
    } catch (err) {
      setBrandingSaveMsg({ success: false, text: err.message });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Logo file must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setBrandingSettings(prev => ({
        ...prev,
        company_logo: loadEvt.target.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setBrandingSettings(prev => ({
      ...prev,
      company_logo: '',
    }));
  };

  // Sales Agent Management Handlers
  const loadSalesAgents = async () => {
    try {
      setLoadingAgents(true);
      const data = await crmApi.getSalesAgents();
      setSalesAgents(data || []);
    } catch (err) {
      console.error('Failed to load sales agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleCreateAgentSubmit = async (e) => {
    e.preventDefault();
    setCreatingAgentLoading(true);
    setAgentError('');
    setAgentCreatedSuccess(null);
    try {
      const res = await crmApi.createSalesAgent(createAgentForm);
      setAgentCreatedSuccess({
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
      loadSalesAgents();
    } catch (err) {
      setAgentError(err.message || 'Failed to create sales agent account');
    } finally {
      setCreatingAgentLoading(false);
    }
  };

  const handleDeleteAgent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove sales agent "${name}" from your company workspace?`)) return;
    try {
      await crmApi.deleteSalesAgent(id);
      loadSalesAgents();
    } catch (err) {
      alert('Failed to remove agent: ' + err.message);
    }
  };

  // Agent Permissions Handlers
  const handleOpenPermissionsModal = async (agent) => {
    setSelectedAgentForPerms(agent);
    setPermissionsModalOpen(true);
    setLoadingAgentPerms(true);
    setPermsSaveMsg(null);
    setContactSearchQuery('');
    try {
      const data = await crmApi.getAgentPermissions(agent.id);
      setPermsForm(data.permissions || {
        leads: 'assigned',
        contacts: 'assigned',
        accounts: 'assigned',
        deals: 'assigned',
        products: 'none',
        quotes: 'assigned',
        automation: 'none',
        settings: 'none',
        reports: 'none'
      });
      const grantedIds = (data.grantedContacts || []).map(c => c.id);
      setGrantedContactIds(grantedIds);
      setAllCompanyContacts(data.allContacts || []);
    } catch (err) {
      console.error('Failed to load agent permissions:', err);
      setPermsSaveMsg({ success: false, text: err.message || 'Failed to load permissions' });
    } finally {
      setLoadingAgentPerms(false);
    }
  };

  const handleApplyPreset = (presetType) => {
    if (presetType === 'zero_data') {
      setPermsForm({
        leads: 'assigned',
        contacts: 'assigned',
        accounts: 'assigned',
        deals: 'assigned',
        products: 'none',
        quotes: 'assigned',
        automation: 'none',
        settings: 'none',
        reports: 'none'
      });
      setGrantedContactIds([]);
    } else if (presetType === 'standard_rep') {
      setPermsForm({
        leads: 'assigned',
        contacts: 'assigned',
        accounts: 'assigned',
        deals: 'assigned',
        products: 'view',
        quotes: 'assigned',
        automation: 'none',
        settings: 'none',
        reports: 'none'
      });
    } else if (presetType === 'senior_rep') {
      setPermsForm({
        leads: 'all',
        contacts: 'all',
        accounts: 'all',
        deals: 'all',
        products: 'manage',
        quotes: 'all',
        automation: 'none',
        settings: 'none',
        reports: 'full'
      });
    } else if (presetType === 'full_admin') {
      setPermsForm({
        leads: 'all',
        contacts: 'all',
        accounts: 'all',
        deals: 'all',
        products: 'manage',
        quotes: 'all',
        automation: 'full',
        settings: 'full',
        reports: 'full'
      });
    }
  };

  const handleToggleContactGrant = (contactId) => {
    setGrantedContactIds(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };

  const handleSelectAllContacts = () => {
    setGrantedContactIds(allCompanyContacts.map(c => c.id));
  };

  const handleClearAllContacts = () => {
    setGrantedContactIds([]);
  };

  const handleSavePermissions = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAgentForPerms) return;
    setSavingAgentPerms(true);
    setPermsSaveMsg(null);
    try {
      const res = await crmApi.updateAgentPermissions(selectedAgentForPerms.id, {
        permissions: permsForm,
        grantedContactIds
      });
      setPermsSaveMsg({ success: true, text: res.message || 'Permissions updated successfully!' });
      loadSalesAgents();
      setTimeout(() => {
        setPermissionsModalOpen(false);
      }, 1400);
    } catch (err) {
      setPermsSaveMsg({ success: false, text: err.message || 'Failed to save permissions.' });
    } finally {
      setSavingAgentPerms(false);
    }
  };

  // Save Outbound Email Settings
  const handleSaveEmail = async (e) => {
    e?.preventDefault();
    setIsSavingEmail(true);
    setEmailSaveMsg(null);
    try {
      await crmApi.saveEmailSettings(emailSettings);
      setEmailSaveMsg({ success: true, text: 'Email delivery settings saved successfully!' });
      setTimeout(() => setEmailSaveMsg(null), 3500);
    } catch (err) {
      setEmailSaveMsg({ success: false, text: err.message });
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Dispatch Live Test Email
  const handleTestEmail = async (e) => {
    e?.preventDefault();
    if (!testEmailAddress.trim()) {
      alert('Please enter a recipient email address for testing.');
      return;
    }
    setIsSendingTestEmail(true);
    setEmailTestResult(null);
    try {
      const res = await crmApi.testEmailSettings(testEmailAddress.trim());
      setEmailTestResult(res);
    } catch (err) {
      setEmailTestResult({ success: false, message: err.message });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Save AI Settings
  const handleSaveAi = async (e) => {
    e?.preventDefault();
    setIsSavingAi(true);
    setAiSaveMsg(null);
    try {
      await crmApi.saveAISettings(aiSettings);
      setAiSaveMsg({ success: true, text: 'AI configuration saved successfully!' });
      setTimeout(() => setAiSaveMsg(null), 3000);
    } catch (err) {
      setAiSaveMsg({ success: false, text: err.message });
    } finally {
      setIsSavingAi(false);
    }
  };

  // Test AI Connection
  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await crmApi.testAIConnection(aiSettings);
      setAiTestResult(res);
    } catch (err) {
      setAiTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingAi(false);
    }
  };

  // Save Telegram Settings
  const handleSaveTg = async (e) => {
    e?.preventDefault();
    setIsSavingTg(true);
    setTgSaveMsg(null);
    try {
      await crmApi.saveAISettings(tgSettings);
      setTgSaveMsg({ success: true, text: 'Telegram settings saved!' });
      setTimeout(() => setTgSaveMsg(null), 3000);
      checkTelegramStatus();
    } catch (err) {
      setTgSaveMsg({ success: false, text: err.message });
    } finally {
      setIsSavingTg(false);
    }
  };

  // Start / Stop Bot
  const handleToggleBot = async () => {
    setIsTogglingBot(true);
    try {
      if (botStatus.running) {
        await crmApi.stopTelegramBot();
      } else {
        await crmApi.startTelegramBot();
      }
      await checkTelegramStatus();
      await loadTelegramLogs();
    } catch (err) {
      alert(`Telegram Bot Error: ${err.message}`);
    } finally {
      setIsTogglingBot(false);
    }
  };

  // Test Send Telegram
  const handleSendTestTg = async (e) => {
    e.preventDefault();
    if (!testTgChatId.trim()) {
      alert('Please enter a Target Chat ID');
      return;
    }
    setIsSendingTestTg(true);
    setTgTestResult(null);
    try {
      const res = await crmApi.testTelegramBot(testTgChatId.trim(), testTgText);
      setTgTestResult({ success: true, message: 'Message sent successfully! Check your Telegram.' });
      loadTelegramLogs();
    } catch (err) {
      setTgTestResult({ success: false, message: err.message });
    } finally {
      setIsSendingTestTg(false);
    }
  };

  // Custom Fields Form Submit
  const handleAddFieldSubmit = async (e) => {
    e.preventDefault();
    try {
      const options = fieldForm.field_type === 'select'
        ? fieldForm.optionsText.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      await crmApi.createCustomField({
        entity_type: fieldForm.entity_type,
        field_label: fieldForm.field_label,
        field_type: fieldForm.field_type,
        options,
      });

      setIsAddingField(false);
      setFieldForm({
        entity_type: 'leads',
        field_label: '',
        field_type: 'text',
        optionsText: '',
      });
      loadCustomFields();
    } catch (err) {
      alert('Error creating custom field: ' + err.message);
    }
  };

  const handleDeleteField = async (id) => {
    if (!window.confirm('Delete this custom field?')) return;
    try {
      await crmApi.deleteCustomField(id);
      loadCustomFields();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!importText.trim()) return;

    try {
      const lines = importText.trim().split('\n');
      const leads = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || (i === 0 && line.toLowerCase().includes('first_name'))) continue;

        const parts = line.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 2) {
          leads.push({
            first_name: parts[0] || 'Unknown',
            last_name: parts[1] || 'Lead',
            company: parts[2] || 'Independent',
            email: parts[3] || '',
            phone: parts[4] || '',
            lead_source: parts[5] || 'CSV Import',
            lead_status: 'New'
          });
        }
      }

      if (leads.length === 0) {
        alert('No valid lead rows parsed. Format: First,Last,Company,Email,Phone,Source');
        return;
      }

      const res = await crmApi.importLeads(leads);
      setImportStatus(`Successfully imported ${res.count} leads into the database!`);
      setImportText('');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">System Configuration & Integrations</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
              AI + Telegram Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect Nous Hermes or custom LLMs, manage Telegram bot remote control, customize CRM schema and import data.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setAgentCreatedSuccess(null);
              setAgentError('');
              setIsCreatingAgent(true);
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> + Create Sales Agent
          </button>
          <button
            onClick={onResetData}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restore Fresh Demo Dataset
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'team'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-rose-300" />
          <span>Sales Team & Agents</span>
          {salesAgents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-extrabold">
              {salesAgents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'branding'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4 text-emerald-300" />
          <span>Company Profile & Presets</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'email'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4 text-indigo-300" />
          <span>Email Delivery (SMTP / Resend)</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ai'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>ABADI GURU Intelligence & LLM</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'telegram'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4 text-sky-200" />
          <span>Telegram Bot Remote Control</span>
          {botStatus.running && (
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'data'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-blue-300" />
          <span>Database Backup & CSV</span>
        </button>

        <button
          onClick={() => setActiveTab('custom_fields')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'custom_fields'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Custom Fields</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB: SALES TEAM & REPS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <h2 className="text-base font-extrabold text-slate-900">
                  Sales Team & Agent Accounts
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Manage login accounts, quotas, and sales performance for your representatives. Every team member logs into this isolated company workspace.
              </p>
            </div>
            <button
              onClick={() => {
                setAgentCreatedSuccess(null);
                setAgentError('');
                setIsCreatingAgent(true);
              }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Sales Agent</span>
            </button>
          </div>

          {/* Calculations for actual agents and workspace owner */}
          {(() => {
            const actualSalesAgents = salesAgents.filter(a => !a.isOwner && !a.role?.toLowerCase().includes('admin') && !a.role?.toLowerCase().includes('owner'));
            const companyAdmin = salesAgents.find(a => a.isOwner || a.role?.toLowerCase().includes('admin') || a.role?.toLowerCase().includes('owner'));

            return (
              <>
                {/* Quick Metrics Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sales Agent Accounts</span>
                    <div className="text-2xl font-black text-slate-800 flex items-baseline gap-1">
                      {actualSalesAgents.length} <span className="text-xs font-semibold text-slate-400">reps</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Combined Quota Target</span>
                    <div className="text-2xl font-black text-slate-800">
                      ${actualSalesAgents.reduce((sum, a) => sum + (Number(a.quota_target) || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Total Closed Won</span>
                    <div className="text-2xl font-black text-emerald-700">
                      ${actualSalesAgents.reduce((sum, a) => sum + (Number(a.wonAmount) || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Active Pipeline</span>
                    <div className="text-2xl font-black text-indigo-700">
                      ${actualSalesAgents.reduce((sum, a) => sum + (Number(a.pipelineAmount) || 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Company Administrator / Owner Card */}
                {companyAdmin && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                        {companyAdmin.name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">{companyAdmin.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            {companyAdmin.role || 'Company Admin'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Workspace Owner
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {companyAdmin.email} {companyAdmin.phone ? `• ${companyAdmin.phone}` : ''}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Full CRM Administrative & Permission Control
                        </div>

                        {companyAdmin.telegramLinkCode && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 font-mono">
                              <Send className="w-3 h-3 text-sky-600" />
                              Admin Telegram Code: <strong>{companyAdmin.telegramLinkCode}</strong>
                            </span>
                            {companyAdmin.telegramLinked ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Executive Bot Connected
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Bot Link
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const text = `/start ${companyAdmin.telegramLinkCode}`;
                                navigator.clipboard?.writeText(text);
                                alert(`Admin link command copied!\n\nSend "${text}" to your Telegram bot to enter Executive Admin Mode.`);
                              }}
                              className="text-[10px] font-bold text-slate-600 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 px-2 py-0.5 rounded transition-colors"
                            >
                              Copy /start Command
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right sm:border-l sm:border-slate-100 sm:pl-5">
                      <span className="text-[11px] text-slate-400 font-medium block">Workspace Privilege</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Super Administrator
                      </span>
                    </div>
                  </div>
                )}

                {/* Sales Agents Roster */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Target className="w-4 h-4 text-rose-500" />
                      Active Sales Agents ({actualSalesAgents.length})
                    </h3>
                    <button
                      onClick={loadSalesAgents}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      title="Refresh Team"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAgents ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingAgents ? (
                    <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
                      <span>Loading team members...</span>
                    </div>
                  ) : actualSalesAgents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">No Sales Agent Accounts Yet</p>
                        <p className="text-slate-400 mt-1 max-w-md mx-auto text-xs">
                          This company workspace was newly created and currently has 0 sales agents. All CRM data belongs exclusively to your company profile. Click below to provision your first sales representative account with custom permissions.
                        </p>
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            setAgentCreatedSuccess(null);
                            setAgentError('');
                            setIsCreatingAgent(true);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Sales Agent Account</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                            <th className="py-3 px-4">Representative</th>
                            <th className="py-3 px-4">Contact</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4 text-center">Deals</th>
                            <th className="py-3 px-4 text-right">Quota Target</th>
                            <th className="py-3 px-4 text-right">Closed Won</th>
                            <th className="py-3 px-4 text-center">Attainment</th>
                            <th className="py-3 px-4 text-center">Telegram Access</th>
                            <th className="py-3 px-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {actualSalesAgents.map((agent) => {
                            const isOwner = agent.role?.toLowerCase().includes('admin') || agent.role?.toLowerCase().includes('owner');
                            const pct = Math.min(Math.round(agent.percent || 0), 100);
                            return (
                              <tr key={agent.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4 font-semibold text-slate-800">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                                      {agent.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-slate-900">{agent.name}</div>
                                      <div className="text-[11px] text-slate-400">{agent.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-slate-600">
                                  {agent.phone || <span className="text-slate-400 italic">No phone</span>}
                                </td>
                                <td className="py-3.5 px-4 space-y-1">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    isOwner
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {agent.role || 'Sales Agent'}
                                  </span>
                                  {!isOwner && (
                                    <div className="flex flex-wrap gap-1">
                                      {agent.grantedContactsCount > 0 ? (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                          <Target className="w-3 h-3 text-indigo-500" /> {agent.grantedContactsCount} contacts
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                          <Lock className="w-3 h-3 text-slate-400" /> Zero contacts
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                                  {agent.dealCount || 0}
                                </td>
                                <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                                  ${(agent.quota_target || 0).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                                  ${(agent.wonAmount || 0).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="w-24 mx-auto space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold">
                                      <span className={pct >= 100 ? 'text-emerald-600' : 'text-slate-500'}>{pct}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-mono text-[10px] font-extrabold text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                      {agent.telegramLinkCode || 'No Code'}
                                    </span>
                                    {agent.telegramLinked ? (
                                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Connected
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5 text-amber-600" /> Pending
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const text = `/start ${agent.telegramLinkCode}`;
                                          navigator.clipboard?.writeText(text);
                                          alert(`Agent connection command copied!\n\nGive this to ${agent.name}:\n"${text}" to link their personal rep portfolio.`);
                                        }}
                                        className="text-[9px] font-bold text-slate-500 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 px-1.5 py-0.5 rounded transition-colors"
                                        title="Copy /start connection command"
                                      >
                                        Copy
                                      </button>
                                      {!isOwner && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!window.confirm(`Regenerate Telegram passcode for ${agent.name}?`)) return;
                                            try {
                                              const res = await crmApi.resetTelegramCode(agent.id);
                                              alert(`New passcode generated for ${agent.name}: ${res.telegram_link_code}`);
                                              loadSalesAgents();
                                            } catch (err) {
                                              alert('Failed to reset passcode: ' + err.message);
                                            }
                                          }}
                                          className="text-[9px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-1 rounded transition-colors"
                                          title="Regenerate passcode"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {!isOwner && (
                                      <button
                                        onClick={() => handleOpenPermissionsModal(agent)}
                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold text-[11px] shadow-2xs"
                                        title="Configure role permissions and grant access to specific contacts"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Permissions</span>
                                      </button>
                                    )}
                                    {!isOwner && (
                                      <button
                                        onClick={() => handleDeleteAgent(agent.id, agent.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Remove sales rep"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB: COMPANY BRANDING & DOCUMENT PRESETS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBranding} className="space-y-6">
          {brandingSaveMsg && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              brandingSaveMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {brandingSaveMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{brandingSaveMsg.text}</span>
            </div>
          )}

          {/* Section 1: Company Profile & Logo */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-600" />
                  Official Company Profile & PDF Branding
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your logo, company registration number, and address are automatically printed on Quotations, Delivery Orders, and Tax Invoices.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingBranding}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 shrink-0"
              >
                {isSavingBranding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save All Presets</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Logo Uploader */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-700 mb-2">Company Logo</span>
                {brandingSettings.company_logo ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <div className="w-32 h-32 rounded-xl border border-slate-200 bg-white p-2 shadow-xs flex items-center justify-center overflow-hidden">
                      <img src={brandingSettings.company_logo} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 rounded-lg shadow-2xs">
                        Change
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 text-[11px] font-bold border border-rose-200 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center w-36 h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all p-3">
                    <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-slate-700">Upload Logo</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP (Max 5MB)</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
                <span className="text-[10px] text-slate-400 mt-2 text-center">
                  Appears in header of all generated PDFs & preview modals
                </span>
              </div>

              {/* Company Details Inputs */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corporation Sdn Bhd"
                    value={brandingSettings.company_name}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Business Registration No. (SSM / Reg #)</label>
                  <input
                    type="text"
                    placeholder="e.g. 202401099882 (1542301-W)"
                    value={brandingSettings.company_reg_no}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_reg_no: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Default Currency Symbol</label>
                  <select
                    value={brandingSettings.currency_symbol}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, currency_symbol: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden font-bold"
                  >
                    <option value="$">$ (USD / CAD / AUD)</option>
                    <option value="RM">RM (Malaysian Ringgit)</option>
                    <option value="S$">S$ (Singapore Dollar)</option>
                    <option value="€">€ (Euro)</option>
                    <option value="£">£ (British Pound)</option>
                    <option value="¥">¥ (JPY / CNY)</option>
                    <option value="₹">₹ (Indian Rupee)</option>
                    <option value="IDR">IDR (Indonesian Rupiah)</option>
                    <option value="THB">฿ (Thai Baht)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+1 800-555-0199 / +60 3-8888 1234"
                    value={brandingSettings.company_phone}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Official Email Address</label>
                  <input
                    type="email"
                    placeholder="billing@company.com"
                    value={brandingSettings.company_email}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Website URL</label>
                  <input
                    type="text"
                    placeholder="https://www.company.com"
                    value={brandingSettings.company_website}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_website: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Registered Business Address</label>
                  <textarea
                    rows={2}
                    placeholder="Level 28, Tower 1, Financial District, Kuala Lumpur, Malaysia"
                    value={brandingSettings.company_address}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, company_address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Quotation Presets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              Quotation Presets & Acceptance Terms
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Quotation Number Prefix</label>
                <input
                  type="text"
                  placeholder="QT-"
                  value={brandingSettings.quote_prefix}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, quote_prefix: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:border-amber-500 outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Default Validity Period (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={brandingSettings.quote_validity_days}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, quote_validity_days: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Footer Note</label>
                <input
                  type="text"
                  placeholder="Thank you for your business!"
                  value={brandingSettings.quote_footer_note}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, quote_footer_note: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-bold mb-1">Default Terms & Conditions (Quotation)</label>
                <textarea
                  rows={2}
                  placeholder="1. Prices valid for 30 days. 2. 50% deposit required upon confirmation. 3. Lead time 7-14 working days."
                  value={brandingSettings.quote_default_terms}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, quote_default_terms: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-hidden resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Delivery Order Presets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-500" />
              Delivery Order (DO) Presets & Warehouse Dispatch
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">DO Number Prefix</label>
                <input
                  type="text"
                  placeholder="DO-"
                  value={brandingSettings.do_prefix}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, do_prefix: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:border-sky-500 outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Show Prices on Delivery Orders?</label>
                <select
                  value={brandingSettings.do_show_prices}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, do_show_prices: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-hidden"
                >
                  <option value="1">Yes (Display unit price and subtotal)</option>
                  <option value="0">No (Hide prices — Quantity & Description only)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">DO Footer Note</label>
                <input
                  type="text"
                  placeholder="Official receiver stamp & signature required upon delivery."
                  value={brandingSettings.do_footer_note}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, do_footer_note: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-hidden"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-bold mb-1">Default Delivery Terms & Acknowledgement</label>
                <textarea
                  rows={2}
                  placeholder="Goods must be inspected upon delivery. Damaged items or discrepancy must be endorsed on this DO and notified within 48 hours."
                  value={brandingSettings.do_default_terms}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, do_default_terms: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 outline-hidden resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Tax Invoice Presets & Bank Remittance */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              Tax Invoice Presets & Bank Remittance Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  placeholder="INV-"
                  value={brandingSettings.invoice_prefix}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_prefix: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:border-emerald-500 outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Terms</label>
                <input
                  type="text"
                  placeholder="Net 30 Days / Due Upon Receipt"
                  value={brandingSettings.invoice_payment_terms}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_payment_terms: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Default Tax / VAT / SST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="8.0"
                  value={brandingSettings.invoice_default_tax}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_default_tax: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                />
              </div>

              {/* Bank Details Box */}
              <div className="sm:col-span-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                  Official Bank Remittance Account (Printed on Invoice PDF)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-[11px]">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Maybank / DBS / Chase"
                      value={brandingSettings.invoice_bank_name}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_bank_name: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-[11px]">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="5140-1234-5678"
                      value={brandingSettings.invoice_bank_account_no}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_bank_account_no: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-hidden font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-[11px]">Beneficiary Account Name</label>
                    <input
                      type="text"
                      placeholder="e.g. ACME CORP SDN BHD"
                      value={brandingSettings.invoice_bank_account_name}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_bank_account_name: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1 text-[11px]">SWIFT / BIC Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="MBBEMYKL"
                      value={brandingSettings.invoice_swift_code}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_swift_code: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-bold mb-1">Default Invoice Terms & Late Fee Policy</label>
                <textarea
                  rows={2}
                  placeholder="1. Payment is due within stated terms. 2. A 1.5% monthly finance charge applies to overdue invoices."
                  value={brandingSettings.invoice_default_terms}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_default_terms: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden resize-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-bold mb-1">Invoice Footer Note</label>
                <input
                  type="text"
                  placeholder="Please email payment confirmation / remittance advice to billing@company.com"
                  value={brandingSettings.invoice_footer_note}
                  onChange={(e) => setBrandingSettings({ ...brandingSettings, invoice_footer_note: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSavingBranding}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              {isSavingBranding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save All Company Presets & Branding</span>
            </button>
          </div>
        </form>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB: OUTBOUND EMAIL DELIVERY CONFIGURATION */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSaveEmail} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600" />
                  Outbound Email Delivery (SMTP / Resend)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Real Mail Delivery
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure SMTP (Gmail, Google Workspace, Microsoft 365, Amazon SES) or Resend API so lead emails and invoices are delivered to actual inboxes.
              </p>
            </div>

            {emailSaveMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                emailSaveMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {emailSaveMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{emailSaveMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Delivery Method</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'none', title: 'Simulation Mode', desc: 'Logs emails to contact timelines without sending real mail.' },
                  { id: 'smtp', title: 'Custom SMTP Server', desc: 'Google Workspace, Office 365, AWS SES or private mail server.' },
                  { id: 'resend', title: 'Resend Cloud API', desc: 'Fast transactional email API service via resend.com.' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEmailSettings({ ...emailSettings, email_delivery_provider: item.id })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      emailSettings.email_delivery_provider === item.id
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800">{item.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {emailSettings.email_delivery_provider === 'smtp' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SMTP Host *</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com / mail.company.com"
                      value={emailSettings.smtp_host}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SMTP Port</label>
                    <input
                      type="text"
                      placeholder="587 or 465"
                      value={emailSettings.smtp_port}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SMTP Username / Login</label>
                    <input
                      type="text"
                      placeholder="user@company.com"
                      value={emailSettings.smtp_user}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">SMTP Password / App Password</label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        value={emailSettings.smtp_pass}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_pass: e.target.value })}
                        className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sender From Name</label>
                    <input
                      type="text"
                      placeholder="Alex Mercer | ABADI GURU Sales"
                      value={emailSettings.smtp_from_name}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sender From Email</label>
                    <input
                      type="email"
                      placeholder="sales@company.com"
                      value={emailSettings.smtp_from_email}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailSettings.smtp_secure === '1'}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked ? '1' : '0' })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">Use Secure SSL/TLS (Default enabled for Port 465)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {emailSettings.email_delivery_provider === 'resend' && (
              <div className="space-y-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Resend API Key *</label>
                  <div className="relative">
                    <input
                      type={showResendKey ? 'text' : 'password'}
                      placeholder="re_123456789..."
                      value={emailSettings.resend_api_key}
                      onChange={(e) => setEmailSettings({ ...emailSettings, resend_api_key: e.target.value })}
                      className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResendKey(!showResendKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sender From Email</label>
                    <input
                      type="email"
                      placeholder="sales@yourverifieddomain.com"
                      value={emailSettings.smtp_from_email}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Sender From Name</label>
                    <input
                      type="text"
                      placeholder="ABADI GURU Sales Team"
                      value={emailSettings.smtp_from_name}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_from_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSavingEmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {isSavingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Email Settings</span>
              </button>
            </div>
          </form>

          {/* Test Email Dispatcher Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Live Email Dispatch Verification
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Send a real test email to verify credentials, DNS SPF/DKIM verification, and deliverability.
              </p>

              <form onSubmit={handleTestEmail} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Test Email</label>
                  <input
                    type="email"
                    required
                    placeholder="your-email@gmail.com"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 outline-hidden font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingTestEmail || !testEmailAddress.trim()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSendingTestEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>Dispatch Live Test Email</span>
                </button>
              </form>

              {emailTestResult && (
                <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                  emailTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {emailTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  <span className="text-[11px] leading-relaxed">{emailTestResult.message || 'Dispatched.'}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
              <span className="font-bold text-slate-700 block mb-0.5">Tip for Google Workspace:</span>
              If using 2-Factor Authentication, generate an <b>App Password</b> at myaccount.google.com/apppasswords.
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB: DATABASE BACKUP & DATA PORTABILITY */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'data' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Physical Database Backup Download Card */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-white to-blue-50/30 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900">Physical Database Backup</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Your workspace runs in a <b>100% physically isolated SQLite database</b>.
                Download your complete binary file anytime with all leads, deals, quotes, and settings.
              </p>
              <div className="mt-4 p-3 bg-white rounded-xl border border-blue-100 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Zero Vendor Lock-In</span>
                </div>
                <p className="text-slate-500">
                  Open with any SQLite browser (DB Browser for SQLite) or host on your private server.
                </p>
              </div>
            </div>

            <a
              href={crmApi.getDatabaseBackupUrl()}
              download
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 text-center"
            >
              <Download className="w-4 h-4" />
              <span>Download SQLite Database (.sqlite)</span>
            </a>
          </div>

          {/* CSV Export & Import */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Spreadsheet Data Export (.csv)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Download comma-separated spreadsheets for Excel, Google Sheets, or external BI tools.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
                {['leads', 'accounts', 'contacts', 'deals'].map(ent => (
                  <a
                    key={ent}
                    href={crmApi.getExportUrl(ent)}
                    download
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-white text-slate-800 font-bold text-center capitalize flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>{ent}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                Bulk Import Leads (Paste CSV)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Paste rows with format: <code>First Name, Last Name, Company, Email, Phone, Lead Source</code>
              </p>

              <form onSubmit={handleCsvImport} className="space-y-3 text-xs">
                <textarea
                  rows={4}
                  placeholder="First Name,Last Name,Company,Email,Phone,Source&#10;Alice,Smith,Apex Logistics,alice@apex.com,+1 555-0199,Website&#10;John,Doe,Cyberdyne Systems,john@cyberdyne.io,+1 555-0188,LinkedIn"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 font-mono text-[11px] outline-hidden"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Headers optional. Minimum requirement: First Name, Last Name.
                  </span>
                  <button
                    type="submit"
                    disabled={!importText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Into Database</span>
                  </button>
                </div>
              </form>

              {importStatus && (
                <div className="mt-3 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: AI MODEL & HERMES CONFIGURATION */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Config Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-violet-600" />
                  Connect ABADI GURU Intelligence Copilot or Any AI Model
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">API Protocol:</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                    OpenAI /chat/completions with Tools
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure your LLM provider. ABADI GURU CRM works with local offline models (Nous Hermes via Ollama or LM Studio) as well as cloud providers (OpenRouter, Groq, OpenAI).
              </p>
            </div>

            {/* Quick Preset Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Model Provider Preset
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(AI_PRESETS).map(([key, preset]) => {
                  const isSelected = aiSettings.ai_provider === preset.provider;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-violet-600 bg-violet-50/70 ring-1 ring-violet-500'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{preset.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Form */}
            <form onSubmit={handleSaveAi} className="space-y-4 pt-2" autoComplete="off" data-lpignore="true">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    API Base URL *
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="http://localhost:11434/v1"
                      value={aiSettings.ai_base_url}
                      onChange={(e) => setAiSettings({ ...aiSettings, ai_base_url: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Accepts base <code>https://.../v1</code> or full <code>.../chat/completions</code>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Model Identifier *
                  </label>
                  <div className="relative">
                    <Cpu className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      name="model_identifier"
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="hermes-3-llama-3.1-8b"
                      value={aiSettings.ai_model}
                      onChange={(e) => setAiSettings({ ...aiSettings, ai_model: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    e.g. <code>abadi-guru-neural-core</code>, <code>hermes-3-llama-3.1-8b</code>, <code>gpt-4o-mini</code>
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Key <span className="font-normal text-slate-400">(optional for local Ollama)</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    name="model_secret_api_token"
                    autoComplete="new-password"
                    data-lpignore="true"
                    placeholder="sk-... or gsk_... (leave empty for local Ollama)"
                    value={aiSettings.ai_api_key}
                    onChange={(e) => setAiSettings({ ...aiSettings, ai_api_key: e.target.value })}
                    className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons & Feedback */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSavingAi}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSavingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save AI Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestAi}
                    disabled={isTestingAi}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    {isTestingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-600" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                    <span>Test Connection</span>
                  </button>
                </div>

                {aiSaveMsg && (
                  <span className={`text-xs font-semibold ${aiSaveMsg.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {aiSaveMsg.text}
                  </span>
                )}
              </div>

              {/* Test Result Badge */}
              {aiTestResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    aiTestResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {aiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{aiTestResult.success ? 'Connection Successful!' : 'Connection Warning / Offline'}</span>
                  </div>
                  <div>{aiTestResult.message}</div>
                  {aiTestResult.model && (
                    <div className="mt-1 font-mono text-[11px] opacity-80">
                      Model Verified: {aiTestResult.model}
                    </div>
                  )}
                  {!aiTestResult.success && (
                    <div className="mt-2 text-[11px] text-slate-600">
                      <strong>Tip:</strong> If you're testing offline or don't have Ollama running yet, ABADI GURU CRM will automatically use its internal intelligent keyword NLP engine to parse pipeline summaries and deal creations!
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Quick Guide & Capabilities */}
          <div className="space-y-4">
            {/* Quick Ollama / Hermes guide */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-slate-800">
              <div className="flex items-center gap-2 mb-2 font-extrabold text-sm text-violet-300">
                <Terminal className="w-4 h-4" />
                <span>Running Hermes Locally (Free & Offline)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                Nous Hermes 3 is specifically fine-tuned for structured tool calling and conversational agent reasoning.
              </p>
              <div className="bg-black/60 rounded-xl p-3 font-mono text-xs text-emerald-400 select-all border border-slate-700/80 mb-3">
                $ ollama run hermes-3-llama-3.1-8b
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Once Ollama is running, simply click <strong>Test Connection</strong>. ABADI GURU CRM will link directly to Hermes with zero latency.
              </p>
            </div>

            {/* CRM Tools Registered */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Connected CRM Tools (Functions)
              </h3>
              <p className="text-[11px] text-slate-500">
                Your AI model has access to execute these live CRM operations via OpenAI function calling:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-slate-800 font-mono text-[11px]">get_pipeline_summary()</span>
                  <div className="text-[11px] text-slate-500">Pipeline totals, won revenue, win rate, stage counts</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-slate-800 font-mono text-[11px]">list_deals() / create_deal()</span>
                  <div className="text-[11px] text-slate-500">Search and insert enterprise deals directly into Kanban</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-slate-800 font-mono text-[11px]">update_deal_stage()</span>
                  <div className="text-[11px] text-slate-500">Move deals between Qualification, Proposal, Won, etc.</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-slate-800 font-mono text-[11px]">list_leads() / create_lead()</span>
                  <div className="text-[11px] text-slate-500">Inspect inbound prospects and create new leads</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="font-bold text-slate-800 font-mono text-[11px]">create_task()</span>
                  <div className="text-[11px] text-slate-500">Schedule follow-up calls, meetings, or reminders</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: TELEGRAM BOT REMOTE CONTROL */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bot Control & Settings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              {/* Bot Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                    botStatus.running ? 'bg-sky-500 shadow-md shadow-sky-500/20' : 'bg-slate-400'
                  }`}>
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        Telegram Bot Engine
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        botStatus.running
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {botStatus.running ? '● Running (Polling)' : '○ Stopped'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {botStatus.running && botStatus.botUser ? (
                        <span>Connected to @{botStatus.botUser.username} ({botStatus.botUser.first_name})</span>
                      ) : (
                        <span>Configure your bot token from @BotFather below</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleBot}
                    disabled={isTogglingBot || !tgSettings.telegram_token}
                    className={`px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 ${
                      botStatus.running
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                    }`}
                  >
                    {isTogglingBot ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : botStatus.running ? (
                      <>
                        <Square className="w-3.5 h-3.5" /> Stop Bot
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Start Bot
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bot Token & Chat ID Config */}
              <form onSubmit={handleSaveTg} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company Telegram Bot Token *
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      value={tgSettings.telegram_token}
                      onChange={(e) => setTgSettings({ ...tgSettings, telegram_token: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 font-mono outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Single unified bot for the whole company from <strong>@BotFather</strong>. Both Company Admins and Sales Agents connect to this same bot. The bot automatically identifies each user and differentiates their permissions based on their link code (ADM-XXXXXX for Admins, AGT-XXXXXX for Sales Agents).
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Admin Chat ID <span className="font-normal text-slate-400">(for proactive alerts)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 987654321 (auto-filled on first /start)"
                      value={tgSettings.telegram_chat_id}
                      onChange={(e) => {
                        setTgSettings({ ...tgSettings, telegram_chat_id: e.target.value });
                        setTestTgChatId(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 font-mono outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Receives instant alerts when deals are marked "Closed Won"
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Auto-Start Bot on Server Launch
                    </label>
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tg_enabled_check"
                        checked={Boolean(tgSettings.telegram_enabled)}
                        onChange={(e) => setTgSettings({ ...tgSettings, telegram_enabled: e.target.checked ? 1 : 0 })}
                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                      />
                      <label htmlFor="tg_enabled_check" className="text-xs font-medium text-slate-700">
                        Keep Telegram bot actively polling in the background
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={isSavingTg}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSavingTg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Telegram Settings</span>
                  </button>

                  {tgSaveMsg && (
                    <span className={`text-xs font-semibold ${tgSaveMsg.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tgSaveMsg.text}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Test Outbound Telegram Message Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                Send Test Push Notification
              </h3>
              <form onSubmit={handleSendTestTg} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <input
                    type="text"
                    required
                    placeholder="Recipient Chat ID"
                    value={testTgChatId}
                    onChange={(e) => setTestTgChatId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden font-mono"
                  />
                </div>
                <div className="sm:col-span-1">
                  <input
                    type="text"
                    required
                    placeholder="Notification message"
                    value={testTgText}
                    onChange={(e) => setTestTgText(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden"
                  />
                </div>
                <div className="sm:col-span-1 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSendingTestTg || !testTgChatId}
                    className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingTestTg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Ping</span>
                  </button>
                </div>
              </form>

              {tgTestResult && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  tgTestResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}>
                  {tgTestResult.message}
                </div>
              )}
            </div>

            {/* Telegram Live Event Logs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-600" />
                    Recent Telegram Interactions
                  </h3>
                  <p className="text-[11px] text-slate-500">Live feed of inbound commands and AI responses</p>
                </div>
                <button
                  onClick={loadTelegramLogs}
                  disabled={loadingLogs}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {tgLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                  No telegram messages recorded yet. Start your bot and message it from Telegram!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto rounded-xl border border-slate-100">
                  {tgLogs.map((log) => (
                    <div key={log.id} className="p-3 text-xs hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            log.direction === 'in' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {log.direction === 'in' ? 'INBOUND' : 'OUTBOUND'}
                          </span>
                          <span className="font-bold text-slate-800">{log.user_name || 'User'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Chat #{log.chat_id}</span>
                        </div>
                        <div className="text-slate-700 text-xs whitespace-pre-wrap font-sans">
                          {log.message_text}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Telegram Command Cheat Sheet */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-sky-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-sky-800">
              <div className="flex items-center gap-2 mb-2 font-extrabold text-sm text-sky-300">
                <Send className="w-4 h-4" />
                <span>Telegram Commands Cheat Sheet</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                Control your CRM from any phone or computer with these built-in slash commands:
              </p>

              <div className="space-y-2.5 font-mono text-[11px]">
                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/summary</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Pipeline value, deal count, won revenue, win rate
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/deals</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    List top 5 open pipeline opportunities
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/leads</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    List latest unconverted leads and statuses
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/tasks</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Show upcoming pending tasks & calls
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/add_lead Name | Company | Email</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Quickly create a prospect on the go
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/add_deal Name | Amount | Company</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Add new opportunity into Qualification
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/won &lt;Deal_ID&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Mark deal Closed Won + trigger workflows
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/quote Client | Amount | Item</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Generate Quotation + branded PDF directly in Telegram
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/convert_do &lt;Quote_ID&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Convert Quote to Delivery Order + generate DO PDF
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/convert_invoice &lt;ID&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Convert Quote/DO to Tax Invoice + generate Invoice PDF
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/documents</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    List all quotations, delivery orders & invoices
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/email To | Subject | Message</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Send outbound email via SMTP/Resend to any address
                  </div>
                </div>

                <div className="p-2.5 bg-black/40 rounded-xl border border-sky-500/20">
                  <div className="text-sky-300 font-bold">/email_doc &lt;Doc#&gt; | Recipient</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Email official branded quote/invoice PDF directly to client
                  </div>
                </div>

                <div className="p-2.5 bg-sky-950/80 rounded-xl border border-sky-400/40">
                  <div className="text-sky-200 font-extrabold uppercase text-[10px] tracking-wider mb-1">Role Authentication Commands</div>
                  <div className="text-sky-300 font-bold">/start &lt;ADM-XXXXXX or AGT-XXXXXX&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    1-Click link account. Automatically grants Admin Executive Mode or Sales Agent Mode.
                  </div>
                  <div className="text-sky-300 font-bold mt-1.5">/login &lt;email&gt; &lt;password&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Sign in to your CRM workspace account directly via Telegram chat.
                  </div>
                </div>

                <div className="p-2.5 bg-amber-950/60 rounded-xl border border-amber-500/30">
                  <div className="text-amber-300 font-extrabold uppercase text-[10px] tracking-wider mb-1">Admin Executive Commands</div>
                  <div className="text-amber-200 font-bold">/team (or /reps)</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Company leaderboard: reps' quotas, closed won revenues, and attainment %
                  </div>
                  <div className="text-amber-200 font-bold mt-1.5">/grant &lt;agent_email&gt; &lt;contact_id&gt;</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Grant a sales rep access to view & contact a specific client profile
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
                  <div className="text-emerald-300 font-extrabold uppercase text-[10px] tracking-wider mb-1">Sales Agent Rep Commands</div>
                  <div className="text-emerald-200 font-bold">/quota</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Personal quota target progress bar and remaining target gap
                  </div>
                  <div className="text-emerald-200 font-bold mt-1.5">/contacts</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    List contacts granted to you by company administration
                  </div>
                </div>

                <div className="p-2.5 bg-violet-950/60 rounded-xl border border-violet-500/30">
                  <div className="text-amber-300 font-bold">Natural Text (AI Copilot)</div>
                  <div className="text-slate-300 font-sans text-[10px] mt-0.5">
                    Any other text is answered by the AI Copilot with live CRM data querying!
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-2">
              <h4 className="font-bold text-slate-800">Proactive Push Alerts</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Whenever any sales rep closes a deal as <strong>Closed Won</strong> in the Kanban board or via API, your Telegram bot immediately sends a celebration alert with the deal value and account name!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: CUSTOM FIELDS & CSV DATA TOOLS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'custom_fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custom Field Builder */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-rose-600" /> Custom Field Builder
                  </h2>
                  <p className="text-[11px] text-slate-500">Extend entities with custom data attributes</p>
                </div>

                <button
                  onClick={() => setIsAddingField(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New Field
                </button>
              </div>

              {/* Entity selector tabs */}
              <div className="flex items-center gap-2 mb-4 border-b pb-2 border-slate-100 text-xs">
                {['leads', 'deals', 'contacts', 'accounts'].map(ent => (
                  <button
                    key={ent}
                    onClick={() => setEntityFilter(ent)}
                    className={`px-3 py-1 rounded-md font-semibold capitalize transition-all ${
                      entityFilter === ent
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ent}
                  </button>
                ))}
              </div>

              {/* Field list */}
              {loadingFields ? (
                <div className="text-slate-400 text-xs py-4 text-center">Loading fields...</div>
              ) : customFields.length === 0 ? (
                <div className="text-slate-400 text-xs py-6 text-center italic">
                  No custom fields defined for {entityFilter}. Click "New Field" to add one!
                </div>
              ) : (
                <div className="space-y-2">
                  {customFields.map(f => (
                    <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{f.field_label}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Key: {f.field_key} &bull; Type: <span className="font-semibold text-slate-600">{f.field_type}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteField(f.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CSV Export & Import */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" /> CSV Data Tools
                </h2>
                <p className="text-[11px] text-slate-500">Export database to spreadsheet or bulk import leads</p>
              </div>

              {/* 1-Click Export buttons */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Export Current Data (.csv)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {['leads', 'accounts', 'contacts', 'deals'].map(ent => (
                    <a
                      key={ent}
                      href={crmApi.getExportUrl(ent)}
                      download
                      className="p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-slate-800 font-bold text-center capitalize flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" /> {ent}
                    </a>
                  ))}
                </div>
              </div>

              {/* CSV Import */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Bulk Import Leads (Paste CSV)
                </span>
                <form onSubmit={handleCsvImport} className="space-y-2 text-xs">
                  <textarea
                    rows={3}
                    placeholder="First Name,Last Name,Company,Email,Phone,Source&#10;Alice,Smith,Apex Logistics,alice@apex.com,+1 555-0199,Website"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 font-mono text-[11px] outline-hidden"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Comma-separated with or without header
                    </span>
                    <button
                      type="submit"
                      disabled={!importText.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-lg shadow-xs flex items-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" /> Import Leads
                    </button>
                  </div>
                </form>

                {importStatus && (
                  <div className="mt-3 p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{importStatus}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Field Modal */}
      {isAddingField && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddingField(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 cursor-default">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Add New Custom Field</h3>
              <button
                type="button"
                onClick={() => setIsAddingField(false)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFieldSubmit} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Target Entity</label>
                <select
                  value={fieldForm.entity_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, entity_type: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                >
                  <option value="leads">Leads</option>
                  <option value="deals">Deals</option>
                  <option value="contacts">Contacts</option>
                  <option value="accounts">Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budget Approval Status"
                  value={fieldForm.field_label}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Field Type</label>
                <select
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-hidden"
                >
                  <option value="text">Single Line Text</option>
                  <option value="number">Numeric Value</option>
                  <option value="select">Dropdown Select List</option>
                  <option value="date">Date Picker</option>
                </select>
              </div>

              {fieldForm.field_type === 'select' && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Select Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Approved, Pending Review, Rejected"
                    value={fieldForm.optionsText}
                    onChange={(e) => setFieldForm({ ...fieldForm, optionsText: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-rose-500 outline-hidden"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingField(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Create Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SALES AGENT MODAL */}
      {isCreatingAgent && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsCreatingAgent(false);
              setAgentCreatedSuccess(null);
              setAgentError('');
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden cursor-default">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Create Sales Agent Account</h3>
                  <p className="text-[11px] text-slate-500">Add a team member to collaborate in this company workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAgent(false);
                  setAgentCreatedSuccess(null);
                  setAgentError('');
                }}
                aria-label="Close modal"
                title="Close (Esc)"
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {agentCreatedSuccess ? (
              <div className="p-6 space-y-4 text-xs text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">Sales Agent Account Created!</h4>
                  <p className="text-slate-500 text-xs mt-1">
                    Your sales representative can now sign in using the credentials below to access this workspace.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500">Representative:</span>
                    <span className="font-extrabold text-slate-900">{agentCreatedSuccess.agent?.name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500">Login Email:</span>
                    <span className="font-mono font-bold text-slate-900">{agentCreatedSuccess.credentials?.email}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500">Password:</span>
                    <span className="font-mono font-bold text-rose-600">{agentCreatedSuccess.credentials?.password}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500">Monthly Quota:</span>
                    <span className="font-bold text-emerald-600">${Number(agentCreatedSuccess.agent?.quota_target || 50000).toLocaleString()}</span>
                  </div>
                  {agentCreatedSuccess.agent?.telegramLinkCode && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">Telegram Bot Passcode:</span>
                      <span className="font-mono font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {agentCreatedSuccess.agent?.telegramLinkCode}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `ABADI GURU CRM Login Credentials:\nEmail: ${agentCreatedSuccess.credentials?.email}\nPassword: ${agentCreatedSuccess.credentials?.password}\nWorkspace: ${agentCreatedSuccess.agent?.company || 'Company CRM'}${agentCreatedSuccess.agent?.telegramLinkCode ? `\nTelegram Bot Code: ${agentCreatedSuccess.agent.telegramLinkCode}` : ''}`;
                      navigator.clipboard?.writeText(text);
                      alert('Credentials copied to clipboard!');
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Credentials</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgentCreatedSuccess(null);
                      setAgentError('');
                    }}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                  >
                    + Add Another Agent
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAgentSubmit} className="p-6 space-y-4 text-xs">
                {agentError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{agentError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Company Workspace Sharing:</strong> This agent will have their own independent login and track their own leads, deals, and quotas inside this company's CRM database.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Sales Representative Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={createAgentForm.name}
                    onChange={(e) => setCreateAgentForm({ ...createAgentForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Work Email (Login) *</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@company.com"
                      value={createAgentForm.email}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Initial Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={createAgentForm.password}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, password: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={createAgentForm.phone}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, phone: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Team Role</label>
                    <select
                      value={createAgentForm.role}
                      onChange={(e) => setCreateAgentForm({ ...createAgentForm, role: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                    >
                      <option value="Sales Agent">Sales Agent</option>
                      <option value="Senior Account Executive">Senior Account Executive</option>
                      <option value="Sales Manager">Sales Manager</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Monthly Sales Quota Target ($)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="50000"
                    value={createAgentForm.quota_target}
                    onChange={(e) => setCreateAgentForm({ ...createAgentForm, quota_target: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 outline-hidden font-medium"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingAgent(false);
                      setAgentError('');
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAgentLoading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {creatingAgentLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    <span>Create Agent Account</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Agent Permissions & Granular Access Control Modal */}
      {permissionsModalOpen && selectedAgentForPerms && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPermissionsModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
        >
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 cursor-default">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">Agent Permissions & Access Control</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      {selectedAgentForPerms.role || 'Sales Agent'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Configure granular access for <span className="font-semibold text-white">{selectedAgentForPerms.name}</span> ({selectedAgentForPerms.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionsModalOpen(false)}
                aria-label="Close modal"
                title="Close (Esc)"
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAgentPerms ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-semibold">Loading agent permissions and contact roster...</p>
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  {permsSaveMsg && (
                    <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 ${
                      permsSaveMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {permsSaveMsg.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                      <span>{permsSaveMsg.text}</span>
                    </div>
                  )}

                  {/* Preset Configurations */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Quick Permission Presets
                      </span>
                      <span className="text-xs text-slate-400">Click a preset to quickly apply standard roles</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('zero_data')}
                        className="p-3 text-left bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl transition-all group cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 flex items-center gap-1.5 mb-1">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          Zero Data
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">Zero data until admin assigns records or grants contacts.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('standard_rep')}
                        className="p-3 text-left bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl transition-all group cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5 mb-1">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          Standard Rep
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">Assigned records only + view products. No settings/reports.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('senior_rep')}
                        className="p-3 text-left bg-white hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 rounded-xl transition-all group cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 flex items-center gap-1.5 mb-1">
                          <Award className="w-3.5 h-3.5 text-purple-500" />
                          Senior Rep
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">View all leads, contacts, deals, quotes + reports.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('full_admin')}
                        className="p-3 text-left bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all group cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5 mb-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          Full Access
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">Unrestricted workspace access across every module.</p>
                      </button>
                    </div>
                  </div>

                  {/* Module Matrix */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Module Permissions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Leads */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Leads</span>
                          <span className="text-[11px] font-normal text-slate-400">Prospective Clients</span>
                        </label>
                        <select
                          value={permsForm.leads || 'assigned'}
                          onChange={(e) => setPermsForm({ ...permsForm, leads: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="assigned">Assigned Leads Only (Zero if new)</option>
                          <option value="all">All Company Leads</option>
                        </select>
                      </div>

                      {/* Contacts */}
                      <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-1.5">
                        <label className="text-xs font-bold text-indigo-950 flex items-center justify-between">
                          <span>Contacts</span>
                          <span className="text-[11px] font-semibold text-indigo-600">Granular Grants Below</span>
                        </label>
                        <select
                          value={permsForm.contacts || 'assigned'}
                          onChange={(e) => setPermsForm({ ...permsForm, contacts: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-indigo-300 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="assigned">Assigned & Granted Only</option>
                          <option value="all">All Company Contacts</option>
                        </select>
                      </div>

                      {/* Accounts */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Accounts</span>
                          <span className="text-[11px] font-normal text-slate-400">Companies & Orgs</span>
                        </label>
                        <select
                          value={permsForm.accounts || 'assigned'}
                          onChange={(e) => setPermsForm({ ...permsForm, accounts: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="assigned">Assigned Accounts Only</option>
                          <option value="all">All Company Accounts</option>
                        </select>
                      </div>

                      {/* Deals */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Deals & Pipeline</span>
                          <span className="text-[11px] font-normal text-slate-400">Sales Opportunities</span>
                        </label>
                        <select
                          value={permsForm.deals || 'assigned'}
                          onChange={(e) => setPermsForm({ ...permsForm, deals: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="assigned">Assigned Deals Only</option>
                          <option value="all">All Company Deals</option>
                        </select>
                      </div>

                      {/* Quotes */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Quotes & Invoices</span>
                          <span className="text-[11px] font-normal text-slate-400">Billing Documents</span>
                        </label>
                        <select
                          value={permsForm.quotes || 'assigned'}
                          onChange={(e) => setPermsForm({ ...permsForm, quotes: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="assigned">Assigned Quotes Only</option>
                          <option value="all">All Company Quotes</option>
                        </select>
                      </div>

                      {/* Products */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Products Catalog</span>
                          <span className="text-[11px] font-normal text-slate-400">Price Book</span>
                        </label>
                        <select
                          value={permsForm.products || 'none'}
                          onChange={(e) => setPermsForm({ ...permsForm, products: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Hidden / No Access</option>
                          <option value="view">View Products (Use in Deals)</option>
                          <option value="manage">Manage & Edit Products</option>
                        </select>
                      </div>

                      {/* Automation */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Automation & Bot</span>
                          <span className="text-[11px] font-normal text-slate-400">Workflows & Telegram</span>
                        </label>
                        <select
                          value={permsForm.automation || 'none'}
                          onChange={(e) => setPermsForm({ ...permsForm, automation: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Restricted (Admin Only)</option>
                          <option value="view">View Automations Only</option>
                          <option value="full">Create & Run Automations</option>
                        </select>
                      </div>

                      {/* Workspace Settings */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Workspace Settings</span>
                          <span className="text-[11px] font-normal text-slate-400">Company Configuration</span>
                        </label>
                        <select
                          value={permsForm.settings || 'none'}
                          onChange={(e) => setPermsForm({ ...permsForm, settings: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Restricted (Admin Only)</option>
                          <option value="view">View Settings Only</option>
                          <option value="full">Full Settings Access</option>
                        </select>
                      </div>

                      {/* Reports */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Analytics & Reports</span>
                          <span className="text-[11px] font-normal text-slate-400">Executive Dashboards</span>
                        </label>
                        <select
                          value={permsForm.reports || 'none'}
                          onChange={(e) => setPermsForm({ ...permsForm, reports: e.target.value })}
                          className="w-full text-xs font-semibold p-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-hidden"
                        >
                          <option value="none">Restricted (Zero Access)</option>
                          <option value="assigned">Personal Quota & Stats Only</option>
                          <option value="full">Full Company Reports</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Granular Contact Access Section */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-600" />
                          Granular Contact-Level Access Grants
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          When Contacts permission is set to <span className="font-semibold text-slate-700">"Assigned & Granted Only"</span>, the agent can only see and interact with the specific contacts checked below.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {grantedContactIds.length} of {allCompanyContacts.length} Granted
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectAllContacts}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllContacts}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Contact search */}
                    <div className="relative mb-3">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search company contacts by name, email, or company..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden font-medium"
                      />
                    </div>

                    {/* Contact items list */}
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50/50">
                      {(allCompanyContacts || []).filter(c => {
                        if (!contactSearchQuery) return true;
                        const q = contactSearchQuery.toLowerCase();
                        return (
                          (c.first_name || '').toLowerCase().includes(q) ||
                          (c.last_name || '').toLowerCase().includes(q) ||
                          (c.email || '').toLowerCase().includes(q) ||
                          (c.company_name || '').toLowerCase().includes(q)
                        );
                      }).length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          {allCompanyContacts.length === 0 ? 'No contacts exist in this company yet.' : 'No contacts match your search query.'}
                        </div>
                      ) : (
                        (allCompanyContacts || []).filter(c => {
                          if (!contactSearchQuery) return true;
                          const q = contactSearchQuery.toLowerCase();
                          return (
                            (c.first_name || '').toLowerCase().includes(q) ||
                            (c.last_name || '').toLowerCase().includes(q) ||
                            (c.email || '').toLowerCase().includes(q) ||
                            (c.company_name || '').toLowerCase().includes(q)
                          );
                        }).map(contact => {
                          const isGranted = grantedContactIds.includes(contact.id);
                          const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact';
                          return (
                            <div
                              key={contact.id}
                              onClick={() => handleToggleContactGrant(contact.id)}
                              className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isGranted ? 'bg-indigo-50/70 hover:bg-indigo-50' : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  isGranted ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">{fullName}</span>
                                    {contact.company_name && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate">
                                        {contact.company_name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 truncate">
                                    {contact.email && <span>{contact.email}</span>}
                                    {contact.phone && <span>{contact.phone}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                                isGranted ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isGranted ? 'Access Granted' : 'Locked'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Changes take effect immediately across all agent devices & sessions.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAgentPerms || loadingAgentPerms}
                  onClick={handleSavePermissions}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {savingAgentPerms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{savingAgentPerms ? 'Saving Permissions...' : 'Save Permissions & Grants'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
