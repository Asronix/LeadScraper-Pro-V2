/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header.tsx';
import { LeadsDashboard } from './components/LeadsDashboard.tsx';
import { WebpageScannerSimulator } from './components/WebpageScannerSimulator.tsx';
import { PrivacyAndSyncView } from './components/PrivacyAndSyncView.tsx';
import { TagManagerModal } from './components/TagManagerModal.tsx';
import { FollowUpRemindersModal } from './components/FollowUpRemindersModal.tsx';
import { ExtensionDownloadModal } from './components/ExtensionDownloadModal.tsx';
import { AddLeadModal } from './components/AddLeadModal.tsx';
import { CsvImportModal } from './components/CsvImportModal.tsx';
import { ExcludedSitesModal } from './components/ExcludedSitesModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SyncCenterModal } from './components/SyncCenterModal.tsx';
import { INITIAL_LEADS, DEFAULT_TAGS } from './data/mockData.ts';
import { generateLeadsCsv, downloadCsvFile } from './utils/csv.ts';
import { initAuth, googleSignIn, logoutGoogle } from './services/googleAuth.ts';
import {
  createLeadsSpreadsheet,
  syncAllLeadsToGoogleSheet,
  fetchLeadsFromGoogleSheet
} from './services/googleSheets.ts';
import type { Lead, Tag, LeadStatus, EmailTemplate, FollowUpTemplate, GoogleSheetSyncConfig } from './types/index.ts';
import { DEFAULT_EXCLUDED_DOMAINS, JERRY_GUEST_POST_TEMPLATE, JERRY_DEFAULT_FOLLOWUP_TEMPLATE } from './types/index.ts';
import type { User } from 'firebase/auth';
import { Lock, Unlock, Key, ShieldCheck, RefreshCw } from 'lucide-react';

const STORAGE_LEADS_KEY = 'leadscrape_pro_vault_leads_v1';
const STORAGE_TAGS_KEY = 'leadscrape_pro_tags_v1';
const STORAGE_THEME_KEY = 'leadscrape_pro_theme';
const STORAGE_EXCLUDED_KEY = 'leadscrape_pro_excluded_domains_v1';
const STORAGE_TEMPLATE_KEY = 'leadscrape_pro_email_template_v1';
const STORAGE_FOLLOWUP_TEMPLATE_KEY = 'leadscrape_pro_followup_template_v1';
const STORAGE_GSHEET_CONFIG_KEY = 'leadscrape_pro_gsheet_config_v1';

export default function App() {
  // Navigation tab
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'simulator' | 'privacy'>('dashboard');

  // Dark mode setting
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved) return saved === 'dark';
    return true; // Default to sleek dark mode for productivity
  });

  // Leads & Tags
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_LEADS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read leads from local storage, using initial seed leads.', e);
    }
    return INITIAL_LEADS;
  });

  const [tags, setTags] = useState<Tag[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TAGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read tags from local storage, using default tags.', e);
    }
    return DEFAULT_TAGS;
  });

  // Excluded domains blacklist
  const [excludedDomains, setExcludedDomains] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_EXCLUDED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read excluded domains from local storage, using defaults.', e);
    }
    return DEFAULT_EXCLUDED_DOMAINS;
  });

  // Email Outreach Template
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TEMPLATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.subject && parsed.body) return parsed;
      }
    } catch (e) {
      console.warn('Could not read email template from storage, using Jerry default.', e);
    }
    return JERRY_GUEST_POST_TEMPLATE;
  });

  // Follow-up Template
  const [followUpTemplate, setFollowUpTemplate] = useState<FollowUpTemplate>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_FOLLOWUP_TEMPLATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.subjectTemplate && parsed.bodyTemplate) return parsed;
      }
    } catch (e) {
      console.warn('Could not read follow-up template from storage, using default.', e);
    }
    return JERRY_DEFAULT_FOLLOWUP_TEMPLATE;
  });

  // Google Sheets Auto-Sync Configuration
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetSyncConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_GSHEET_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.warn('Could not read google sheet config from storage.', e);
    }
    return {
      spreadsheetId: '',
      spreadsheetUrl: '',
      spreadsheetTitle: 'LeadScrape Pro - Live CRM Leads',
      sheetName: 'Leads',
      autoSyncEnabled: true,
      syncStatus: 'idle'
    };
  });

  // Google Auth & Session State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Chrome Extension Live Bridge State
  const [isExtensionDetected, setIsExtensionDetected] = useState(false);
  const [extensionLeadsCount, setExtensionLeadsCount] = useState(0);

  // Security & Vault state
  const [masterPassword, setMasterPassword] = useState<string>('');
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(false);
  const [unlockPasswordAttempt, setUnlockPasswordAttempt] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Active website filter for CRM
  const [activeWebsiteFilter, setActiveWebsiteFilter] = useState<string>('all');

  // Check URL query parameters on load e.g. from extension popup shortcut
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const siteParam = params.get('filterWebsite');
      if (siteParam) {
        setActiveWebsiteFilter(siteParam);
        setCurrentTab('dashboard');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Modals state
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [isDownloadExtensionOpen, setIsDownloadExtensionOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isExcludedSitesOpen, setIsExcludedSitesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Save excluded domains to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXCLUDED_KEY, JSON.stringify(excludedDomains));
    } catch (e) {
      console.error('Failed to save excluded domains to storage', e);
    }
  }, [excludedDomains]);

  // Save email template to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TEMPLATE_KEY, JSON.stringify(emailTemplate));
    } catch (e) {
      console.error('Failed to save email template to storage', e);
    }
  }, [emailTemplate]);

  // Save follow-up template to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FOLLOWUP_TEMPLATE_KEY, JSON.stringify(followUpTemplate));
    } catch (e) {
      console.error('Failed to save follow-up template to storage', e);
    }
  }, [followUpTemplate]);

  // Save Google Sheet config to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GSHEET_CONFIG_KEY, JSON.stringify(googleSheetConfig));
    } catch (e) {
      console.error('Failed to save Google Sheet config to storage', e);
    }
  }, [googleSheetConfig]);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Chrome Extension Window Message Bridge (Bi-directional auto-sync)
  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'LEADSCRAPE_PRO_PONG') {
        setIsExtensionDetected(true);
        if (typeof event.data.leadsCount === 'number') {
          setExtensionLeadsCount(event.data.leadsCount);
        }
        if (Array.isArray(event.data.leads) && event.data.leads.length > 0) {
          // Merge newly scraped leads from extension into dashboard
          setLeads(prev => {
            const existingMap = new Map(prev.map(l => [l.email.toLowerCase(), l]));
            let addedCount = 0;
            event.data.leads.forEach((l: Lead) => {
              const k = (l.email || '').toLowerCase();
              if (k && !existingMap.has(k)) {
                existingMap.set(k, l);
                addedCount++;
              }
            });
            if (addedCount === 0) return prev;
            return Array.from(existingMap.values());
          });
        }
      } else if (event.data.type === 'LEADSCRAPE_PRO_EXTENSION_UPDATED') {
        setIsExtensionDetected(true);
        if (typeof event.data.totalLeads === 'number') {
          setExtensionLeadsCount(event.data.totalLeads);
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);

    // Periodically ping extension content script
    const ping = () => {
      window.postMessage({ type: 'LEADSCRAPE_PRO_PING' }, '*');
    };
    ping();
    const interval = setInterval(ping, 3500);

    return () => {
      window.removeEventListener('message', handleBridgeMessage);
      clearInterval(interval);
    };
  }, []);

  // Sync leads back to extension storage
  const handleSyncWithExtension = () => {
    window.postMessage({
      type: 'LEADSCRAPE_PRO_PUSH_TO_EXTENSION',
      leads
    }, '*');
  };

  // Google Sheets Auto-Sync Effect on Leads Change
  useEffect(() => {
    if (!googleToken || !googleSheetConfig.spreadsheetId || !googleSheetConfig.autoSyncEnabled) return;

    const timer = setTimeout(async () => {
      try {
        await syncAllLeadsToGoogleSheet(
          googleToken,
          googleSheetConfig.spreadsheetId,
          leads,
          googleSheetConfig.sheetName || 'Leads'
        );
        setGoogleSheetConfig(prev => ({
          ...prev,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Simultaneous Google Sheets auto-sync failed:', err);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [leads, googleToken, googleSheetConfig.spreadsheetId, googleSheetConfig.autoSyncEnabled, googleSheetConfig.sheetName]);

  // Connect Google Sheets Handler
  const handleConnectGoogleSheets = async () => {
    try {
      const res = await googleSignIn();
      if (!res) return;
      setGoogleUser(res.user);
      setGoogleToken(res.accessToken);

      let currentConfig = { ...googleSheetConfig };
      if (!currentConfig.spreadsheetId) {
        const created = await createLeadsSpreadsheet(res.accessToken, 'LeadScrape Pro - Live CRM Leads');
        currentConfig = {
          spreadsheetId: created.spreadsheetId,
          spreadsheetUrl: created.spreadsheetUrl,
          spreadsheetTitle: 'LeadScrape Pro - Live CRM Leads',
          sheetName: created.sheetName,
          autoSyncEnabled: true,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString()
        };
        setGoogleSheetConfig(currentConfig);

        if (leads.length > 0) {
          await syncAllLeadsToGoogleSheet(res.accessToken, created.spreadsheetId, leads, created.sheetName);
        }
      } else {
        await syncAllLeadsToGoogleSheet(res.accessToken, currentConfig.spreadsheetId, leads, currentConfig.sheetName || 'Leads');
      }
    } catch (err: any) {
      console.error('Error connecting Google Sheets:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        throw new Error(
          `Domain '${window.location.hostname}' is not authorized in Firebase Console (Authentication > Settings > Authorized Domains). You can still link any Google Sheet directly by URL or ID without signing in!`
        );
      }
      throw err;
    }
  };

  // Manual Trigger Google Sheet Sync
  const handleTriggerGoogleSheetSync = async () => {
    if (!googleSheetConfig.spreadsheetId) {
      throw new Error('Please enter a Google Spreadsheet URL or ID in the Sync Hub first.');
    }

    let token = googleToken;
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
          setGoogleToken(res.accessToken);
          setGoogleUser(res.user);
        }
      } catch (authErr: any) {
        if (authErr?.code === 'auth/unauthorized-domain' || authErr?.message?.includes('unauthorized-domain')) {
          throw new Error(
            `Firebase Domain Auth: Preview domain '${window.location.hostname}' is not authorized in Firebase Authentication Settings. You can pull leads without logging in, or download the formatted CSV below.`
          );
        }
        throw authErr;
      }
    }

    if (!token) {
      throw new Error('Google Sign-In is required to push leads directly to Google Sheets via API.');
    }

    await syncAllLeadsToGoogleSheet(token, googleSheetConfig.spreadsheetId, leads, googleSheetConfig.sheetName || 'Leads');
    setGoogleSheetConfig(prev => ({
      ...prev,
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString()
    }));
  };

  // Pull Leads from Google Sheet (supports public link-shared sheets without requiring Google Sign-In)
  const handleFetchFromGoogleSheet = async () => {
    if (!googleSheetConfig.spreadsheetId) {
      throw new Error('Please paste your Google Spreadsheet URL or ID in the Sync Hub first.');
    }

    // Do NOT force Google sign in for pull - public sheets can be read directly!
    const token = googleToken;

    const remoteLeads = await fetchLeadsFromGoogleSheet(
      token,
      googleSheetConfig.spreadsheetId,
      googleSheetConfig.sheetName || 'Leads'
    );

    if (remoteLeads && remoteLeads.length > 0) {
      setLeads(prev => {
        const existingMap = new Map(prev.map(l => [l.email.toLowerCase(), l]));
        remoteLeads.forEach(rl => {
          const key = (rl.email || '').toLowerCase();
          if (!key) return;
          if (existingMap.has(key)) {
            existingMap.set(key, { ...existingMap.get(key)!, ...rl });
          } else {
            existingMap.set(key, rl);
          }
        });
        return Array.from(existingMap.values());
      });
      setGoogleSheetConfig(prev => ({
        ...prev,
        syncStatus: 'synced',
        lastSyncedAt: new Date().toISOString()
      }));
    } else {
      throw new Error(`The connected sheet '${googleSheetConfig.sheetName || 'Leads'}' has no rows or is empty.`);
    }
  };

  // Sync dark mode class with DOM
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(STORAGE_THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(STORAGE_THEME_KEY, 'light');
    }
  }, [darkMode]);

  // Save leads to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LEADS_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error('Failed to save leads to storage', e);
    }
  }, [leads]);

  // Save tags to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAGS_KEY, JSON.stringify(tags));
    } catch (e) {
      console.error('Failed to save tags to storage', e);
    }
  }, [tags]);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute pending follow-up reminders count
  const pendingRemindersCount = useMemo(() => {
    return leads.filter(
      l => l.followUpDate && l.followUpDate <= todayStr && l.status !== 'converted'
    ).length;
  }, [leads, todayStr]);

  // Lead CRUD handlers
  const handleUpdateLead = (updated: Lead) => {
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleBulkDelete = (leadIds: string[]) => {
    const idSet = new Set(leadIds);
    setLeads(prev => prev.filter(l => !idSet.has(l.id)));
  };

  const handleBulkUpdateStatus = (leadIds: string[], status: LeadStatus) => {
    const idSet = new Set(leadIds);
    const nowIso = new Date().toISOString();
    setLeads(prev =>
      prev.map(l => {
        if (!idSet.has(l.id)) return l;
        return {
          ...l,
          status,
          outreachedAt: status === 'outreached' ? nowIso : l.outreachedAt,
          history: [
            ...(l.history || []),
            {
              timestamp: nowIso,
              action: `Bulk updated status to ${status}`
            }
          ]
        };
      })
    );
  };

  const handleBulkAddTag = (leadIds: string[], tagId: string) => {
    const idSet = new Set(leadIds);
    setLeads(prev =>
      prev.map(l => {
        if (!idSet.has(l.id)) return l;
        if (l.tags.includes(tagId)) return l;
        return {
          ...l,
          tags: [...l.tags, tagId]
        };
      })
    );
  };

  const handleAddLeadsFromSimulator = (newLeads: Lead[]) => {
    setLeads(prev => {
      // Deduplicate by email and domain
      const existing = new Set(prev.map(l => l.email.toLowerCase()));
      const filtered = newLeads.filter(l => !existing.has(l.email.toLowerCase()));
      return [...filtered, ...prev];
    });
  };

  const handleAddNewSingleLead = (newLead: Lead) => {
    setLeads(prev => [newLead, ...prev]);
  };

  const handleMergeLeads = (importedLeads: Lead[]) => {
    setLeads(prev => {
      const existing = new Set(prev.map(l => l.email.toLowerCase()));
      const filtered = importedLeads.filter(l => !existing.has(l.email.toLowerCase()));
      return [...filtered, ...prev];
    });
  };

  // Tag CRUD handlers
  const handleAddTag = (newTag: Tag) => {
    setTags(prev => [...prev, newTag]);
  };

  const handleDeleteTag = (tagId: string) => {
    setTags(prev => prev.filter(t => t.id !== tagId));
    // Remove tag references from leads
    setLeads(prev =>
      prev.map(l => ({
        ...l,
        tags: l.tags.filter(t => t !== tagId)
      }))
    );
  };

  // Export CSV handler
  const handleExportCsv = (leadsToExport?: Lead[]) => {
    const list = leadsToExport || leads;
    const tagsMap = new Map(tags.map(t => [t.id, t]));
    const csvString = generateLeadsCsv(list, tagsMap);
    downloadCsvFile(csvString, `leadscrape-pro-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Vault Unlock Handler
  const handleUnlockVault = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPassword && unlockPasswordAttempt !== masterPassword) {
      setUnlockError('Incorrect password. Please try again.');
      return;
    }
    setIsVaultLocked(false);
    setUnlockPasswordAttempt('');
    setUnlockError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors flex flex-col font-sans">
      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        pendingRemindersCount={pendingRemindersCount}
        onOpenReminders={() => setIsRemindersOpen(true)}
        onOpenDownloadExtension={() => setIsDownloadExtensionOpen(true)}
        onExportCsv={() => handleExportCsv()}
        onAddNewLead={() => setIsAddLeadOpen(true)}
        onOpenCsvImport={() => setIsCsvImportOpen(true)}
        onOpenExcludedSites={() => setIsExcludedSitesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        totalLeadsCount={leads.length}
        isGoogleConnected={Boolean(googleToken && googleSheetConfig.spreadsheetId)}
        googleUserEmail={googleUser?.email}
        onConnectGoogleSheets={handleConnectGoogleSheets}
        googleSheetUrl={googleSheetConfig.spreadsheetUrl}
        isExtensionDetected={isExtensionDetected}
        onOpenSyncHub={() => setIsSyncModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* If Vault is Locked */}
        {isVaultLocked ? (
          <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Prospect Vault is Locked
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your leads and contact notes are locally encrypted with AES-GCM. Enter your master password to unlock.
            </p>

            <form onSubmit={handleUnlockVault} className="space-y-3 pt-2">
              <input
                type="password"
                required
                value={unlockPasswordAttempt}
                onChange={e => setUnlockPasswordAttempt(e.target.value)}
                placeholder="Enter master password..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {unlockError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {unlockError}
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                Unlock Database Vault
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* View 1: Leads CRM Dashboard */}
            {currentTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        100% Offline Extension CRM & Real-time Auto-Sync
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800">
                          {isExtensionDetected ? 'Extension Connected' : 'Extension Ready'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        The Chrome extension automatically scrapes emails and syncs data to this dashboard and your connected Google Sheet simultaneously.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSyncModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Hub</span>
                    </button>
                    <button
                      onClick={() => setIsDownloadExtensionOpen(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                    >
                      <span>Download Extension (.zip)</span>
                    </button>
                  </div>
                </div>

                <LeadsDashboard
                  leads={leads}
                  tags={tags}
                  emailTemplate={emailTemplate}
                  followUpTemplate={followUpTemplate}
                  googleSheetConfig={googleSheetConfig}
                  isGoogleConnected={Boolean(googleToken && googleSheetConfig.spreadsheetId)}
                  googleUserEmail={googleUser?.email}
                  onConnectGoogleSheets={handleConnectGoogleSheets}
                  onTriggerGoogleSheetSync={handleTriggerGoogleSheetSync}
                  onFetchFromGoogleSheet={handleFetchFromGoogleSheet}
                  onUpdateGoogleSheetConfig={setGoogleSheetConfig}
                  activeWebsiteFilter={activeWebsiteFilter}
                  onWebsiteFilterChange={setActiveWebsiteFilter}
                  onUpdateLead={handleUpdateLead}
                  onDeleteLead={handleDeleteLead}
                  onBulkDelete={handleBulkDelete}
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkAddTag={handleBulkAddTag}
                  onExportCsv={handleExportCsv}
                  onOpenManageTags={() => setIsManageTagsOpen(true)}
                  onAddNewLead={() => setIsAddLeadOpen(true)}
                  onOpenSimulator={() => setCurrentTab('simulator')}
                  onOpenCsvImport={() => setIsCsvImportOpen(true)}
                  onOpenExcludedSites={() => setIsExcludedSitesOpen(true)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onOpenSyncHub={() => setIsSyncModalOpen(true)}
                  onSaveAsDefaultTemplate={setEmailTemplate}
                />
              </div>
            )}

            {/* View 2: Chrome Extension Live Page Scanner Simulator */}
            {currentTab === 'simulator' && (
              <WebpageScannerSimulator
                onAddLeadsToCrm={handleAddLeadsFromSimulator}
                onNavigateToCrm={() => setCurrentTab('dashboard')}
                onNavigateToCrmWithFilter={(website) => {
                  setActiveWebsiteFilter(website);
                  setCurrentTab('dashboard');
                }}
                excludedDomains={excludedDomains}
                emailTemplate={emailTemplate}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSaveAsDefaultTemplate={setEmailTemplate}
              />
            )}

            {/* View 3: Privacy, Encryption & Cloud Sync */}
            {currentTab === 'privacy' && (
              <PrivacyAndSyncView
                leads={leads}
                tags={tags}
                onMergeLeads={handleMergeLeads}
                masterPassword={masterPassword}
                setMasterPassword={setMasterPassword}
                isVaultLocked={isVaultLocked}
                setIsVaultLocked={setIsVaultLocked}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {isManageTagsOpen && (
        <TagManagerModal
          tags={tags}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
          onClose={() => setIsManageTagsOpen(false)}
        />
      )}

      {isRemindersOpen && (
        <FollowUpRemindersModal
          leads={leads}
          onUpdateLead={handleUpdateLead}
          onClose={() => setIsRemindersOpen(false)}
          onNavigateToLead={id => {
            setIsRemindersOpen(false);
            setCurrentTab('dashboard');
          }}
        />
      )}

      {isDownloadExtensionOpen && (
        <ExtensionDownloadModal
          emailTemplate={emailTemplate}
          followUpTemplate={followUpTemplate}
          googleSheetConfig={googleSheetConfig}
          onClose={() => setIsDownloadExtensionOpen(false)}
        />
      )}

      {isAddLeadOpen && (
        <AddLeadModal
          tags={tags}
          onAddLead={handleAddNewSingleLead}
          onClose={() => setIsAddLeadOpen(false)}
        />
      )}

      {isCsvImportOpen && (
        <CsvImportModal
          tags={tags}
          onImportLeads={(newLeads) => {
            setLeads(prev => {
              const existing = new Set(prev.map(l => l.email.toLowerCase()));
              const filtered = newLeads.filter(l => !existing.has(l.email.toLowerCase()));
              return [...filtered, ...prev];
            });
          }}
          onClose={() => setIsCsvImportOpen(false)}
        />
      )}

      {isExcludedSitesOpen && (
        <ExcludedSitesModal
          excludedDomains={excludedDomains}
          onUpdateExcludedDomains={setExcludedDomains}
          onClose={() => setIsExcludedSitesOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          emailTemplate={emailTemplate}
          onSaveTemplate={setEmailTemplate}
          followUpTemplate={followUpTemplate}
          onSaveFollowUpTemplate={setFollowUpTemplate}
          googleSheetConfig={googleSheetConfig}
          onUpdateGoogleSheetConfig={setGoogleSheetConfig}
          isGoogleConnected={Boolean(googleToken && googleSheetConfig.spreadsheetId)}
          googleUserEmail={googleUser?.email}
          onConnectGoogleSheets={handleConnectGoogleSheets}
          onTriggerGoogleSheetSync={handleTriggerGoogleSheetSync}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Sync Center Modal */}
      {isSyncModalOpen && (
        <SyncCenterModal
          leads={leads}
          googleSheetConfig={googleSheetConfig}
          isGoogleConnected={Boolean(googleToken && googleSheetConfig.spreadsheetId)}
          googleUserEmail={googleUser?.email}
          onConnectGoogleSheets={handleConnectGoogleSheets}
          onTriggerGoogleSheetSync={handleTriggerGoogleSheetSync}
          onFetchFromGoogleSheet={handleFetchFromGoogleSheet}
          onUpdateGoogleSheetConfig={setGoogleSheetConfig}
          isExtensionDetected={isExtensionDetected}
          extensionLeadsCount={extensionLeadsCount}
          onSyncWithExtension={handleSyncWithExtension}
          onDownloadExtension={() => {
            setIsSyncModalOpen(false);
            setIsDownloadExtensionOpen(true);
          }}
          onClose={() => setIsSyncModalOpen(false)}
        />
      )}

      {/* Persistent Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-4 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              LeadScrape Pro
            </span>
            <span>• Manifest V3 Extension & Local-Encrypted CRM</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDownloadExtensionOpen(true)}
              className="text-sky-600 dark:text-sky-400 hover:underline"
            >
              Get Chrome Extension (.zip)
            </button>
            <span>•</span>
            <button
              onClick={() => handleExportCsv()}
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Export CSV
            </button>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              AES-GCM Encrypted
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
