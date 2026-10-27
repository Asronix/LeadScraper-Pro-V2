import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Tag as TagIcon,
  Trash2,
  Calendar,
  Copy,
  Check,
  Send,
  Building,
  AlertCircle,
  Plus,
  ArrowUpDown,
  Mail,
  MoreVertical,
  ChevronDown,
  Upload,
  ShieldAlert,
  Settings,
  Zap,
  Layers,
  Edit3,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import type { Lead, Tag, LeadStatus, FilterOptions, EmailTemplate, FollowUpTemplate, GoogleSheetSyncConfig } from '../types/index.ts';
import { GmailComposeModal } from './GmailComposeModal.tsx';
import { BulkSequencerModal } from './BulkSequencerModal.tsx';
import { buildGmailComposeUrl, buildGmailFollowUpComposeUrl, formatEmailSubject, formatJerryCollaborationEmail, formatFollowUpEmail } from '../utils/scraper.ts';

interface LeadsDashboardProps {
  leads: Lead[];
  tags: Tag[];
  emailTemplate?: EmailTemplate;
  followUpTemplate?: FollowUpTemplate;
  googleSheetConfig?: GoogleSheetSyncConfig;
  isGoogleConnected?: boolean;
  googleUserEmail?: string | null;
  onConnectGoogleSheets?: () => Promise<void>;
  onTriggerGoogleSheetSync?: () => Promise<void>;
  onFetchFromGoogleSheet?: () => Promise<void>;
  onUpdateGoogleSheetConfig?: (cfg: GoogleSheetSyncConfig) => void;
  activeWebsiteFilter?: string;
  onWebsiteFilterChange?: (website: string) => void;
  onUpdateLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onBulkDelete: (leadIds: string[]) => void;
  onBulkUpdateStatus: (leadIds: string[], status: LeadStatus) => void;
  onBulkAddTag: (leadIds: string[], tagId: string) => void;
  onExportCsv: (filteredLeads: Lead[]) => void;
  onOpenManageTags: () => void;
  onAddNewLead: () => void;
  onOpenSimulator: () => void;
  onOpenCsvImport?: () => void;
  onOpenExcludedSites?: () => void;
  onOpenSettings?: () => void;
  onOpenSyncHub?: () => void;
  onSaveAsDefaultTemplate?: (template: EmailTemplate) => void;
}

export const LeadsDashboard: React.FC<LeadsDashboardProps> = ({
  leads,
  tags,
  emailTemplate,
  followUpTemplate,
  googleSheetConfig,
  isGoogleConnected,
  googleUserEmail,
  onConnectGoogleSheets,
  onTriggerGoogleSheetSync,
  onFetchFromGoogleSheet,
  onUpdateGoogleSheetConfig,
  activeWebsiteFilter,
  onWebsiteFilterChange,
  onUpdateLead,
  onDeleteLead,
  onBulkDelete,
  onBulkUpdateStatus,
  onBulkAddTag,
  onExportCsv,
  onOpenManageTags,
  onAddNewLead,
  onOpenSimulator,
  onOpenCsvImport,
  onOpenExcludedSites,
  onOpenSettings,
  onOpenSyncHub,
  onSaveAsDefaultTemplate
}) => {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState<string>(activeWebsiteFilter || 'all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'email-asc' | 'domain-asc'>('date-desc');
  const [reminderFilter, setReminderFilter] = useState<'all' | 'due' | 'overdue'>('all');
  const [gmailComposeLead, setGmailComposeLead] = useState<Lead | null>(null);
  const [followUpComposeLead, setFollowUpComposeLead] = useState<Lead | null>(null);
  const [sequencerInitialStep, setSequencerInitialStep] = useState<1 | 2>(1);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isPullingSheet, setIsPullingSheet] = useState(false);

  // Keep websiteFilter in sync with props
  useEffect(() => {
    if (activeWebsiteFilter) {
      setWebsiteFilter(activeWebsiteFilter);
    }
  }, [activeWebsiteFilter]);

  const handleSetWebsiteFilter = (site: string) => {
    setWebsiteFilter(site);
    if (onWebsiteFilterChange) onWebsiteFilterChange(site);
  };

  // Selected lead IDs for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isSequencerOpen, setIsSequencerOpen] = useState(false);

  // Active editing modal/popup for tags or reminders
  const [activeTagDropdownLeadId, setActiveTagDropdownLeadId] = useState<string | null>(null);
  const [editingNotesLeadId, setEditingNotesLeadId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Extract unique domains for dropdown
  const uniqueDomains = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const d = l.domain || 'unknown';
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Extract unique websites for direct website grouping and filtering
  const uniqueWebsites = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const site = l.websiteName || 'Unknown Site';
      map.set(site, (map.get(site) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = leads.length;
    const outreached = leads.filter(l => l.status === 'outreached' || l.status === 'replied' || l.status === 'converted').length;
    const rate = total > 0 ? Math.round((outreached / total) * 100) : 0;
    const dueReminders = leads.filter(l => l.followUpDate && l.followUpDate <= todayStr && l.status !== 'converted').length;
    const uniqueDomainCount = new Set(leads.map(l => l.domain)).size;
    return { total, outreached, rate, dueReminders, uniqueDomainCount };
  }, [leads, todayStr]);

  // Filtered & Sorted leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter(lead => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            lead.email.toLowerCase().includes(q) ||
            lead.websiteName.toLowerCase().includes(q) ||
            lead.domain.toLowerCase().includes(q) ||
            (lead.notes && lead.notes.toLowerCase().includes(q)) ||
            (lead.pageTitle && lead.pageTitle.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Website filter
        if (websiteFilter !== 'all' && lead.websiteName.toLowerCase() !== websiteFilter.toLowerCase()) {
          return false;
        }

        // Domain filter
        if (domainFilter !== 'all' && lead.domain !== domainFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'all' && lead.status !== statusFilter) {
          return false;
        }

        // Tag filter
        if (tagFilter !== 'all' && !lead.tags.includes(tagFilter)) {
          return false;
        }

        // Reminder filter
        if (reminderFilter === 'due') {
          if (!lead.followUpDate || lead.followUpDate !== todayStr) return false;
        } else if (reminderFilter === 'overdue') {
          if (!lead.followUpDate || lead.followUpDate >= todayStr) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
        }
        if (sortBy === 'date-asc') {
          return new Date(a.discoveredAt).getTime() - new Date(b.discoveredAt).getTime();
        }
        if (sortBy === 'email-asc') {
          return a.email.localeCompare(b.email);
        }
        if (sortBy === 'domain-asc') {
          return a.domain.localeCompare(b.domain);
        }
        return 0;
      });
  }, [leads, searchQuery, domainFilter, statusFilter, tagFilter, sortBy, reminderFilter, todayStr]);

  // Filtered list of currently selected Lead objects
  const selectedLeadsList = useMemo(() => {
    return leads.filter(l => selectedIds.has(l.id));
  }, [leads, selectedIds]);

  // Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const handleSelectUncontacted = () => {
    const uncontacted = filteredLeads.filter(l => l.status === 'uncontacted').map(l => l.id);
    setSelectedIds(new Set(uncontacted));
  };

  const handleSelectOutreached = () => {
    const outreached = filteredLeads.filter(l => l.status === 'outreached').map(l => l.id);
    setSelectedIds(new Set(outreached));
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleOutreached = (lead: Lead) => {
    const isCurrentlyOutreached = lead.status === 'outreached';
    const newStatus: LeadStatus = isCurrentlyOutreached ? 'uncontacted' : 'outreached';
    const nowIso = new Date().toISOString();

    const updated: Lead = {
      ...lead,
      status: newStatus,
      outreachedAt: newStatus === 'outreached' ? nowIso : undefined,
      history: [
        ...(lead.history || []),
        {
          timestamp: nowIso,
          action: newStatus === 'outreached' ? 'Marked as Outreached' : 'Reverted to Uncontacted'
        }
      ]
    };
    onUpdateLead(updated);
  };

  const handleToggleTagOnLead = (lead: Lead, tagId: string) => {
    const currentTags = lead.tags || [];
    const hasTag = currentTags.includes(tagId);
    const updatedTags = hasTag
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];

    onUpdateLead({
      ...lead,
      tags: updatedTags
    });
  };

  const handleSaveNotes = (lead: Lead) => {
    onUpdateLead({
      ...lead,
      notes: tempNotes
    });
    setEditingNotesLeadId(null);
  };

  const handleSetReminderDate = (lead: Lead, dateString: string) => {
    onUpdateLead({
      ...lead,
      followUpDate: dateString || undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Google Sheets Live Sync Bar */}
      <div className={`p-4 rounded-xl border transition-all ${
        isGoogleConnected && googleSheetConfig?.spreadsheetId
          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
          : 'bg-gradient-to-r from-emerald-50/50 via-sky-50/50 to-slate-50 dark:from-emerald-950/20 dark:via-sky-950/20 dark:to-slate-900 border-slate-200 dark:border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              isGoogleConnected
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
            }`}>
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span className="text-sm">Google Sheets Live Auto-Sync</span>
                {isGoogleConnected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected {googleUserEmail ? `(${googleUserEmail})` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isGoogleConnected && googleSheetConfig?.spreadsheetId
                  ? 'All auto-scraped & saved leads are automatically synced to your spreadsheet and rendered in real-time.'
                  : 'Connect your Google account to automatically upload and sync every scraped lead into a dedicated Google Sheet.'}
                {googleSheetConfig?.lastSyncedAt && (
                  <span className="ml-2 font-medium text-emerald-700 dark:text-emerald-400">
                    • Last synced: {new Date(googleSheetConfig.lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            {onOpenSyncHub && (
              <button
                type="button"
                onClick={onOpenSyncHub}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
                title="Configure Google Sheet Sync & link spreadsheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Sync with Google Sheets</span>
                {isGoogleConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                )}
              </button>
            )}

            {googleSheetConfig?.spreadsheetUrl && (
              <a
                href={googleSheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Sheet</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {onTriggerGoogleSheetSync && (
              <button
                type="button"
                disabled={isSyncingSheet}
                onClick={async () => {
                  setIsSyncingSheet(true);
                  try {
                    await onTriggerGoogleSheetSync();
                  } finally {
                    setIsSyncingSheet(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 text-xs"
                title="Push all current dashboard leads to the Google Sheet spreadsheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingSheet ? 'Pushing...' : 'Push to Sheet'}</span>
              </button>
            )}

            {onFetchFromGoogleSheet && (
              <button
                type="button"
                disabled={isPullingSheet}
                onClick={async () => {
                  setIsPullingSheet(true);
                  try {
                    await onFetchFromGoogleSheet();
                  } finally {
                    setIsPullingSheet(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                title="Pull leads from Google Sheet and update dashboard"
              >
                <Upload className="w-3.5 h-3.5 text-sky-500 rotate-180" />
                <span>{isPullingSheet ? 'Pulling...' : 'Pull from Sheet'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Captured
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-500">emails</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Building className="w-3.5 h-3.5" />
            Across <strong className="text-slate-700 dark:text-slate-300">{metrics.uniqueDomainCount}</strong> domains
          </div>
        </div>

        {/* Card 2: Outreached Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Outreached Leads
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.outreached}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              ({metrics.rate}%)
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.rate}%` }}
            />
          </div>
        </div>

        {/* Card 3: Follow-up Reminders */}
        <div
          onClick={() => setReminderFilter(reminderFilter === 'due' ? 'all' : 'due')}
          className={`cursor-pointer transition-all bg-white dark:bg-slate-900 border ${
            metrics.dueReminders > 0
              ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-200 dark:ring-rose-950'
              : 'border-slate-200 dark:border-slate-800'
          } rounded-xl p-4 shadow-xs hover:border-rose-400`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Reminders Due
            </span>
            <div
              className={`p-2 rounded-lg ${
                metrics.dueReminders > 0
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.dueReminders}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {metrics.dueReminders > 0 ? 'Requires follow-up' : 'All clear'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Click to filter due contacts
          </div>
        </div>

        {/* Card 4: Quick Action / Scanner */}
        <div className="bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-emerald-500/10 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-emerald-950/40 border border-sky-200 dark:border-sky-900/60 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              In-Browser Scraper
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-200/80 dark:bg-sky-900 text-sky-800 dark:text-sky-200 font-bold">
              Simulator
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Test the extension on simulated or live sites with in-page highlights.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onOpenSimulator}
              className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors text-center"
            >
              Launch Live Scanner
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by email, brand, domain, or notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Website Filter Dropdown */}
            <select
              aria-label="Filter by Scraped Website"
              value={websiteFilter}
              onChange={e => handleSetWebsiteFilter(e.target.value)}
              className="py-2 px-3 bg-sky-50/70 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 rounded-lg text-xs font-semibold text-sky-800 dark:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Websites ({uniqueWebsites.length})</option>
              {uniqueWebsites.map(([site, count]) => (
                <option key={site} value={site}>
                  🌐 {site} ({count})
                </option>
              ))}
            </select>

            {/* Domain Filter */}
            <select
              aria-label="Filter by Domain"
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Domains ({uniqueDomains.length})</option>
              {uniqueDomains.map(([dom, count]) => (
                <option key={dom} value={dom}>
                  {dom} ({count})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              aria-label="Filter by Outreach Status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as LeadStatus | 'all')}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="uncontacted">⚪ Uncontacted</option>
              <option value="outreached">🟢 Outreached</option>
              <option value="replied">🔵 Replied</option>
              <option value="converted">⭐ Converted</option>
              <option value="bounced">🔴 Bounced</option>
            </select>

            {/* Tag Filter */}
            <select
              aria-label="Filter by Category Tag"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Tags ({tags.length})</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>
                  🏷️ {t.name}
                </option>
              ))}
            </select>

            {/* Sort Filter */}
            <select
              aria-label="Sort Leads"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="email-asc">Email (A-Z)</option>
              <option value="domain-asc">Domain (A-Z)</option>
            </select>

            {/* Manage Tags Button */}
            <button
              onClick={onOpenManageTags}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <TagIcon className="w-3.5 h-3.5" />
              Manage Tags
            </button>

            {/* Import CSV Button */}
            {onOpenCsvImport && (
              <button
                onClick={onOpenCsvImport}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Import leads from CSV file"
              >
                <Upload className="w-3.5 h-3.5 text-sky-500" />
                Import CSV
              </button>
            )}

            {/* Excluded Sites Button */}
            {onOpenExcludedSites && (
              <button
                onClick={onOpenExcludedSites}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Manage Excluded Sites & Blacklist"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Excluded Sites
              </button>
            )}

            {/* Template Settings Button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Edit Gmail Outreach Email Template"
              >
                <Settings className="w-3.5 h-3.5 text-sky-500" />
                Template Settings
              </button>
            )}

            {/* Sync with GSheets Button */}
            {onOpenSyncHub && (
              <button
                onClick={onOpenSyncHub}
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open Google Sheets Sync Hub & Controls"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Sync with GSheets</span>
                {isGoogleConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Quick Website Filter Chips */}
        {uniqueWebsites.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Filter by Website:
            </span>
            <button
              onClick={() => handleSetWebsiteFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                websiteFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({leads.length})
            </button>
            {uniqueWebsites.map(([site, count]) => (
              <button
                key={site}
                onClick={() => handleSetWebsiteFilter(site)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                  websiteFilter === site
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{site}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${websiteFilter === site ? 'bg-sky-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filter Badges Bar */}
        {(websiteFilter !== 'all' || domainFilter !== 'all' || statusFilter !== 'all' || tagFilter !== 'all' || reminderFilter !== 'all' || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <span>Active filters:</span>
            {websiteFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 flex items-center gap-1 font-semibold">
                Website: {websiteFilter}
                <button onClick={() => handleSetWebsiteFilter('all')} className="hover:font-bold">×</button>
              </span>
            )}
            {domainFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 flex items-center gap-1">
                Domain: {domainFilter}
                <button onClick={() => setDomainFilter('all')} className="hover:font-bold">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:font-bold">×</button>
              </span>
            )}
            {tagFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 flex items-center gap-1">
                Tag: {tags.find(t => t.id === tagFilter)?.name}
                <button onClick={() => setTagFilter('all')} className="hover:font-bold">×</button>
              </span>
            )}
            {reminderFilter !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center gap-1">
                Reminders: {reminderFilter}
                <button onClick={() => setReminderFilter('all')} className="hover:font-bold">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setWebsiteFilter('all');
                setDomainFilter('all');
                setStatusFilter('all');
                setTagFilter('all');
                setReminderFilter('all');
              }}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline ml-2"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk Action Toolbar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sky-950 dark:text-sky-100 bg-sky-200/80 dark:bg-sky-900/80 px-2.5 py-1 rounded-lg">
              {selectedIds.size} of {filteredLeads.length} selected
            </span>
            <button
              onClick={() => setSelectedIds(new Set(filteredLeads.map(l => l.id)))}
              className="text-xs text-sky-700 dark:text-sky-300 hover:underline font-medium cursor-pointer"
            >
              Select all ({filteredLeads.length})
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={handleSelectUncontacted}
              className="text-xs text-sky-700 dark:text-sky-300 hover:underline font-medium cursor-pointer"
            >
              Uncontacted only
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={handleSelectOutreached}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline font-medium cursor-pointer"
            >
              Outreached only
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
            >
              Deselect
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Quick Follow-up Button */}
            <button
              type="button"
              onClick={() => {
                setSequencerInitialStep(2);
                setIsSequencerOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Launch step-by-step Gmail follow-up sequence for selected leads"
            >
              <Clock className="w-3.5 h-3.5 text-amber-200" />
              <span>Bulk Quick Follow-up ({selectedIds.size})</span>
            </button>

            {/* Bulk Email Sequencer Button */}
            <button
              type="button"
              onClick={() => {
                setSequencerInitialStep(1);
                setIsSequencerOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Launch step-by-step Gmail initial outreach & sequencing for selected leads"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Bulk Sequencer ({selectedIds.size})</span>
            </button>

            <button
              onClick={() => onBulkUpdateStatus(Array.from(selectedIds), 'outreached')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Outreached
            </button>

            <button
              onClick={() => {
                const selectedLeads = leads.filter(l => selectedIds.has(l.id));
                onExportCsv(selectedLeads);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium flex items-center gap-1 transition-colors"
            >
              Export Selected CSV
            </button>

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Permanently delete all selected leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bulk Delete ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Leads Table for Desktop / Card List for Mobile */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Table Header (Desktop) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="col-span-1 flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Select all leads"
              checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
              onChange={handleToggleSelectAll}
              className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
            />
            <span>Select</span>
          </div>
          <div className="col-span-3">Email & Prospect</div>
          <div className="col-span-2">Website & Domain</div>
          <div className="col-span-2">Contact Status</div>
          <div className="col-span-2">Tags / Categories</div>
          <div className="col-span-2 text-right">Follow-up / Actions</div>
        </div>

        {/* Empty State */}
        {filteredLeads.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
              No scraped leads found
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || domainFilter !== 'all' || statusFilter !== 'all'
                ? 'Try broadening your search query or resetting filters.'
                : 'Use the Live Page Scanner simulator or install the Chrome extension to automatically collect leads.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={onOpenSimulator}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
              >
                Launch Scanner Simulator
              </button>
              <button
                onClick={onAddNewLead}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                + Add Manual Lead
              </button>
            </div>
          </div>
        )}

        {/* Leads Rows (Desktop & Mobile) */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredLeads.map(lead => {
            const isSelected = selectedIds.has(lead.id);
            const isOverdue = lead.followUpDate && lead.followUpDate < todayStr && lead.status !== 'converted';
            const isDueToday = lead.followUpDate && lead.followUpDate === todayStr && lead.status !== 'converted';
            const isOutreachedLead = lead.status === 'outreached' || lead.status === 'replied' || lead.status === 'converted';
            const directGmailUrl = buildGmailComposeUrl(
              lead.email,
              lead.websiteName,
              lead.url,
              emailTemplate?.subject,
              emailTemplate?.body
            );
            const directFollowUpUrl = buildGmailFollowUpComposeUrl(
              lead.email,
              lead.websiteName,
              lead.url,
              followUpTemplate?.subject,
              followUpTemplate?.body
            );

            return (
              <div
                key={lead.id}
                className={`p-4 transition-colors ${
                  isSelected
                    ? 'bg-sky-50/70 dark:bg-sky-950/30'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Desktop Grid Layout */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-2 items-center">
                  {/* Select Checkbox */}
                  <div className="col-span-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.email}`}
                      checked={isSelected}
                      onChange={() => handleToggleSelect(lead.id)}
                      className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center uppercase">
                      {lead.email.charAt(0)}
                    </div>
                  </div>

                  {/* Email & Copy */}
                  <div className="col-span-3 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {lead.email.replace(/^mailto:/i, '')}
                      </span>
                      <button
                        onClick={() => handleCopyEmail(lead.email.replace(/^mailto:/i, ''), lead.id)}
                        title="Copy Email"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {copiedId === lead.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={`mailto:${lead.email.replace(/^mailto:/i, '')}`}
                        title="Send Email"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-sky-500 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {lead.pageTitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {lead.pageTitle}
                      </p>
                    )}
                  </div>

                  {/* Website Name & Domain */}
                  <div className="col-span-2 min-w-0 pr-2">
                    <button
                      onClick={() => handleSetWebsiteFilter(lead.websiteName)}
                      className="font-semibold text-xs text-slate-800 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 truncate block text-left transition-colors cursor-pointer max-w-full"
                      title={`Filter by website: ${lead.websiteName}`}
                    >
                      {lead.websiteName}
                    </button>
                    <a
                      href={lead.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline truncate max-w-full"
                    >
                      <span>{lead.domain}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>

                  {/* Outreached Status Button */}
                  <div className="col-span-2">
                    <div className="flex flex-col gap-1 items-start">
                      <button
                        onClick={() => handleToggleOutreached(lead)}
                        title="Click to toggle Outreached status"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shadow-xs ${
                          lead.status === 'outreached'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200'
                            : lead.status === 'replied'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                            : lead.status === 'converted'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:text-sky-700'
                        }`}
                      >
                        {lead.status === 'outreached' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Outreached</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 text-slate-400" />
                            <span>Mark Outreached</span>
                          </>
                        )}
                      </button>
                      {lead.outreachedAt && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(lead.outreachedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="col-span-2 relative">
                    <div className="flex flex-wrap items-center gap-1">
                      {lead.tags.map(tid => {
                        const tagObj = tags.find(t => t.id === tid);
                        if (!tagObj) return null;
                        return (
                          <span
                            key={tid}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${tagObj.bgColor} ${tagObj.textColor} ${tagObj.borderColor}`}
                          >
                            {tagObj.name}
                          </span>
                        );
                      })}

                      {/* Add Tag Dropdown Trigger */}
                      <button
                        onClick={() =>
                          setActiveTagDropdownLeadId(
                            activeTagDropdownLeadId === lead.id ? null : lead.id
                          )
                        }
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 text-[10px] font-bold transition-colors"
                        title="Add/Remove Tags"
                      >
                        + Tag
                      </button>
                    </div>

                    {/* Popover Tag Selector */}
                    {activeTagDropdownLeadId === lead.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-1">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Assign Categories
                        </div>
                        {tags.map(t => {
                          const has = lead.tags.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleToggleTagOnLead(lead, t.id)}
                              className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: t.color }}
                                />
                                <span className="text-slate-800 dark:text-slate-200">{t.name}</span>
                              </span>
                              {has && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions / Follow-up */}
                  <div className="col-span-2 flex items-center justify-end gap-2 text-right">
                    {/* Follow-up date picker */}
                    <div className="relative group">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                          isOverdue
                            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
                            : isDueToday
                            ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                            : lead.followUpDate
                            ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            : 'text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                        title={isOverdue ? 'Follow-up Overdue!' : isDueToday ? 'Follow-up Due Today!' : 'Set Follow-up'}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>
                          {lead.followUpDate ? lead.followUpDate : 'No Reminder'}
                        </span>
                      </div>
                      <input
                        type="date"
                        aria-label="Set follow-up date"
                        value={lead.followUpDate || ''}
                        onChange={e => handleSetReminderDate(lead, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* Send with Gmail Compound Button (Direct Native Anchor + Preview) */}
                    <div className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 shadow-xs overflow-hidden">
                      <a
                        href={directGmailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (lead.status !== 'outreached') {
                            handleToggleOutreached(lead);
                          }
                        }}
                        title="1-Click Launch Jerry's outreach draft directly in Gmail Web Compose"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors no-underline cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>Gmail</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setGmailComposeLead(lead)}
                        title="Preview & Customize Email Draft"
                        className="p-1 px-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 border-l border-red-200 dark:border-red-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Edit Notes Button */}
                    <button
                      onClick={() => {
                        setEditingNotesLeadId(lead.id);
                        setTempNotes(lead.notes || '');
                      }}
                      title="Edit Notes"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <Building className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Lead Button */}
                    <button
                      onClick={() => onDeleteLead(lead.id)}
                      title="Delete Lead"
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile Card Layout */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.email}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelect(lead.id)}
                        className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                      />
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white break-all flex items-center gap-1.5">
                          {lead.email.replace(/^mailto:/i, '')}
                          <button
                            onClick={() => handleCopyEmail(lead.email.replace(/^mailto:/i, ''), lead.id)}
                            className="text-slate-400 hover:text-sky-500"
                          >
                            {copiedId === lead.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => handleSetWebsiteFilter(lead.websiteName)}
                            className="hover:text-sky-500 font-medium underline"
                          >
                            {lead.websiteName}
                          </button>
                          <span>•</span>
                          <span className="text-sky-600 dark:text-sky-400">{lead.domain}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteLead(lead.id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mobile Status and Tags */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleOutreached(lead)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          lead.status === 'outreached'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {lead.status === 'outreached' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Outreached</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Mark Outreached</span>
                          </>
                        )}
                      </button>

                      <div className="inline-flex items-center rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/70 overflow-hidden">
                        <a
                          href={directGmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (lead.status !== 'outreached') {
                              handleToggleOutreached(lead);
                            }
                          }}
                          title="1-Click Launch Jerry's Collaboration Email via Gmail"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 no-underline cursor-pointer"
                        >
                          <Mail className="w-3 h-3 text-red-500" />
                          <span>Gmail</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setGmailComposeLead(lead)}
                          title="Preview & Customize Email"
                          className="p-1 px-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 border-l border-red-200 dark:border-red-800 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 relative">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.map(tid => {
                          const tagObj = tags.find(t => t.id === tid);
                          if (!tagObj) return null;
                          return (
                            <span
                              key={tid}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tagObj.bgColor} ${tagObj.textColor}`}
                            >
                              {tagObj.name}
                            </span>
                          );
                        })}
                      </div>
                      <button
                        onClick={() =>
                          setActiveTagDropdownLeadId(
                            activeTagDropdownLeadId === lead.id ? null : lead.id
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold"
                      >
                        + Tag
                      </button>

                      {/* Mobile Popover Tag Selector */}
                      {activeTagDropdownLeadId === lead.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-1">
                          {tags.map(t => {
                            const has = lead.tags.includes(t.id);
                            return (
                              <button
                                key={t.id}
                                onClick={() => handleToggleTagOnLead(lead, t.id)}
                                className="w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: t.color }}
                                  />
                                  <span>{t.name}</span>
                                </span>
                                {has && <Check className="w-3 h-3 text-emerald-500" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Follow-up on Mobile */}
                  <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Follow-up: {lead.followUpDate || 'None'}
                    </span>
                    <input
                      type="date"
                      aria-label="Set follow-up date"
                      value={lead.followUpDate || ''}
                      onChange={e => handleSetReminderDate(lead, e.target.value)}
                      className="text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded"
                    />
                  </div>
                </div>

                {/* Inline Notes Display if present */}
                {lead.notes && (
                  <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-md p-2 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <strong>Notes:</strong> {lead.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Notes Modal */}
      {editingNotesLeadId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Lead Prospect Notes
            </h3>
            <textarea
              rows={4}
              value={tempNotes}
              onChange={e => setTempNotes(e.target.value)}
              placeholder="Record contact info, pitch notes, follow-up conversation details..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingNotesLeadId(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetLead = leads.find(l => l.id === editingNotesLeadId);
                  if (targetLead) handleSaveNotes(targetLead);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gmail Outreach Modal */}
      {gmailComposeLead && (
        <GmailComposeModal
          lead={gmailComposeLead}
          emailTemplate={emailTemplate}
          onSendSuccess={(leadId) => {
            onBulkUpdateStatus([leadId], 'outreached');
            setGmailComposeLead(null);
          }}
          onOpenSettings={onOpenSettings}
          onSaveAsDefaultTemplate={onSaveAsDefaultTemplate}
          onClose={() => setGmailComposeLead(null)}
        />
      )}

      {/* Bulk Email Sequencer Modal */}
      {isSequencerOpen && selectedLeadsList.length > 0 && (
        <BulkSequencerModal
          selectedLeads={selectedLeadsList}
          emailTemplate={emailTemplate}
          onUpdateLead={onUpdateLead}
          onBulkUpdateStatus={onBulkUpdateStatus}
          onClose={() => setIsSequencerOpen(false)}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Bulk Delete {selectedIds.size} Leads?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300">
              You are about to delete <strong>{selectedIds.size}</strong> selected contact records from your offline CRM database.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onBulkDelete(Array.from(selectedIds));
                  setSelectedIds(new Set());
                  setIsBulkDeleteConfirmOpen(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-md"
              >
                Confirm Bulk Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
