import React, { useState } from 'react';
import {
  Settings,
  X,
  Mail,
  RotateCcw,
  Check,
  Eye,
  ExternalLink,
  Sparkles,
  Info,
  Copy,
  Send,
  FileText,
  Clock,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { EmailTemplate, FollowUpTemplate, GoogleSheetSyncConfig } from '../types/index.ts';
import {
  JERRY_GUEST_POST_TEMPLATE,
  PRESET_EMAIL_TEMPLATES,
  JERRY_DEFAULT_FOLLOWUP_TEMPLATE
} from '../types/index.ts';
import { formatJerryCollaborationEmail, formatEmailSubject, buildGmailComposeUrl } from '../utils/scraper.ts';

interface SettingsModalProps {
  emailTemplate: EmailTemplate;
  onSaveTemplate: (updated: EmailTemplate) => void;
  followUpTemplate?: FollowUpTemplate;
  onSaveFollowUpTemplate?: (updated: FollowUpTemplate) => void;
  googleSheetConfig?: GoogleSheetSyncConfig;
  onUpdateGoogleSheetConfig?: (updated: GoogleSheetSyncConfig) => void;
  onTriggerGoogleSheetSync?: () => Promise<void>;
  onConnectGoogleSheets?: () => Promise<void>;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  emailTemplate,
  onSaveTemplate,
  followUpTemplate = JERRY_DEFAULT_FOLLOWUP_TEMPLATE,
  onSaveFollowUpTemplate,
  googleSheetConfig,
  onUpdateGoogleSheetConfig,
  onTriggerGoogleSheetSync,
  onConnectGoogleSheets,
  isGoogleConnected = false,
  googleUserEmail = null,
  onClose
}) => {
  // Navigation tabs: 'pitch' | 'followup' | 'sheets'
  const [activeTab, setActiveTab] = useState<'pitch' | 'followup' | 'sheets'>('pitch');

  // Pitch Template State
  const [pitchName, setPitchName] = useState(emailTemplate.name || 'Custom Email Template');
  const [pitchSubject, setPitchSubject] = useState(emailTemplate.subject || JERRY_GUEST_POST_TEMPLATE.subject);
  const [pitchBody, setPitchBody] = useState(emailTemplate.body || JERRY_GUEST_POST_TEMPLATE.body);

  // Follow-up Template State
  const [followUpName, setFollowUpName] = useState(followUpTemplate.name || JERRY_DEFAULT_FOLLOWUP_TEMPLATE.name);
  const [followUpSubject, setFollowUpSubject] = useState(followUpTemplate.subject || JERRY_DEFAULT_FOLLOWUP_TEMPLATE.subject);
  const [followUpBody, setFollowUpBody] = useState(followUpTemplate.body || JERRY_DEFAULT_FOLLOWUP_TEMPLATE.body);
  const [followUpDelayDays, setFollowUpDelayDays] = useState(followUpTemplate.defaultDelayDays || 4);

  // Sheets sync local state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(googleSheetConfig?.autoSyncEnabled ?? true);
  const [customSheetId, setCustomSheetId] = useState(googleSheetConfig?.spreadsheetUrl || googleSheetConfig?.spreadsheetId || '');
  const [customSheetName, setCustomSheetName] = useState(googleSheetConfig?.sheetName || 'Leads');

  const [showPreview, setShowPreview] = useState(true);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSyncSheets = async () => {
    if (!onTriggerGoogleSheetSync) return;
    try {
      setIsSyncing(true);
      setSyncFeedback(null);
      await onTriggerGoogleSheetSync();
      setSyncFeedback('Leads successfully synced with Google Sheets!');
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback(err?.message || 'Failed to sync with Google Sheet');
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sample lead data for realistic live preview
  const sampleLead = {
    websiteName: 'MedHealth Daily',
    url: 'https://medhealthdaily.org/articles/wellness',
    email: 'editorial@medhealthdaily.org',
    domain: 'medhealthdaily.org'
  };

  const currentSubject = activeTab === 'followup' ? followUpSubject : pitchSubject;
  const currentBody = activeTab === 'followup' ? followUpBody : pitchBody;

  const previewSubject = formatEmailSubject(
    currentSubject,
    sampleLead.websiteName,
    sampleLead.url,
    sampleLead.email
  );

  const previewBody = formatJerryCollaborationEmail(
    sampleLead.websiteName,
    sampleLead.url,
    currentBody,
    sampleLead.email
  );

  const handleInsertVariable = (variableStr: string) => {
    if (activeTab === 'followup') {
      setFollowUpBody(prev => prev + (prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' ') + variableStr);
    } else {
      setPitchBody(prev => prev + (prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' ') + variableStr);
    }
  };

  const handleApplyPreset = (preset: EmailTemplate) => {
    setPitchName(preset.name);
    setPitchSubject(preset.subject);
    setPitchBody(preset.body);
  };

  const handleResetToJerryDefault = () => {
    if (activeTab === 'followup') {
      setFollowUpName(JERRY_DEFAULT_FOLLOWUP_TEMPLATE.name);
      setFollowUpSubject(JERRY_DEFAULT_FOLLOWUP_TEMPLATE.subject);
      setFollowUpBody(JERRY_DEFAULT_FOLLOWUP_TEMPLATE.body);
      setFollowUpDelayDays(JERRY_DEFAULT_FOLLOWUP_TEMPLATE.defaultDelayDays || 4);
    } else {
      setPitchName(JERRY_GUEST_POST_TEMPLATE.name);
      setPitchSubject(JERRY_GUEST_POST_TEMPLATE.subject);
      setPitchBody(JERRY_GUEST_POST_TEMPLATE.body);
    }
  };

  const handleTestInGmail = () => {
    const testUrl = buildGmailComposeUrl(
      sampleLead.email,
      sampleLead.websiteName,
      sampleLead.url,
      currentSubject,
      currentBody
    );
    window.open(testUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSave = () => {
    // Save pitch template
    onSaveTemplate({
      id: emailTemplate.id || 'custom_email_template',
      name: pitchName.trim() || 'Custom Email Template',
      subject: pitchSubject.trim(),
      body: pitchBody.trim()
    });

    // Save follow-up template if handler exists
    if (onSaveFollowUpTemplate) {
      onSaveFollowUpTemplate({
        id: followUpTemplate.id || 'custom_followup_template',
        name: followUpName.trim() || 'Custom Follow-up Template',
        subject: followUpSubject.trim(),
        body: followUpBody.trim(),
        defaultDelayDays: followUpDelayDays
      });
    }

    // Save Google Sheets config if handler exists
    if (onUpdateGoogleSheetConfig) {
      const raw = customSheetId.trim();
      let extractedId = raw;
      const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        extractedId = match[1];
      }
      const existingConfig: GoogleSheetSyncConfig = googleSheetConfig || {
        spreadsheetId: '',
        spreadsheetUrl: '',
        spreadsheetTitle: 'LeadScrape Pro - Live CRM Leads',
        sheetName: 'Leads',
        autoSyncEnabled: true,
        syncStatus: 'idle'
      };

      onUpdateGoogleSheetConfig({
        ...existingConfig,
        autoSyncEnabled,
        sheetName: customSheetName.trim() || 'Leads',
        spreadsheetId: extractedId,
        spreadsheetUrl: extractedId
          ? (raw.startsWith('http') ? raw : `https://docs.google.com/spreadsheets/d/${extractedId}/edit`)
          : ''
      });
    }

    setIsSavedFeedback(true);
    setTimeout(() => {
      setIsSavedFeedback(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Outreach & Sync Settings
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-semibold border border-sky-300 dark:border-sky-800">
                  Gmail & Google Sheets
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your cold outreach pitch, quick follow-up sequence, and live Google Sheets auto-sync.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pitch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'pitch'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>1. Initial Pitch Template</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('followup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'followup'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>2. Quick Follow-Up Template</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>3. Google Sheets Auto-Sync</span>
            {isGoogleConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            )}
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: Initial Pitch Template */}
          {activeTab === 'pitch' && (
            <div className="space-y-4">
              {/* Presets */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-500" />
                    Initial Pitch Presets
                  </label>
                  <button
                    onClick={handleResetToJerryDefault}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Jerry Default
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {PRESET_EMAIL_TEMPLATES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="p-2 rounded-lg text-left border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 bg-white dark:bg-slate-800/80 transition-all text-xs cursor-pointer"
                    >
                      <div className="font-bold text-slate-900 dark:text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.subject}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Initial Email Subject:
                </label>
                <input
                  type="text"
                  value={pitchSubject}
                  onChange={e => setPitchSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Dynamic Tag Chips */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Insert Personalization Variable (click to add to body):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('[Site Name and hyperlink to website]')}
                    className="px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-mono hover:bg-sky-100 cursor-pointer"
                  >
                    + [Site Name and hyperlink to website]
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('{{website}}')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                  >
                    + &#123;&#123;website&#125;&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('{{url}}')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                  >
                    + &#123;&#123;url&#125;&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('{{domain}}')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                  >
                    + &#123;&#123;domain&#125;&#125;
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Initial Email Body Template:
                </label>
                <textarea
                  rows={9}
                  value={pitchBody}
                  onChange={e => setPitchBody(e.target.value)}
                  className="w-full p-3 font-sans text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Quick Follow-up Template */}
          {activeTab === 'followup' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Quick Follow-up Rules & Interval
                  </span>
                  <button
                    onClick={handleResetToJerryDefault}
                    className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Follow-up Default
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  This template powers the <strong>Quick Follow-up</strong> button on outreached leads and the bulk follow-up sequencer.
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Default follow-up bump schedule:</span>
                  <select
                    value={followUpDelayDays}
                    onChange={e => setFollowUpDelayDays(Number(e.target.value))}
                    className="py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-300 focus:outline-none"
                  >
                    <option value={2}>2 Days after initial pitch</option>
                    <option value={3}>3 Days after initial pitch</option>
                    <option value={4}>4 Days after initial pitch (Recommended)</option>
                    <option value={7}>7 Days after initial pitch</option>
                  </select>
                </div>
              </div>

              {/* Follow-up Subject */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Follow-up Email Subject:
                </label>
                <input
                  type="text"
                  value={followUpSubject}
                  onChange={e => setFollowUpSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Dynamic Tag Chips */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Insert Variable into Follow-up Body:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('[Site Name and hyperlink to website]')}
                    className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-mono hover:bg-amber-100 cursor-pointer"
                  >
                    + [Site Name and hyperlink to website]
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('{{website}}')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                  >
                    + &#123;&#123;website&#125;&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable('{{domain}}')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                  >
                    + &#123;&#123;domain&#125;&#125;
                  </button>
                </div>
              </div>

              {/* Follow-up Body */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Follow-up Email Body Template:
                </label>
                <textarea
                  rows={9}
                  value={followUpBody}
                  onChange={e => setFollowUpBody(e.target.value)}
                  className="w-full p-3 font-sans text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Google Sheets Auto-Sync */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Google Sheets Live Auto-Sync
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isGoogleConnected
                          ? `Connected as ${googleUserEmail || 'Google User'}`
                          : 'Connect your Google account to auto-upload captured leads simultaneously'}
                      </p>
                    </div>
                  </div>

                  {!isGoogleConnected && onConnectGoogleSheets && (
                    <button
                      type="button"
                      onClick={onConnectGoogleSheets}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>

                {isGoogleConnected && (
                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 space-y-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSyncEnabled}
                        onChange={e => setAutoSyncEnabled(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <span>Auto-sync all scraped and saved leads simultaneously to Google Sheets</span>
                    </label>

                    {googleSheetConfig?.spreadsheetId && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">Connected Spreadsheet:</span>
                          <a
                            href={googleSheetConfig.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <span>Open in Google Sheets</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono break-all">
                          ID: {googleSheetConfig.spreadsheetId}
                        </div>
                        {googleSheetConfig.lastSyncedAt && (
                          <div className="text-[10px] text-slate-400">
                            Last synced: {new Date(googleSheetConfig.lastSyncedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={handleManualSyncSheets}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing to Sheet...' : 'Sync Now to Google Sheet'}</span>
                      </button>
                    </div>

                    {syncFeedback && (
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{syncFeedback}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Preview Accordion (for pitch or followup) */}
          {(activeTab === 'pitch' || activeTab === 'followup') && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-500" />
                  Live Personalized Preview ({activeTab === 'followup' ? 'Follow-up' : 'Initial Pitch'} with {sampleLead.websiteName})
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </span>
              </button>

              {showPreview && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Subject: </span>
                    <span className="font-bold text-slate-900 dark:text-white">{previewSubject}</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                    {previewBody}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Simulated recipient: {sampleLead.email}
                    </span>
                    <button
                      type="button"
                      onClick={handleTestInGmail}
                      className="px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/60 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-red-500" />
                      <span>Test in Gmail Compose</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSavedFeedback ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
