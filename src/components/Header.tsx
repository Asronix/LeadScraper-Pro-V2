import React from 'react';
import {
  Download,
  Moon,
  Sun,
  Bell,
  ShieldCheck,
  Chrome,
  Globe2,
  TableProperties,
  Plus,
  FileSpreadsheet,
  Upload,
  ShieldAlert,
  Settings,
  RefreshCw
} from 'lucide-react';

interface HeaderProps {
  currentTab: 'dashboard' | 'simulator' | 'privacy';
  setCurrentTab: (tab: 'dashboard' | 'simulator' | 'privacy') => void;
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  pendingRemindersCount: number;
  onOpenReminders: () => void;
  onOpenDownloadExtension: () => void;
  onExportCsv: () => void;
  onAddNewLead: () => void;
  onOpenCsvImport: () => void;
  onOpenExcludedSites: () => void;
  onOpenSettings: () => void;
  totalLeadsCount: number;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  onConnectGoogleSheets?: () => void;
  googleSheetUrl?: string;
  isExtensionDetected?: boolean;
  onOpenSyncHub?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  darkMode,
  setDarkMode,
  pendingRemindersCount,
  onOpenReminders,
  onOpenDownloadExtension,
  onExportCsv,
  onAddNewLead,
  onOpenCsvImport,
  onOpenExcludedSites,
  onOpenSettings,
  totalLeadsCount,
  isGoogleConnected,
  googleUserEmail,
  onConnectGoogleSheets,
  googleSheetUrl,
  isExtensionDetected,
  onOpenSyncHub
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Extension Status */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 focus:outline-none group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Chrome className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                    LeadScrape <span className="text-sky-500">Pro</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-300/60 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Ext Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Automated Email Scraper & Prospect CRM
                </p>
              </div>
            </button>

            {/* Navigation Tabs (Desktop) */}
            <nav className="hidden md:flex items-center ml-6 pl-6 border-l border-slate-200 dark:border-slate-800 space-x-1">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentTab === 'dashboard'
                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <TableProperties className="w-4 h-4" />
                Leads CRM
                <span className="ml-1 text-xs px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {totalLeadsCount}
                </span>
              </button>

              <button
                onClick={() => setCurrentTab('simulator')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentTab === 'simulator'
                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Globe2 className="w-4 h-4" />
                Live Page Scanner
              </button>

              <button
                onClick={() => setCurrentTab('privacy')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentTab === 'privacy'
                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Privacy & Sync
              </button>
            </nav>
          </div>

          {/* Quick Actions Right Side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Add Lead Button */}
            <button
              onClick={onAddNewLead}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>

            {/* Import CSV Button */}
            <button
              onClick={onOpenCsvImport}
              title="Import leads from CSV"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>

            {/* Excluded Sites Button */}
            <button
              onClick={onOpenExcludedSites}
              title="Manage Excluded Sites"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            </button>

            {/* Live Auto-Sync Hub Button */}
            {onOpenSyncHub && (
              <button
                type="button"
                onClick={onOpenSyncHub}
                title="Open Live Auto-Sync Hub (Google Sheets & Chrome Extension)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-700 hover:to-sky-700 text-white shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Sync Hub</span>
                {isGoogleConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                )}
              </button>
            )}

            {/* Google Sheets Live Sync Indicator / Connect Button */}
            {isGoogleConnected ? (
              <a
                href={googleSheetUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                title={`Google Sheets Auto-Sync Active (${googleUserEmail || 'Google User'})`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors no-underline cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Sheets</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </a>
            ) : (
              onConnectGoogleSheets && (
                <button
                  type="button"
                  onClick={onConnectGoogleSheets}
                  title="Connect Google Sheets to auto-upload leads"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden md:inline">Connect Sheets</span>
                </button>
              )
            )}

            {/* Export CSV Button */}
            <button
              onClick={onExportCsv}
              title="Export all leads to CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Download Extension ZIP */}
            <button
              onClick={onOpenDownloadExtension}
              title="Download Chrome Extension (.zip)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Get Extension</span>
            </button>

            {/* Follow-up Reminder Bell */}
            <button
              onClick={onOpenReminders}
              title="Follow-up Reminders"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {pendingRemindersCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {pendingRemindersCount}
                </span>
              )}
            </button>

            {/* Email & Outreach Template Settings Button */}
            <button
              onClick={onOpenSettings}
              title="Outreach Email Template Settings"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-5 h-5 text-sky-500 hover:rotate-45 transition-transform" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(prev => !prev)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`py-1 px-3 rounded-md flex items-center gap-1 ${
              currentTab === 'dashboard'
                ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            CRM ({totalLeadsCount})
          </button>
          <button
            onClick={() => setCurrentTab('simulator')}
            className={`py-1 px-3 rounded-md flex items-center gap-1 ${
              currentTab === 'simulator'
                ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            Scanner
          </button>
          <button
            onClick={() => setCurrentTab('privacy')}
            className={`py-1 px-3 rounded-md flex items-center gap-1 ${
              currentTab === 'privacy'
                ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Privacy
          </button>
        </div>
      </div>
    </header>
  );
};
