import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Chrome,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowRight,
  ShieldCheck,
  Zap,
  Check,
  Download,
  Info,
  Link,
  PlusCircle,
  LogOut,
  Sliders,
  Table,
  Sparkles
} from 'lucide-react';
import type { Lead, GoogleSheetSyncConfig } from '../types/index.ts';
import { extractSpreadsheetId } from '../services/googleSheets.ts';
import { generateLeadsCsv, downloadCsvFile } from '../utils/csv.ts';

interface SyncCenterModalProps {
  leads: Lead[];
  googleSheetConfig: GoogleSheetSyncConfig;
  isGoogleConnected: boolean;
  googleUserEmail?: string | null;
  onConnectGoogleSheets: () => Promise<void>;
  onTriggerGoogleSheetSync: () => Promise<void>;
  onFetchFromGoogleSheet: () => Promise<void>;
  onUpdateGoogleSheetConfig: (cfg: GoogleSheetSyncConfig) => void;
  isExtensionDetected: boolean;
  extensionLeadsCount: number;
  onSyncWithExtension: () => void;
  onDownloadExtension: () => void;
  onClose: () => void;
}

export const SyncCenterModal: React.FC<SyncCenterModalProps> = ({
  leads,
  googleSheetConfig,
  isGoogleConnected,
  googleUserEmail,
  onConnectGoogleSheets,
  onTriggerGoogleSheetSync,
  onFetchFromGoogleSheet,
  onUpdateGoogleSheetConfig,
  isExtensionDetected,
  extensionLeadsCount,
  onSyncWithExtension,
  onDownloadExtension,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'sheets' | 'extension'>('sheets');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editable Spreadsheet inputs
  const [inputUrl, setInputUrl] = useState(
    googleSheetConfig.spreadsheetUrl || googleSheetConfig.spreadsheetId || ''
  );
  const [inputSheetName, setInputSheetName] = useState(googleSheetConfig.sheetName || 'Leads');
  const [isSavedSettings, setIsSavedSettings] = useState(false);

  const handleSaveSheetConfig = () => {
    const cleanId = extractSpreadsheetId(inputUrl);
    const fullUrl = cleanId
      ? `https://docs.google.com/spreadsheets/d/${cleanId}/edit`
      : '';

    const updated: GoogleSheetSyncConfig = {
      ...googleSheetConfig,
      spreadsheetId: cleanId,
      spreadsheetUrl: fullUrl,
      sheetName: inputSheetName.trim() || 'Leads',
      syncStatus: cleanId ? 'synced' : 'idle'
    };

    onUpdateGoogleSheetConfig(updated);
    setIsSavedSettings(true);
    setTimeout(() => setIsSavedSettings(false), 2500);
    setSyncFeedback({
      type: 'success',
      message: 'Google Sheet configuration updated successfully!'
    });
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handlePush = async () => {
    setIsPushing(true);
    setSyncFeedback(null);
    try {
      await onTriggerGoogleSheetSync();
      setSyncFeedback({
        type: 'success',
        message: `Successfully synchronized ${leads.length} leads with Google Sheets!`
      });
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Push failed: ${err?.message || 'Check connection or sheet permissions'}`
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setSyncFeedback(null);
    try {
      await onFetchFromGoogleSheet();
      setSyncFeedback({
        type: 'success',
        message: 'Successfully pulled and updated leads from Google Sheets!'
      });
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Pull failed: ${err?.message || 'Check connection or sheet permissions'}`
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setSyncFeedback(null);
    try {
      await onConnectGoogleSheets();
      setSyncFeedback({
        type: 'success',
        message: 'Connected with Google Account! Live sync active.'
      });
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Connection failed: ${err?.message || 'Popup blocked or cancelled'}. You can paste your Sheet URL below instead!`
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDownloadSheetCsv = () => {
    const csv = generateLeadsCsv(leads);
    downloadCsvFile(csv, `leads-google-sheets-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const activeSpreadsheetUrl =
    googleSheetConfig.spreadsheetUrl ||
    (googleSheetConfig.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${googleSheetConfig.spreadsheetId}/edit`
      : '');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Google Sheets & Extension Sync Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Live Cloud Mirror
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synchronize captured leads in real time between this CRM dashboard and Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Google Sheets Sync</span>
            {isGoogleConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extension')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'extension'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Chrome className="w-4 h-4 text-sky-500" />
            <span>Chrome Extension Bridge</span>
            {isExtensionDetected && (
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Sync Feedback Alert */}
        {syncFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              syncFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span className="flex-1">{syncFeedback.message}</span>
          </div>
        )}

        {/* TAB 1: GOOGLE SHEETS SYNC */}
        {activeTab === 'sheets' && (
          <div className="space-y-4">
            {/* Account & Connection Bar */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Google Account Connection</span>
                      {isGoogleConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Authenticated
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Not Authenticated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isGoogleConnected && googleUserEmail ? (
                        <span>
                          Account: <strong className="text-slate-700 dark:text-slate-300">{googleUserEmail}</strong>
                        </span>
                      ) : (
                        <span>Connect Google account to create and write spreadsheets directly via API</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleConnect}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isGoogleConnected ? 'Reconnect Google Account' : 'Connect Google Account'}</span>
                </button>
              </div>
            </div>

            {/* Target Google Sheet Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-emerald-500" />
                  Target Spreadsheet Configuration
                </span>
                {activeSpreadsheetUrl && (
                  <a
                    href={activeSpreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Google Spreadsheet URL or Sheet ID:
                  </label>
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit or Sheet ID"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Sheet Tab Name:
                  </label>
                  <input
                    type="text"
                    value={inputSheetName}
                    onChange={(e) => setInputSheetName(e.target.value)}
                    placeholder="Leads"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSaveSheetConfig}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSavedSettings ? 'Saved!' : 'Save Sheet Link'}</span>
                </button>

                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create blank sheet (sheets.new)</span>
                </a>
              </div>
            </div>

            {/* Sync Action Controls */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
                  Cloud Synchronization Controls
                </span>
                {googleSheetConfig.lastSyncedAt && (
                  <span className="text-[11px] text-slate-500">
                    Last synced: {new Date(googleSheetConfig.lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={googleSheetConfig.autoSyncEnabled}
                    onChange={(e) =>
                      onUpdateGoogleSheetConfig({
                        ...googleSheetConfig,
                        autoSyncEnabled: e.target.checked
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Auto-sync simultaneously on all scrapings and CRM edits
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPushing}
                  onClick={handlePush}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                  <span>{isPushing ? 'Pushing to Sheet...' : `Push All (${leads.length} Leads) to Sheet`}</span>
                </button>

                <button
                  type="button"
                  disabled={isPulling}
                  onClick={handlePull}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-500 rotate-180" />
                  <span>{isPulling ? 'Pulling from Sheet...' : 'Pull & Merge from Google Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSheetCsv}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download CSV formatted identically to Google Sheets schema"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download GSheet CSV</span>
                </button>
              </div>
            </div>

            {/* Column Schema Mapping Preview */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-emerald-500" />
                Google Sheet Synced Column Schema (12 Columns):
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  'Lead ID',
                  'Email',
                  'Website Name',
                  'Domain',
                  'Source URL',
                  'Status',
                  'Outreached At',
                  'Follow-up Date',
                  'Sequence Step',
                  'Tags',
                  'Notes',
                  'Discovered At'
                ].map((col, idx) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono text-[10px]"
                  >
                    {idx + 1}. {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHROME EXTENSION SYNC BRIDGE */}
        {activeTab === 'extension' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Chrome className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Chrome Extension In-Memory Bridge</span>
                      {isExtensionDetected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Detected ({extensionLeadsCount} leads in ext)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Not Loaded in this tab
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isExtensionDetected
                        ? 'The LeadScrape Pro extension is active and communicating in real-time with this tab.'
                        : 'Download the extension ZIP below, unzip it, and load it into chrome://extensions.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isExtensionDetected ? (
                    <button
                      type="button"
                      onClick={onSyncWithExtension}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Leads Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onDownloadExtension}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Extension (.zip)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-slate-600 dark:text-slate-300">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-500" />
                How to Install & Enable Auto-Syncing:
              </div>
              <ol className="list-decimal pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                <li>Click <strong>Download Extension (.zip)</strong> and extract the files to a folder on your computer.</li>
                <li>Open Google Chrome, navigate to <code>chrome://extensions</code>, and turn ON <strong>Developer mode</strong> (top right).</li>
                <li>Click <strong>Load unpacked</strong> and select the unzipped extension directory.</li>
                <li>Whenever you visit websites, LeadScrape Pro automatically highlights emails, grabs outbound links, and syncs newly discovered leads!</li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Leads in CRM: <strong className="text-slate-900 dark:text-white">{leads.length}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Close Sync Hub
          </button>
        </div>
      </div>
    </div>
  );
};
