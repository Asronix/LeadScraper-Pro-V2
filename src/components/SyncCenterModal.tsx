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
  Info
} from 'lucide-react';
import type { Lead, GoogleSheetSyncConfig } from '../types/index.ts';

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
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handlePush = async () => {
    setIsPushing(true);
    setSyncFeedback(null);
    try {
      await onTriggerGoogleSheetSync();
      setSyncFeedback('Successfully pushed leads to Google Sheets spreadsheet!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      setSyncFeedback(`Sync failed: ${err?.message || 'Check connection'}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setSyncFeedback(null);
    try {
      await onFetchFromGoogleSheet();
      setSyncFeedback('Successfully pulled and merged leads from Google Sheets!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: any) {
      setSyncFeedback(`Pull failed: ${err?.message || 'Check connection'}`);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Live Auto-Sync Hub
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Real-time Mirror
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How automatic data synchronization works between Extension, Dashboard, and Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1"
          >
            &times;
          </button>
        </div>

        {/* Sync Feedback Alert */}
        {syncFeedback && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* How Syncing Works Infographic Cards */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            How Automatic Synchronization Works
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1 */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Chrome className="w-3.5 h-3.5 text-sky-500" />
                Browser Capture
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                As you browse sites, the Chrome Extension scans pages in real time, filters spam traps, and highlights verified emails in yellow.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-500" />
                Live Browser Bridge
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                The extension syncs newly captured leads directly into this dashboard via an in-memory postMessage bridge whenever this tab is open.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                Simultaneous GSheet Mirror
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Every newly scraped or edited lead is simultaneously uploaded to your Google Sheet spreadsheet so your team always has real-time access.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Google Sheets Auto-Sync */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Google Sheets Spreadsheet Sync</span>
                  {isGoogleConnected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Not Connected
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isGoogleConnected && googleUserEmail ? (
                    <span>Logged in as: <strong className="text-slate-700 dark:text-slate-300">{googleUserEmail}</strong></span>
                  ) : (
                    <span>Connect your Google account to enable 1-click cloud sync</span>
                  )}
                </div>
              </div>
            </div>

            {/* Connect / Disconnect Button */}
            {!isGoogleConnected ? (
              <button
                type="button"
                onClick={onConnectGoogleSheets}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Connect Google Account
              </button>
            ) : (
              googleSheetConfig.spreadsheetUrl && (
                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-emerald-500 inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Open Spreadsheet</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )
            )}
          </div>

          {isGoogleConnected && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={googleSheetConfig.autoSyncEnabled}
                    onChange={(e) => onUpdateGoogleSheetConfig({ ...googleSheetConfig, autoSyncEnabled: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Auto-sync simultaneously on all scrapings and lead edits
                  </span>
                </label>
                {googleSheetConfig.lastSyncedAt && (
                  <span className="text-[11px] text-slate-400">
                    Last sync: {new Date(googleSheetConfig.lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPushing}
                  onClick={handlePush}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                  <span>{isPushing ? 'Pushing to Sheet...' : `Push All (${leads.length} Leads) to Sheet`}</span>
                </button>

                <button
                  type="button"
                  disabled={isPulling}
                  onClick={handlePull}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-500 rotate-180" />
                  <span>{isPulling ? 'Pulling from Sheet...' : 'Pull & Merge from Google Sheet'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Chrome Extension Sync Bridge */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                <Chrome className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Chrome Extension Sync Bridge</span>
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

          <div className="text-[11px] bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1 text-slate-600 dark:text-slate-300">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-500" />
              How to Install & Enable Auto-Syncing:
            </div>
            <ol className="list-decimal pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
              <li>Click <strong>Download Extension (.zip)</strong> and unzip the archive on your computer.</li>
              <li>Go to <code>chrome://extensions</code> in Chrome and toggle <strong>Developer mode</strong> (top right).</li>
              <li>Click <strong>Load unpacked</strong> and select the unzipped folder.</li>
              <li>Whenever you browse pages with emails, LeadScrape Pro auto-collects them and auto-syncs with this dashboard and your Google Sheet!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
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
