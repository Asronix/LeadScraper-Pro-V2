import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  Search,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  Plus,
  RefreshCw,
  ExternalLink,
  Code,
  ArrowRight,
  Info,
  Link2,
  FileSpreadsheet,
  Mail
} from 'lucide-react';
import { PRESET_WEBSITES, PresetWebsite } from '../data/mockData.ts';
import { parseAndClassifyEmails, extractWebsiteName, isDomainExcluded, extractOutboundLinksFromHtml } from '../utils/scraper.ts';
import { generateOutboundLinksCsv, downloadCsvFile } from '../utils/csv.ts';
import { GmailComposeModal } from './GmailComposeModal.tsx';
import type { Lead, ScrapeAnalysisResult, OutboundLink, EmailTemplate } from '../types/index.ts';

interface WebpageScannerSimulatorProps {
  onAddLeadsToCrm: (leads: Lead[]) => void;
  onNavigateToCrm: () => void;
  onNavigateToCrmWithFilter?: (websiteName: string) => void;
  excludedDomains?: string[];
  emailTemplate?: EmailTemplate;
  onOpenSettings?: () => void;
  onSaveAsDefaultTemplate?: (template: EmailTemplate) => void;
}

export const WebpageScannerSimulator: React.FC<WebpageScannerSimulatorProps> = ({
  onAddLeadsToCrm,
  onNavigateToCrm,
  onNavigateToCrmWithFilter,
  excludedDomains = [],
  emailTemplate,
  onOpenSettings,
  onSaveAsDefaultTemplate
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset_startup');
  const [customUrl, setCustomUrl] = useState<string>('https://saasify-cloud.io/company/team');
  const [customHtml, setCustomHtml] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Extension Settings & Tabs
  const [enableHighlight, setEnableHighlight] = useState<boolean>(true);
  const [enableHiddenBypass, setEnableHiddenBypass] = useState<boolean>(true);
  const [activePopupTab, setActivePopupTab] = useState<'emails' | 'outbound'>('emails');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'captured' | 'bypassed'>('captured');
  const [outboundSearchQuery, setOutboundSearchQuery] = useState<string>('');
  const [gmailComposeLead, setGmailComposeLead] = useState<Lead | null>(null);

  // Scrape Results
  const [analysis, setAnalysis] = useState<ScrapeAnalysisResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null);
  const [isSavedToCrm, setIsSavedToCrm] = useState<boolean>(false);
  const [autoSavedWebsite, setAutoSavedWebsite] = useState<string | null>(null);
  const [autoSavedCount, setAutoSavedCount] = useState<number>(0);

  // Check if current page domain is in excluded sites list
  const isCurrentSiteExcluded = useMemo(() => {
    return isDomainExcluded(customUrl, excludedDomains);
  }, [customUrl, excludedDomains]);

  // Extract Outbound Links (excluding in-links, fragment links, mailto:, javascript:)
  const outboundLinks = useMemo(() => {
    return extractOutboundLinksFromHtml(customHtml, customUrl, excludedDomains);
  }, [customHtml, customUrl, excludedDomains]);

  // Filtered outbound links by search query
  const filteredOutboundLinks = useMemo(() => {
    if (!outboundSearchQuery.trim()) return outboundLinks;
    const q = outboundSearchQuery.toLowerCase().trim();
    return outboundLinks.filter(l =>
      l.domain.toLowerCase().includes(q) ||
      l.anchorText.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q)
    );
  }, [outboundLinks, outboundSearchQuery]);

  // Active preset
  const activePreset = useMemo(() => {
    return PRESET_WEBSITES.find(p => p.id === selectedPresetId) || PRESET_WEBSITES[0];
  }, [selectedPresetId]);

  // Load preset content
  useEffect(() => {
    if (!isCustomMode && activePreset) {
      setCustomUrl(activePreset.url);
      setCustomHtml(activePreset.html);
      runScrape(activePreset.html, activePreset.url, activePreset.name);
    }
  }, [selectedPresetId, isCustomMode]);

  const runScrape = (html: string, url: string, name: string) => {
    const isExcluded = isDomainExcluded(url, excludedDomains);
    if (isExcluded) {
      setAnalysis({
        websiteName: name || extractWebsiteName(url),
        url,
        pageTitle: name || 'Excluded Site',
        totalFound: 0,
        visibleEmails: [],
        hiddenEmailsBypassed: [],
        scrapedItems: [],
        timestamp: new Date().toISOString()
      });
      setIsSavedToCrm(false);
      setAutoSavedCount(0);
      return;
    }

    const result = parseAndClassifyEmails(html, url, name);
    // Ensure every email is clean without mailto:
    result.visibleEmails = result.visibleEmails.map(e => e.replace(/^mailto:/i, '').split('?')[0].trim());
    setAnalysis(result);

    // AUTO-INGESTION: Automatically save all scanned emails to Dashboard CRM if not excluded!
    if (result.visibleEmails.length > 0) {
      const timestamp = new Date().toISOString();
      const domain = url ? new URL(url).hostname.replace(/^www\./, '') : 'example.com';
      const cleanWebsiteName = name || extractWebsiteName(url);

      const newLeads: Lead[] = result.visibleEmails.map((email, idx) => ({
        id: 'auto_' + Date.now() + '_' + idx,
        email: email.replace(/^mailto:/i, '').trim(), // strictly no mailto:
        domain,
        websiteName: cleanWebsiteName,
        url,
        pageTitle: result.pageTitle,
        discoveredAt: timestamp,
        status: 'uncontacted',
        tags: [],
        notes: `Auto-extracted from ${cleanWebsiteName} without manual copy-paste.`,
        history: [{ timestamp, action: `Automatically ingested from ${url}` }]
      }));

      onAddLeadsToCrm(newLeads);
      setIsSavedToCrm(true);
      setAutoSavedWebsite(cleanWebsiteName);
      setAutoSavedCount(result.visibleEmails.length);
    } else {
      setIsSavedToCrm(false);
      setAutoSavedCount(0);
    }
  };

  const [isFetchingUrl, setIsFetchingUrl] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleSelectPreset = (preset: PresetWebsite) => {
    setIsCustomMode(false);
    setSelectedPresetId(preset.id);
    setFetchError(null);
  };

  const handleFetchAndScanUrl = async (urlOverride?: string) => {
    const targetUrl = (urlOverride || customUrl).trim();
    if (!targetUrl) return;

    setIsFetchingUrl(true);
    setFetchError(null);

    let fetchedHtml = '';
    let finalUrl = targetUrl;

    try {
      // 1. Try our fullstack backend proxy endpoint
      const res = await fetch(`/api/scrape-url?url=${encodeURIComponent(targetUrl)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.html) {
          fetchedHtml = data.html;
          finalUrl = data.url || targetUrl;
        }
      } else {
        // 2. Fallback to public allorigins proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const proxyRes = await fetch(proxyUrl);
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.contents) {
            fetchedHtml = proxyData.contents;
          }
        }
      }

      if (fetchedHtml) {
        setCustomUrl(finalUrl);
        setCustomHtml(fetchedHtml);
        const brandName = extractWebsiteName(finalUrl);
        runScrape(fetchedHtml, finalUrl, brandName);
      } else {
        throw new Error(`Could not fetch live content for ${targetUrl}. Please paste the webpage HTML or text into the editor below.`);
      }
    } catch (err: any) {
      console.warn('Live fetch error:', err);
      setFetchError(err?.message || 'Could not fetch page. Enter HTML/text manually below.');
      const brandName = extractWebsiteName(finalUrl);
      runScrape(customHtml, finalUrl, brandName);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleManualScan = () => {
    const brandName = extractWebsiteName(customUrl);
    runScrape(customHtml, customUrl, brandName);
  };

  const handleCopy = (email: string) => {
    const clean = email.replace(/^mailto:/i, '').trim();
    navigator.clipboard.writeText(clean);
    setCopiedEmail(clean);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleViewInDashboardFiltered = () => {
    if (autoSavedWebsite && onNavigateToCrmWithFilter) {
      onNavigateToCrmWithFilter(autoSavedWebsite);
    } else {
      onNavigateToCrm();
    }
  };

  // Convert scraped visible emails into CRM Lead objects and save
  const handleSaveAllToCrm = (markOutreached: boolean = false) => {
    if (!analysis || analysis.visibleEmails.length === 0) return;

    const timestamp = new Date().toISOString();
    const newLeads: Lead[] = analysis.visibleEmails.map((email, idx) => ({
      id: 'scraped_' + Date.now() + '_' + idx,
      email,
      domain: analysis.url ? new URL(analysis.url).hostname.replace(/^www\./, '') : 'example.com',
      websiteName: analysis.websiteName || 'Captured Site',
      url: analysis.url,
      pageTitle: analysis.pageTitle,
      discoveredAt: timestamp,
      status: markOutreached ? 'outreached' : 'uncontacted',
      outreachedAt: markOutreached ? timestamp : undefined,
      tags: [],
      notes: `Captured automatically via Chrome Extension Live Scanner from ${analysis.url}`,
      history: [
        {
          timestamp,
          action: `Scraped by Chrome Extension on ${analysis.url}`
        },
        ...(markOutreached
          ? [
              {
                timestamp,
                action: 'Marked as Outreached'
              }
            ]
          : [])
      ]
    }));

    onAddLeadsToCrm(newLeads);
    setIsSavedToCrm(true);
  };

  // Generate HTML with in-page highlight badges injected
  const highlightedHtml = useMemo(() => {
    if (!analysis || !enableHighlight) {
      return customHtml;
    }

    let modified = customHtml;
    // Highlight visible emails
    for (const email of analysis.visibleEmails) {
      // Avoid replacing if inside an HTML tag attribute like href="mailto:..."
      const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Look for the email outside of HTML tags or inside text
      const regex = new RegExp(`(>|^)([^<]*?)(${escaped})([^>]*?)(<|$)`, 'gi');
      modified = modified.replace(regex, (match, prefix, before, matchedEmail, after, suffix) => {
        return `${prefix}${before}<mark class="leadscrape-highlight-badge" title="LeadScrape: Discovered email. Click to copy." onclick="navigator.clipboard.writeText('${matchedEmail}'); this.setAttribute('data-copied', 'true'); setTimeout(() => this.removeAttribute('data-copied'), 2000);">${matchedEmail}</mark>${after}${suffix}`;
      });
    }

    return modified;
  }, [customHtml, analysis, enableHighlight]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Presets Selection */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
                <Globe2 className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Chrome Extension Live Scanner & DOM Highlighter
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Simulates the Chrome background service worker and content script. Automatically extracts all visible emails, highlights them in the webpage interface, and filters out hidden decoy traps.
            </p>
          </div>

          {/* Extension Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Highlight Toggle */}
            <button
              onClick={() => setEnableHighlight(!enableHighlight)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                enableHighlight
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {enableHighlight ? <Eye className="w-3.5 h-3.5 text-amber-500" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>In-Page Highlighting</span>
              <span className="text-[10px] uppercase font-bold">{enableHighlight ? 'ON' : 'OFF'}</span>
            </button>

            {/* Hidden Bypass Toggle */}
            <button
              onClick={() => setEnableHiddenBypass(!enableHiddenBypass)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                enableHiddenBypass
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Bypass Hidden Traps</span>
              <span className="text-[10px] uppercase font-bold">{enableHiddenBypass ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Preset Webpages Switcher */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
            Preset Test Sites:
          </span>
          {PRESET_WEBSITES.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !isCustomMode && selectedPresetId === preset.id
                  ? 'bg-sky-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {preset.name}
            </button>
          ))}
          <button
            onClick={() => {
              setIsCustomMode(true);
              setCustomUrl('https://example-directory.com/team');
              setCustomHtml(
                '<div style="padding:20px;"><h2>Custom HTML Page</h2><p>Contact founder at founder@example-directory.com</p><p>Hidden trap: <span style="display:none">trap@example-directory.com</span></p></div>'
              );
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isCustomMode
                ? 'bg-sky-600 text-white shadow-xs font-semibold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ✏️ Custom URL / HTML
          </button>
        </div>
      </div>

      {/* Main Dual View: Simulated Browser on Left, Live Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulated Browser Viewport (8 Columns) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-slate-800 rounded-t-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-700 gap-2">
            {/* Window Controls & URL bar */}
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="flex-1 mx-2 flex items-center gap-2 bg-slate-900/90 text-slate-300 text-xs px-3 py-1.5 rounded-md border border-slate-700">
                <span className="text-emerald-400 font-bold shrink-0">🔒</span>
                <input
                  type="text"
                  value={customUrl}
                  onChange={e => {
                    setCustomUrl(e.target.value);
                    if (!isCustomMode) setIsCustomMode(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchAndScanUrl();
                    }
                  }}
                  className="w-full bg-transparent border-none text-white focus:outline-none font-mono text-xs"
                  placeholder="https://example.com/team or page URL..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isFetchingUrl}
                onClick={() => handleFetchAndScanUrl()}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                title="Fetch live page HTML and scan for emails & links"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUrl ? 'animate-spin' : ''}`} />
                <span>{isFetchingUrl ? 'Fetching...' : 'Fetch & Scan'}</span>
              </button>

              <button
                type="button"
                onClick={handleManualScan}
                className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Rescan current HTML/text buffer"
              >
                <span>Rescan</span>
              </button>
            </div>
          </div>

          {fetchError && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                {fetchError}
              </span>
              <button
                onClick={() => setFetchError(null)}
                className="text-amber-400 hover:text-white font-bold ml-2"
              >
                ×
              </button>
            </div>
          )}

          {/* Webpage Content Container */}
          <div className="bg-white dark:bg-slate-950 border border-t-0 border-slate-200 dark:border-slate-800 rounded-b-xl overflow-hidden shadow-md min-h-[440px] flex flex-col">
            {/* Custom Mode HTML Editor Toggle */}
            {isCustomMode && (
              <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Custom Page HTML / Text Input:
                  </label>
                  <button
                    type="button"
                    onClick={handleManualScan}
                    className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Scan Pasted Content</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={customHtml}
                  onChange={e => setCustomHtml(e.target.value)}
                  placeholder="Paste HTML source or plain text here with emails and outbound links..."
                  className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            )}

            {/* Rendered HTML inside interactive frame */}
            <div className="p-6 flex-1 text-slate-800 dark:text-slate-200 prose dark:prose-invert max-w-none">
              <style>{`
                .leadscrape-highlight-badge {
                  background: #fef08a !important;
                  color: #0f172a !important;
                  font-weight: 700 !important;
                  padding: 2px 6px !important;
                  border-radius: 4px !important;
                  border: 1px solid #eab308 !important;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
                  cursor: pointer !important;
                  position: relative !important;
                  display: inline-block !important;
                  transition: transform 0.15s ease !important;
                }
                .leadscrape-highlight-badge:hover {
                  background: #fde047 !important;
                  transform: scale(1.04) !important;
                }
                .leadscrape-highlight-badge[data-copied="true"]::after {
                  content: "✓ Copied to clipboard";
                  position: absolute;
                  bottom: 110%;
                  left: 50%;
                  transform: translateX(-50%);
                  background: #0f172a;
                  color: #fff;
                  font-size: 10px;
                  padding: 2px 6px;
                  border-radius: 4px;
                  white-space: nowrap;
                  z-index: 50;
                }
                .saas-site, .testbed-site, .vc-site {
                  font-family: inherit;
                }
                .site-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding-bottom: 12px;
                  margin-bottom: 20px;
                  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                }
                .site-logo { font-size: 18px; font-weight: 800; }
                .team-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 16px;
                  margin: 20px 0;
                }
                .team-card {
                  padding: 16px;
                  border-radius: 10px;
                  background: rgba(148, 163, 184, 0.08);
                  border: 1px solid rgba(148, 163, 184, 0.2);
                }
                .team-card h3 { margin: 6px 0 2px 0; font-size: 15px; }
                .team-card .role { font-size: 12px; color: #0284c7; font-weight: 600; margin-bottom: 8px; }
                .team-card .bio { font-size: 12px; color: #64748b; margin-bottom: 10px; }
                .notice-box {
                  padding: 12px;
                  background: #fef2f2;
                  color: #991b1b;
                  border-left: 4px solid #ef4444;
                  border-radius: 6px;
                  margin-bottom: 16px;
                  font-size: 13px;
                }
                .dark .notice-box {
                  background: #450a0a;
                  color: #fca5a5;
                }
              `}</style>
              <div
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>

            {/* Highlighting In-Page Helper Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 inline-block"></span>
                <span>Amber badges indicate live in-page highlighted emails. Click any badge to copy directly.</span>
              </div>
              <span>LeadScrape Pro Content Script</span>
            </div>
          </div>
        </div>

        {/* Live Extraction Inspector (4 Columns) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            {/* Header & Extension Status */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-500" />
                Extension Simulator
              </h3>
              {isCurrentSiteExcluded ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300">
                  Site Excluded
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300">
                  Auto-Active
                </span>
              )}
            </div>

            {/* Excluded Site Warning Banner */}
            {isCurrentSiteExcluded && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Excluded Site (Scraping Bypassed)
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  This domain matches your Excluded Sites list. LeadScrape Pro skips email harvesting here to keep your database clean.
                </p>
              </div>
            )}

            {/* Popup Tab Switcher (Emails Scraper vs Outbound Links Grabber) */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActivePopupTab('emails')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activePopupTab === 'emails'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Emails ({analysis?.visibleEmails.length || 0})</span>
              </button>
              <button
                onClick={() => setActivePopupTab('outbound')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activePopupTab === 'outbound'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Outbound Links ({outboundLinks.length})</span>
              </button>
            </div>

            {/* TAB 1: EMAILS SCRAPER */}
            {activePopupTab === 'emails' && (
              <div className="space-y-4">
                {/* Quick Summary Pill Banner */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div
                    onClick={() => setActiveInspectorTab('captured')}
                    className={`cursor-pointer p-2.5 rounded-lg border transition-all ${
                      activeInspectorTab === 'captured'
                        ? 'bg-sky-50 dark:bg-sky-950/70 border-sky-300 dark:border-sky-800 ring-1 ring-sky-300'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="text-xl font-bold text-sky-600 dark:text-sky-400">
                      {analysis?.visibleEmails.length || 0}
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Visible Captured
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveInspectorTab('bypassed')}
                    className={`cursor-pointer p-2.5 rounded-lg border transition-all ${
                      activeInspectorTab === 'bypassed'
                        ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 ring-1 ring-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                      {analysis?.hiddenEmailsBypassed.length || 0}
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Hidden Bypassed
                    </div>
                  </div>
                </div>

                {/* Sub-tab: Visible Captured Leads */}
                {activeInspectorTab === 'captured' && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Captured Visible Emails:</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Strictly no mailto:</span>
                    </div>

                    {(!analysis || analysis.visibleEmails.length === 0) ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        {isCurrentSiteExcluded
                          ? 'Scanning bypassed on this excluded domain.'
                          : 'No visible emails detected on this page.'}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {analysis.visibleEmails.map(email => {
                          const mockLead: Lead = {
                            id: 'sim_' + email,
                            email,
                            domain: analysis.url ? new URL(analysis.url).hostname.replace(/^www\./, '') : 'example.com',
                            websiteName: analysis.websiteName || 'Captured Site',
                            url: analysis.url,
                            discoveredAt: new Date().toISOString(),
                            status: 'uncontacted',
                            tags: []
                          };

                          return (
                            <div
                              key={email}
                              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {email}
                                </p>
                                <span className="text-[10px] text-slate-500">
                                  {analysis.websiteName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setGmailComposeLead(mockLead)}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 flex items-center gap-1"
                                  title="Send Jerry's Collaboration Email via Gmail"
                                >
                                  <Mail className="w-3 h-3 text-red-500" />
                                  <span>Gmail</span>
                                </button>
                                <button
                                  onClick={() => handleCopy(email)}
                                  className="p-1 rounded text-slate-400 hover:text-sky-500"
                                  title="Copy clean email"
                                >
                                  {copiedEmail === email ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Auto-Sync Notification & Action Banner */}
                    {!isCurrentSiteExcluded && analysis && analysis.visibleEmails.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Auto-Added to CRM Dashboard!
                          </div>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            All {analysis.visibleEmails.length} visible emails from <strong>{analysis.websiteName}</strong> were automatically ingested without manual copy-pasting.
                          </p>
                        </div>

                        {/* Direct Website Filter Jump Button */}
                        <button
                          onClick={handleViewInDashboardFiltered}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>View in Dashboard (Filtered by {analysis?.websiteName})</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Bypassed Hidden Decoys */}
                {activeInspectorTab === 'bypassed' && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Bypassed Hidden Elements:</span>
                      <span className="text-[10px] text-rose-500 font-bold">Spam Traps Ignored</span>
                    </div>

                    {(!analysis || analysis.hiddenEmailsBypassed.length === 0) ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        No hidden emails found on this page. Switch to the "Honeypot Trap Testbed" preset to test hidden element bypass!
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {analysis.hiddenEmailsBypassed.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60"
                          >
                            <div className="text-xs font-semibold text-rose-900 dark:text-rose-200 font-mono truncate">
                              {item.email}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                              <ShieldAlert className="w-3 h-3 shrink-0" />
                              <span className="font-medium">Reason: {item.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OUTBOUND LINKS GRABBER */}
            {activePopupTab === 'outbound' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Outbound Links ({outboundLinks.length}):
                  </span>
                  <button
                    onClick={() => {
                      if (outboundLinks.length === 0) return;
                      const csv = generateOutboundLinksCsv(outboundLinks, customUrl);
                      downloadCsvFile(csv, `outbound-links-${new Date().toISOString().split('T')[0]}.csv`);
                    }}
                    disabled={outboundLinks.length === 0}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Export CSV
                  </button>
                </div>

                {/* Filter / Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={outboundSearchQuery}
                    onChange={(e) => setOutboundSearchQuery(e.target.value)}
                    placeholder="Search domain, anchor text, or URL..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* Link list */}
                {filteredOutboundLinks.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    {outboundLinks.length === 0
                      ? 'No outbound external links found on this page (all links are internal).'
                      : 'No outbound links match your search filter.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredOutboundLinks.map((link, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                          link.isExcluded
                            ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {link.domain}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {link.isExcluded && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-semibold">
                                Excluded Site
                              </span>
                            )}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(link.url);
                                setCopiedLinkUrl(link.url);
                                setTimeout(() => setCopiedLinkUrl(null), 1500);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-sky-500"
                              title="Copy URL"
                            >
                              {copiedLinkUrl === link.url ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-sky-500"
                              title="Open link in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Anchor: <span className="text-slate-700 dark:text-slate-300 italic">{link.anchorText || 'None'}</span>
                        </div>
                        <div className="font-mono text-[10px] text-sky-600 dark:text-sky-400 truncate">
                          {link.url}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gmail Outreach Modal */}
      {gmailComposeLead && (
        <GmailComposeModal
          lead={gmailComposeLead}
          emailTemplate={emailTemplate}
          onSendSuccess={(leadId) => {
            setGmailComposeLead(null);
          }}
          onOpenSettings={onOpenSettings}
          onSaveAsDefaultTemplate={onSaveAsDefaultTemplate}
          onClose={() => setGmailComposeLead(null)}
        />
      )}
    </div>
  );
};
