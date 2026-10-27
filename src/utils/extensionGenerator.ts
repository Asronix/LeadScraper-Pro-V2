import JSZip from 'jszip';
import { EXTENSION_ICON_SVG, generateIconPngBase64 } from './extensionIcons.ts';
import type { EmailTemplate, FollowUpTemplate, GoogleSheetSyncConfig } from '../types/index.ts';
import { JERRY_DEFAULT_FOLLOWUP_TEMPLATE } from '../types/index.ts';

export interface ExtensionCodeFiles {
  'manifest.json': string;
  'background.js': string;
  'content.js': string;
  'content.css': string;
  'popup.html': string;
  'popup.js': string;
  'dashboard.html': string;
  'dashboard.js': string;
  'dashboard.css': string;
  'icon.svg': string;
  'README.md': string;
}

export function getExtensionSourceFiles(
  customTemplate?: EmailTemplate,
  customFollowUpTemplate?: FollowUpTemplate,
  googleSheetConfig?: GoogleSheetSyncConfig
): ExtensionCodeFiles {
  const manifest = {
    manifest_version: 3,
    name: 'LeadScrape Pro - Email Hunter & Offline CRM',
    version: '1.4.0',
    description: 'Automatically scrape verified public emails, bypass hidden spam traps, highlight emails in-page, track outreach status, color-code project tags, set follow-up reminders, and manage leads in a 100% offline CRM dashboard.',
    permissions: [
      'activeTab',
      'storage',
      'tabs',
      'scripting',
      'alarms',
      'notifications'
    ],
    host_permissions: [
      '<all_urls>'
    ],
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png'
    },
    options_page: 'dashboard.html',
    options_ui: {
      page: 'dashboard.html',
      open_in_tab: true
    },
    background: {
      service_worker: 'background.js'
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'LeadScrape Pro - Email Hunter',
      default_icon: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png'
      }
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        css: ['content.css'],
        run_at: 'document_idle'
      }
    ],
    web_accessible_resources: [
      {
        resources: [
          'dashboard.html',
          'dashboard.js',
          'dashboard.css',
          'icon16.png',
          'icon48.png',
          'icon128.png',
          'icon.svg'
        ],
        matches: ['<all_urls>']
      }
    ],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+L',
          mac: 'Command+Shift+L'
        },
        description: 'Open LeadScrape Pro popup'
      }
    }
  };

  const backgroundJs = `// LeadScrape Pro - Manifest V3 Background Service Worker
// 100% Offline Background Pipeline - NEVER opens AI Studio, Zero 403 Errors

console.log('[LeadScrape Pro] Offline service worker initialized.');

const DEFAULT_EXCLUDED = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'reddit.com', 'google.com'
];

// Helper to strictly strip mailto: and extract clean domain & brand
function cleanEmail(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^mailto:\\s*/i, '');
  if (str.includes('?')) str = str.split('?')[0];
  str = str.replace(/[.,;:!?)'"\\]}>]+$/, '');
  str = str.replace(/^[<('"{[]+/, '');
  str = str.replace(/^mailto:\\s*/i, '');
  return str.trim().toLowerCase();
}

function extractDomain(input) {
  try {
    const parsed = new URL(input);
    return parsed.hostname.replace(/^www\\./, '').toLowerCase();
  } catch (e) {
    return 'unknown';
  }
}

function extractWebsiteName(url, title) {
  try {
    if (title && title.length > 2 && !title.includes('404')) {
      const parts = title.split(/[-|–—:•]/);
      if (parts[0] && parts[0].trim().length > 1) return parts[0].trim();
    }
    const hostname = new URL(url).hostname.replace(/^www\\./, '');
    const brand = hostname.split('.')[0];
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  } catch (e) {
    return 'Webpage';
  }
}

function isDomainExcluded(domain, list) {
  if (!domain || !list || list.length === 0) return false;
  const d = domain.toLowerCase();
  return list.some(ex => {
    const clean = ex.trim().toLowerCase().replace(/^www\\./, '');
    return d === clean || d.endsWith('.' + clean);
  });
}

// Check for overdue follow-up reminders
function checkReminders() {
  chrome.storage.local.get(['leadsHistory'], (result) => {
    const history = result.leadsHistory || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const dueLeads = history.filter(l => l.followUpDate && l.followUpDate <= todayStr && l.status !== 'converted');

    if (dueLeads.length > 0) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f43f5e' });
    }
  });
}

// Alarm for periodic reminder checks (every 30 mins)
chrome.alarms.create('checkRemindersAlarm', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkRemindersAlarm') {
    checkReminders();
  }
});

// Listen for messages from content script & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LEADS_SCRAPED') {
    const { url, title, emails, hiddenCount, isExcluded } = message.payload;
    const tabId = sender.tab ? sender.tab.id : null;

    if (isExcluded) {
      if (tabId) {
        chrome.action.setBadgeText({ tabId, text: '🚫' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
      }
      sendResponse({ success: true, excluded: true });
      return true;
    }

    // Filter to ensure no 'mailto:' ever enters storage
    const cleanEmails = (emails || [])
      .map(cleanEmail)
      .filter(e => e && e.includes('@'));

    if (tabId) {
      // Update badge counter on the extension icon
      const count = cleanEmails.length;
      chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#0284c7' });
    }

    // Check excluded domains list before persisting
    chrome.storage.local.get(['leadsHistory', 'excludedDomains'], (result) => {
      const history = result.leadsHistory || [];
      const excluded = result.excludedDomains || DEFAULT_EXCLUDED;
      const domain = extractDomain(url);

      if (isDomainExcluded(domain, excluded)) {
        sendResponse({ success: true, excluded: true });
        return;
      }

      const timestamp = new Date().toISOString();
      const websiteName = extractWebsiteName(url, title);

      const newLeads = cleanEmails.map(email => ({
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        email, // strictly clean, no mailto:
        domain,
        websiteName,
        url,
        pageTitle: title,
        discoveredAt: timestamp,
        status: 'uncontacted',
        tags: [],
        notes: ''
      }));

      // Merge avoiding duplicates by email
      const existingEmails = new Set(history.map(l => l.email.toLowerCase()));
      const filteredNew = newLeads.filter(l => !existingEmails.has(l.email.toLowerCase()));

      const updated = [...filteredNew, ...history];
      chrome.storage.local.set({ 
        leadsHistory: updated,
        lastScraped: {
          url,
          websiteName,
          title,
          emails: cleanEmails,
          timestamp
        }
      }, () => {
        sendResponse({ success: true, count: cleanEmails.length, added: filteredNew.length });
      });
    });

    return true; // Keep channel open for async response
  }

  // Open the 100% OFFLINE standalone CRM Dashboard inside the extension
  if (message.type === 'OPEN_DASHBOARD') {
    const filterParam = message.website ? '?filterWebsite=' + encodeURIComponent(message.website) : '';
    const offlineDashboardUrl = chrome.runtime.getURL('dashboard.html') + filterParam;
    chrome.tabs.create({ url: offlineDashboardUrl });
    sendResponse({ success: true, url: offlineDashboardUrl });
    return true;
  }
});
`;

  const contentJs = `// LeadScrape Pro - Content Script (DOM Email Extractor, Outbound Link Grabber & In-Page Highlighter)
(() => {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,24}/gi;
  const DEFAULT_EXCLUDED = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    'reddit.com', 'google.com'
  ];
  let highlightsActive = true;

  // Clean email and strictly strip any 'mailto:' prefix or query params
  function cleanEmail(raw) {
    if (!raw) return '';
    let str = String(raw).trim();
    str = str.replace(/^mailto:\\s*/i, '');
    if (str.includes('?')) str = str.split('?')[0];
    str = str.replace(/[.,;:!?)'"\\]}>]+$/, '');
    str = str.replace(/^[<('"{[]+/, '');
    str = str.replace(/^mailto:\\s*/i, '');
    return str.trim().toLowerCase();
  }

  function isDomainExcluded(domain, list) {
    if (!domain || !list || list.length === 0) return false;
    const d = domain.toLowerCase();
    return list.some(ex => {
      const clean = ex.trim().toLowerCase().replace(/^www\\./, '');
      return d === clean || d.endsWith('.' + clean);
    });
  }

  function isElementVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    
    // Check HTML hidden attributes
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    if (el.tagName === 'INPUT' && el.getAttribute('type') === 'hidden') {
      return false;
    }
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) {
      return false;
    }

    // Check computed styles
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0 ||
      style.clipPath === 'inset(100%)'
    ) {
      return false;
    }

    // Check bounding rect
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && style.overflow === 'hidden') {
      return false;
    }

    // Check parent visibility
    if (el.parentElement && el.parentElement !== document.body) {
      return isElementVisible(el.parentElement);
    }

    return true;
  }

  // Extract all links except in-links (only genuine outbound links)
  function extractOutboundLinks(excludedList) {
    const currentHost = window.location.hostname.replace(/^www\\./, '').toLowerCase();
    const links = [];
    const seen = new Set();
    const anchors = document.querySelectorAll('a[href]');

    anchors.forEach(a => {
      try {
        const rawHref = a.getAttribute('href');
        if (!rawHref) return;
        const trimmed = rawHref.trim();
        if (
          trimmed.startsWith('#') ||
          trimmed.toLowerCase().startsWith('javascript:') ||
          trimmed.toLowerCase().startsWith('mailto:') ||
          trimmed.toLowerCase().startsWith('tel:')
        ) {
          return;
        }

        const url = new URL(a.href, window.location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

        const targetHost = url.hostname.replace(/^www\\./, '').toLowerCase();

        // Discard in-links (same domain or subdomains)
        if (
          targetHost === currentHost ||
          targetHost.endsWith('.' + currentHost) ||
          currentHost.endsWith('.' + targetHost)
        ) {
          return; // internal link
        }

        if (seen.has(url.href)) return;
        seen.add(url.href);

        const isExcluded = isDomainExcluded(targetHost, excludedList || DEFAULT_EXCLUDED);
        const anchorText = (a.textContent || '').trim().replace(/\\s+/g, ' ') || targetHost;

        links.push({
          url: url.href,
          domain: targetHost,
          anchorText,
          isExcluded
        });
      } catch (e) {}
    });

    return links;
  }

  function scrapePageEmails(callback) {
    chrome.storage.local.get(['excludedDomains'], (storageRes) => {
      const excluded = storageRes.excludedDomains || DEFAULT_EXCLUDED;
      const currentHost = window.location.hostname.replace(/^www\\./, '').toLowerCase();
      const isCurrentExcluded = isDomainExcluded(currentHost, excluded);

      const visibleEmails = new Set();
      const hiddenEmails = new Set();
      const textNodesWithEmails = [];

      // Extract outbound links
      const outboundLinks = extractOutboundLinks(excluded);

      if (!isCurrentExcluded) {
        // 1. Walk through all text nodes in body
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName)) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        let currentNode;
        while ((currentNode = walker.nextNode())) {
          const text = currentNode.nodeValue;
          if (text && text.includes('@')) {
            const matches = text.match(EMAIL_REGEX);
            if (matches) {
              const isVisible = isElementVisible(currentNode.parentElement);
              for (const raw of matches) {
                const email = cleanEmail(raw);
                if (!email || !email.includes('@')) continue;
                
                if (isVisible) {
                  visibleEmails.add(email);
                  textNodesWithEmails.push({ node: currentNode, email });
                } else {
                  hiddenEmails.add(email);
                }
              }
            }
          }
        }

        // 2. Also check visible mailto: links (extract clean email only, NO mailto:)
        const mailtoLinks = document.querySelectorAll('a[href^="mailto:" i]');
        mailtoLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const email = cleanEmail(href);
          if (email && email.includes('@')) {
            if (isElementVisible(link)) {
              visibleEmails.add(email);
            } else {
              hiddenEmails.add(email);
            }
          }
        });

        // 3. Highlight visible emails on page
        if (highlightsActive) {
          highlightEmailsInDom(textNodesWithEmails);
        }
      }

      const payload = {
        url: window.location.href,
        title: document.title,
        emails: Array.from(visibleEmails), // clean emails only
        hiddenCount: hiddenEmails.size,
        outboundLinks: outboundLinks,
        isExcluded: isCurrentExcluded
      };

      // Auto-send directly to background service worker for automatic offline storage
      chrome.runtime.sendMessage({
        type: 'LEADS_SCRAPED',
        payload
      });

      if (callback) callback(payload);
    });
  }

  function highlightEmailsInDom(nodes) {
    nodes.forEach(({ node, email }) => {
      const parent = node.parentElement;
      if (!parent || parent.classList.contains('leadscrape-highlight-badge')) return;

      const text = node.nodeValue;
      const index = text.toLowerCase().indexOf(email.toLowerCase());
      if (index === -1) return;

      const before = text.substring(0, index);
      const matched = text.substring(index, index + email.length);
      const after = text.substring(index + email.length);

      const span = document.createElement('mark');
      span.className = 'leadscrape-highlight-badge';
      span.title = 'LeadScrape Pro: Click to copy ' + email;
      span.textContent = matched;
      span.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(email); // copies pure email without mailto:
        span.classList.add('leadscrape-copied');
        setTimeout(() => span.classList.remove('leadscrape-copied'), 1500);
      };

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(span);
      if (after) fragment.appendChild(document.createTextNode(after));

      parent.replaceChild(fragment, node);
    });
  }

  if (document.readyState === 'complete') {
    scrapePageEmails();
  } else {
    window.addEventListener('load', () => scrapePageEmails());
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === 'TRIGGER_RESCRAPE') {
      scrapePageEmails((result) => {
        sendResponse(result);
      });
      return true; // async
    } else if (req.type === 'TOGGLE_HIGHLIGHTS') {
      highlightsActive = req.active;
      document.querySelectorAll('.leadscrape-highlight-badge').forEach(el => {
        el.style.backgroundColor = highlightsActive ? '#fef08a' : 'transparent';
        el.style.border = highlightsActive ? '1px solid #eab308' : 'none';
      });
    return true;
  });

  // Real-time window message bridge with web dashboard
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'LEADSCRAPE_PRO_PING') {
      try {
        chrome.storage.local.get(['leadsHistory'], (res) => {
          window.postMessage({
            type: 'LEADSCRAPE_PRO_PONG',
            installed: true,
            version: '1.4.0',
            leadsCount: (res.leadsHistory || []).length,
            leads: res.leadsHistory || []
          }, '*');
        });
      } catch (e) {}
    } else if (event.data.type === 'LEADSCRAPE_PRO_PUSH_TO_EXTENSION') {
      try {
        const incoming = event.data.leads || [];
        chrome.storage.local.get(['leadsHistory'], (res) => {
          const history = res.leadsHistory || [];
          const existingEmails = new Set(history.map(l => (l.email || '').toLowerCase()));
          const newLeads = incoming.filter(l => !existingEmails.has((l.email || '').toLowerCase()));
          const merged = [...newLeads, ...history];
          chrome.storage.local.set({ leadsHistory: merged }, () => {
            window.postMessage({
              type: 'LEADSCRAPE_PRO_EXTENSION_UPDATED',
              totalLeads: merged.length
            }, '*');
          });
        });
      } catch (e) {}
    }
  });
})();
`;

  const contentCss = `/* LeadScrape Pro - In-Page Email Highlighter Style */
.leadscrape-highlight-badge {
  background: linear-gradient(135deg, #fef08a 0%, #fde047 100%) !important;
  color: #1e293b !important;
  font-weight: 700 !important;
  padding: 1px 5px !important;
  border-radius: 4px !important;
  border: 1px solid #eab308 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
  cursor: pointer !important;
  position: relative !important;
  text-decoration: none !important;
  display: inline-block !important;
  transition: all 0.2s ease !important;
}

.leadscrape-highlight-badge:hover {
  background: #facc15 !important;
  transform: translateY(-1px) scale(1.02) !important;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
}

.leadscrape-highlight-badge.leadscrape-copied::after {
  content: "✓ Email Copied";
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  color: #f8fafc;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  z-index: 999999;
}
`;

  const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LeadScrape Pro - Email Hunter & Link Grabber</title>
  <style>
    * { box-sizing: border-box; }
    body {
      width: 380px;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 14px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #334155;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-img {
      width: 24px;
      height: 24px;
      border-radius: 6px;
    }
    .brand-name {
      font-weight: 800;
      font-size: 14px;
      color: #38bdf8;
      letter-spacing: -0.02em;
    }
    .sync-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 12px;
      background: #064e3b;
      color: #34d399;
      border: 1px solid #059669;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pulse-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #10b981;
    }
    .shortcut-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 8px 10px;
      background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: all 0.2s;
      margin-bottom: 10px;
    }
    .shortcut-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .shortcut-main {
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .shortcut-sub {
      font-size: 9px;
      color: #bae6fd;
      font-weight: 500;
      margin-top: 2px;
    }
    .site-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
    }
    .site-title {
      font-size: 12px;
      font-weight: 700;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .site-url {
      font-size: 10px;
      color: #38bdf8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .excluded-badge {
      display: none;
      background: #78350f;
      color: #fde68a;
      border: 1px solid #d97706;
      font-size: 10px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      margin-top: 6px;
      text-align: center;
    }
    /* Tabs Header */
    .tabs-nav {
      display: flex;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 3px;
      gap: 4px;
      margin-bottom: 10px;
    }
    .tab-btn {
      flex: 1;
      padding: 6px 4px;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: #1e293b;
      color: #38bdf8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .counts-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #334155;
    }
    .count-chip {
      flex: 1;
      background: #0f172a;
      padding: 5px 6px;
      border-radius: 6px;
      text-align: center;
    }
    .count-num { font-size: 13px; font-weight: 800; color: #38bdf8; }
    .count-lbl { font-size: 9px; color: #94a3b8; }
    .email-list, .links-list {
      max-height: 170px;
      overflow-y: auto;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 4px;
      margin-bottom: 10px;
    }
    .email-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-bottom: 1px solid #334155;
      font-size: 11px;
    }
    .email-item:last-child { border-bottom: none; }
    .email-text {
      font-weight: 500;
      color: #f8fafc;
      max-width: 190px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .action-icons {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .mini-btn {
      background: #334155;
      color: #38bdf8;
      border: none;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .mini-btn:hover { background: #475569; }
    .gmail-btn {
      background: #dc2626;
      color: white;
    }
    .gmail-btn:hover { background: #b91c1c; }
    
    /* Outbound links items */
    .link-item {
      padding: 6px 8px;
      border-bottom: 1px solid #334155;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .link-item:last-child { border-bottom: none; }
    .link-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .link-domain {
      font-weight: 700;
      color: #38bdf8;
    }
    .link-anchor {
      font-size: 10px;
      color: #94a3b8;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 250px;
    }
    .link-search-input {
      width: 100%;
      padding: 6px 8px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #fff;
      font-size: 11px;
      margin-bottom: 8px;
    }
    .link-search-input:focus {
      outline: none;
      border-color: #38bdf8;
    }

    .btn-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .btn-secondary {
      background: #334155;
      color: #f1f5f9;
      border: none;
      padding: 7px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .btn-secondary:hover { background: #475569; }
    .btn-success {
      background: #059669;
      color: white;
      border: none;
      padding: 7px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .btn-success:hover { background: #047857; }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      padding: 3px 2px;
    }
    .toast {
      display: none;
      background: #10b981;
      color: white;
      font-size: 11px;
      font-weight: 600;
      padding: 5px;
      border-radius: 6px;
      text-align: center;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <!-- Brand Header -->
  <div class="header">
    <div class="brand-row">
      <img src="icon48.png" alt="Logo" class="logo-img" />
      <span class="brand-name">LeadScrape Pro</span>
    </div>
    <div class="sync-pill">
      <div class="pulse-dot"></div>
      <span>100% Offline Vault</span>
    </div>
  </div>

  <!-- 100% Offline CRM Dashboard Shortcut -->
  <button id="openDashboardBtn" class="shortcut-btn">
    <div class="shortcut-main">
      <span>🚀 Open Offline CRM Dashboard</span>
    </div>
    <div class="shortcut-sub">
      100% Offline • No AI Studio • Zero 403 Errors
    </div>
  </button>

  <!-- Current Website Info -->
  <div class="site-card">
    <div id="websiteName" class="site-title">Detecting active website...</div>
    <div id="websiteUrl" class="site-url">Scanning...</div>
    <div id="excludedWarning" class="excluded-badge">
      ⚠️ Excluded Site (Scanning Bypassed)
    </div>
    <div class="counts-row">
      <div class="count-chip">
        <div id="visibleCount" class="count-num">0</div>
        <div class="count-lbl">Emails</div>
      </div>
      <div class="count-chip">
        <div id="outboundCount" class="count-num" style="color: #a855f7;">0</div>
        <div class="count-lbl">Outbound Links</div>
      </div>
      <div class="count-chip">
        <div id="hiddenCount" class="count-num" style="color: #f87171;">0</div>
        <div class="count-lbl">Traps Bypassed</div>
      </div>
    </div>
  </div>

  <!-- Dual Mode Tabs -->
  <div class="tabs-nav">
    <button id="tabEmailsBtn" class="tab-btn active">📧 Emails (<span id="tabEmailNum">0</span>)</button>
    <button id="tabLinksBtn" class="tab-btn">🔗 Outbound Links (<span id="tabLinksNum">0</span>)</button>
  </div>

  <!-- TAB 1: EMAILS -->
  <div id="tabEmailsContent" class="tab-content active">
    <div id="emailList" class="email-list">
      <div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">
        Scanning page for visible emails...
      </div>
    </div>

    <!-- Quick Batch Actions -->
    <div class="btn-row">
      <button id="copyAllBtn" class="btn-secondary">📋 Copy All</button>
      <button id="exportCsvBtn" class="btn-secondary">📥 Export CSV</button>
    </div>
    <button id="markAllOutreachedBtn" class="btn-success" style="width: 100%; margin-bottom: 6px;">
      ✓ Mark All Site Leads Outreached
    </button>
    
    <div class="toggle-row">
      <span>In-Page Email Highlighting</span>
      <input type="checkbox" id="highlightToggle" checked style="cursor: pointer;" />
    </div>
  </div>

  <!-- TAB 2: OUTBOUND LINKS GRABBER -->
  <div id="tabLinksContent" class="tab-content">
    <input type="text" id="linkSearchInput" placeholder="Filter by domain or anchor text..." class="link-search-input" />
    <div id="linksList" class="links-list">
      <div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">
        Extracting outbound external links...
      </div>
    </div>
    <div class="btn-row">
      <button id="copyAllLinksBtn" class="btn-secondary">📋 Copy Links</button>
      <button id="exportLinksCsvBtn" class="btn-secondary">📥 Export Links CSV</button>
    </div>
  </div>

  <div id="toast" class="toast">Copied to clipboard!</div>

  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `document.addEventListener('DOMContentLoaded', () => {
  const websiteNameEl = document.getElementById('websiteName');
  const websiteUrlEl = document.getElementById('websiteUrl');
  const visibleCountEl = document.getElementById('visibleCount');
  const outboundCountEl = document.getElementById('outboundCount');
  const hiddenCountEl = document.getElementById('hiddenCount');
  const tabEmailNum = document.getElementById('tabEmailNum');
  const tabLinksNum = document.getElementById('tabLinksNum');
  const emailListEl = document.getElementById('emailList');
  const linksListEl = document.getElementById('linksList');
  const excludedWarningEl = document.getElementById('excludedWarning');
  const linkSearchInput = document.getElementById('linkSearchInput');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const markAllOutreachedBtn = document.getElementById('markAllOutreachedBtn');
  const copyAllLinksBtn = document.getElementById('copyAllLinksBtn');
  const exportLinksCsvBtn = document.getElementById('exportLinksCsvBtn');
  const highlightToggle = document.getElementById('highlightToggle');
  const toastEl = document.getElementById('toast');

  const tabEmailsBtn = document.getElementById('tabEmailsBtn');
  const tabLinksBtn = document.getElementById('tabLinksBtn');
  const tabEmailsContent = document.getElementById('tabEmailsContent');
  const tabLinksContent = document.getElementById('tabLinksContent');

  let currentEmails = [];
  let currentOutboundLinks = [];
  let currentSiteName = 'Webpage';
  let currentUrl = '';

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    setTimeout(() => { toastEl.style.display = 'none'; }, 2000);
  }

  function cleanEmail(raw) {
    if (!raw) return '';
    let str = String(raw).trim();
    str = str.replace(/^mailto:\\s*/i, '');
    if (str.includes('?')) str = str.split('?')[0];
    str = str.replace(/[.,;:!?)'"\\]}>]+$/, '');
    str = str.replace(/^[<('"{[]+/, '');
    str = str.replace(/^mailto:\\s*/i, '');
    return str.trim().toLowerCase();
  }

  // Tab switching
  tabEmailsBtn.addEventListener('click', () => {
    tabEmailsBtn.classList.add('active');
    tabLinksBtn.classList.remove('active');
    tabEmailsContent.classList.add('active');
    tabLinksContent.classList.remove('active');
  });

  tabLinksBtn.addEventListener('click', () => {
    tabLinksBtn.classList.add('active');
    tabEmailsBtn.classList.remove('active');
    tabLinksContent.classList.add('active');
    tabEmailsContent.classList.remove('active');
  });

  // JERRY'S GMAIL COLLABORATION OUTREACH HELPER
  function openJerryGmailCompose(email) {
    const cleanTo = cleanEmail(email);
    const subject = encodeURIComponent('Guest Article & Content Collaboration');
    const siteLinkDisplay = currentUrl ? \`\${currentSiteName} (\${currentUrl})\` : currentSiteName;

    const rawBody = \`Hi,

I’m Jerry from Sustainable Growth Experts. We’re currently looking to collaborate with reputable health and medical websites through guest articles or relevant contextual mentions in existing content on \${siteLinkDisplay}.

We can provide:

  - Original, high-quality content written with medical accuracy
  - Content tailored to your audience, tone, and editorial guidelines

If you’re open to collaborations, we’d be happy to review your guidelines and requirements.

Looking forward to hearing from you and exploring a potential collaboration.

Best regards,
Jerry
Sustainable Growth Experts\`;

    const composeUrl = \`https://mail.google.com/mail/?view=cm&fs=1&to=\${encodeURIComponent(cleanTo)}&su=\${subject}&body=\${encodeURIComponent(rawBody)}\`;
    chrome.tabs.create({ url: composeUrl });

    // Automatically mark lead as outreached in local storage
    chrome.storage.local.get(['leadsHistory'], (res) => {
      const history = res.leadsHistory || [];
      const nowIso = new Date().toISOString();
      const updated = history.map(item => {
        if (item.email.toLowerCase() === cleanTo.toLowerCase()) {
          return { ...item, status: 'outreached', outreachedAt: nowIso };
        }
        return item;
      });
      chrome.storage.local.set({ leadsHistory: updated }, () => {
        showToast('Marked ' + cleanTo + ' as Outreached!');
      });
    });
  }

  function renderEmails(emails) {
    currentEmails = (emails || []).map(cleanEmail).filter(e => e && e.includes('@'));
    visibleCountEl.textContent = currentEmails.length;
    tabEmailNum.textContent = currentEmails.length;

    if (currentEmails.length === 0) {
      emailListEl.innerHTML = '<div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">No visible public emails found on this webpage.</div>';
      return;
    }

    emailListEl.innerHTML = currentEmails.map(email => \`
      <div class="email-item">
        <span class="email-text" title="\${email}">\${email}</span>
        <div class="action-icons">
          <button class="mini-btn gmail-btn send-gmail-btn" data-email="\${email}" title="Send Jerry's Outreach with Gmail">✉️ Gmail</button>
          <button class="mini-btn copy-btn" data-email="\${email}">Copy</button>
        </div>
      </div>
    \`).join('');

    emailListEl.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        navigator.clipboard.writeText(email);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });

    emailListEl.querySelectorAll('.send-gmail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        openJerryGmailCompose(email);
      });
    });
  }

  function renderOutboundLinks(links) {
    currentOutboundLinks = links || [];
    outboundCountEl.textContent = currentOutboundLinks.length;
    tabLinksNum.textContent = currentOutboundLinks.length;

    const query = (linkSearchInput.value || '').toLowerCase().trim();
    const filtered = currentOutboundLinks.filter(l => 
      !query || 
      l.domain.toLowerCase().includes(query) || 
      (l.anchorText || '').toLowerCase().includes(query) ||
      l.url.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      linksListEl.innerHTML = '<div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">' + 
        (currentOutboundLinks.length === 0 ? 'No external outbound links found on this page.' : 'No links match your filter.') +
        '</div>';
      return;
    }

    linksListEl.innerHTML = filtered.map(link => \`
      <div class="link-item">
        <div class="link-top-row">
          <span class="link-domain">\${link.domain}</span>
          <div class="action-icons">
            <button class="mini-btn copy-link-btn" data-url="\${link.url}">Copy</button>
            <button class="mini-btn open-link-btn" data-url="\${link.url}">↗</button>
          </div>
        </div>
        <div class="link-anchor" title="\${link.anchorText || 'No anchor text'}">
          Anchor: \${link.anchorText || 'None'}
        </div>
      </div>
    \`).join('');

    linksListEl.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        navigator.clipboard.writeText(url);
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });

    linksListEl.querySelectorAll('.open-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        chrome.tabs.create({ url });
      });
    });
  }

  linkSearchInput.addEventListener('input', () => {
    renderOutboundLinks(currentOutboundLinks);
  });

  function scanTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || !activeTab.url) return;

      currentUrl = activeTab.url;
      websiteUrlEl.textContent = activeTab.url;

      try {
        const host = new URL(activeTab.url).hostname.replace(/^www\\./, '');
        currentSiteName = host.split('.')[0];
        currentSiteName = currentSiteName.charAt(0).toUpperCase() + currentSiteName.slice(1);
        if (activeTab.title) {
          const parts = activeTab.title.split(/[-|–—:•]/);
          if (parts[0] && parts[0].trim().length > 1) currentSiteName = parts[0].trim();
        }
      } catch (e) {
        currentSiteName = 'Website';
      }

      websiteNameEl.textContent = currentSiteName;

      chrome.tabs.sendMessage(activeTab.id, { type: 'TRIGGER_RESCRAPE' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          emailListEl.innerHTML = '<div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">Browse to any live website to automatically collect leads.</div>';
          linksListEl.innerHTML = '<div style="color: #94a3b8; font-size: 11px; text-align: center; padding: 16px;">Browse to any live website to extract outbound links.</div>';
        } else {
          if (response.isExcluded) {
            excludedWarningEl.style.display = 'block';
          } else {
            excludedWarningEl.style.display = 'none';
          }

          hiddenCountEl.textContent = response.hiddenCount || 0;
          renderEmails(response.emails);
          renderOutboundLinks(response.outboundLinks);
        }
      });
    });
  }

  // 100% OFFLINE DASHBOARD SHORTCUT:
  // Opens chrome-extension://<id>/dashboard.html directly.
  openDashboardBtn.addEventListener('click', () => {
    const filterParam = currentSiteName && currentSiteName !== 'Webpage' 
      ? '?filterWebsite=' + encodeURIComponent(currentSiteName) 
      : '';
    const offlineUrl = chrome.runtime.getURL('dashboard.html') + filterParam;
    chrome.tabs.create({ url: offlineUrl });
  });

  // Copy all (pure clean emails, comma-separated, strictly no mailto:)
  copyAllBtn.addEventListener('click', () => {
    if (currentEmails.length === 0) return;
    const cleanList = currentEmails.join(', ');
    navigator.clipboard.writeText(cleanList);
    showToast('Copied ' + currentEmails.length + ' emails!');
  });

  // Export current tab leads to CSV (strictly clean, no mailto:)
  exportCsvBtn.addEventListener('click', () => {
    if (currentEmails.length === 0) return alert('No emails to export');
    const header = '"Email","Website Name","URL"\\r\\n';
    const rows = currentEmails.map(e => \`"\${cleanEmail(e)}","\${currentSiteName}","\${currentUrl}"\`).join('\\r\\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`leads-\${currentSiteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv\`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Export Outbound Links to CSV
  exportLinksCsvBtn.addEventListener('click', () => {
    if (currentOutboundLinks.length === 0) return alert('No outbound links to export');
    const header = '"Domain","Anchor Text","Target URL","Source URL"\\r\\n';
    const rows = currentOutboundLinks.map(l => {
      const d = (l.domain || '').replace(/"/g, '""');
      const aText = (l.anchorText || '').replace(/"/g, '""');
      const u = (l.url || '').replace(/"/g, '""');
      return \`"\${d}","\${aText}","\${u}","\${currentUrl}"\`;
    }).join('\\r\\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`outbound-links-\${currentSiteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv\`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported ' + currentOutboundLinks.length + ' outbound links to CSV');
  });

  // Copy all links
  copyAllLinksBtn.addEventListener('click', () => {
    if (currentOutboundLinks.length === 0) return;
    const urls = currentOutboundLinks.map(l => l.url).join('\\n');
    navigator.clipboard.writeText(urls);
    showToast('Copied ' + currentOutboundLinks.length + ' links!');
  });

  // Mark all on page as outreached
  markAllOutreachedBtn.addEventListener('click', () => {
    if (currentEmails.length === 0) return;
    chrome.storage.local.get(['leadsHistory'], (res) => {
      const history = res.leadsHistory || [];
      const emailSet = new Set(currentEmails.map(e => e.toLowerCase()));
      const nowIso = new Date().toISOString();

      const updated = history.map(item => {
        if (emailSet.has(item.email.toLowerCase())) {
          return { ...item, status: 'outreached', outreachedAt: nowIso };
        }
        return item;
      });

      chrome.storage.local.set({ leadsHistory: updated }, () => {
        showToast('Marked ' + currentEmails.length + ' leads outreached!');
      });
    });
  });

  // Toggle in-page highlights
  highlightToggle.addEventListener('change', (e) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_HIGHLIGHTS',
          active: e.target.checked
        });
      }
    });
  });

  scanTab();
});
`;

  // FULL STANDALONE OFFLINE DASHBOARD HTML BUNDLED IN EXTENSION
  const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeadScrape Pro - Offline Lead CRM</title>
  <link rel="stylesheet" href="dashboard.css">
</head>
<body class="dark-theme">
  <!-- Top Navigation Header -->
  <header class="app-header">
    <div class="header-left">
      <div class="logo-badge">
        <img src="icon48.png" alt="LeadScrape Logo" class="brand-logo" />
        <div>
          <div class="brand-title">LeadScrape <span class="highlight">Pro</span></div>
          <div class="brand-subtitle">100% Offline Prospect CRM • chrome-extension://</div>
        </div>
      </div>
      <div class="offline-pill" title="Running 100% locally in your Chrome extension without AI Studio or internet connection">
        <span class="status-dot"></span>
        <span>100% Offline Active</span>
      </div>
    </div>

    <div class="header-right">
      <button id="themeToggleBtn" class="btn-secondary" title="Toggle Dark/Light Mode">🌙 Theme</button>
      <button id="addLeadBtn" class="btn-secondary">+ Add Lead</button>
      <button id="importCsvBtn" class="btn-secondary" title="Import Leads from CSV file">📥 Import CSV</button>
      <button id="excludedSitesBtn" class="btn-secondary" title="Excluded Sites / Blacklist">🛡️ Excluded Sites</button>
      <button id="settingsBtn" class="btn-secondary" title="Edit Outreach Email Template">⚙️ Settings</button>
      <button id="backupBtn" class="btn-secondary" title="Export or Import JSON Backup">💾 Backup/Sync</button>
      <button id="exportCsvBtn" class="btn-primary" title="Export leads to CSV">📥 Export CSV</button>
    </div>
  </header>

  <!-- Google Sheets Live Auto-Sync Banner -->
  <div class="gsheet-sync-bar" id="gsheetSyncBar">
    <div class="gsheet-left">
      <div class="gsheet-badge-icon">📊</div>
      <div>
        <div class="gsheet-heading">
          <span>Google Sheets Live Auto-Sync</span>
          <span id="gsheetStatusBadge" class="status-pill status-connected">● Active Mirror</span>
        </div>
        <p class="gsheet-subtext">
          All leads auto-scraped & saved are mirrored simultaneously to your Google Sheet spreadsheet.
          <span id="gsheetLastSyncedDisplay" style="margin-left: 8px; color: #94a3b8;"></span>
        </p>
      </div>
    </div>
    <div class="gsheet-right">
      <a id="openGSheetBtn" href="#" target="_blank" rel="noopener noreferrer" class="btn-sheet-link">
        📊 Open Google Sheet ↗
      </a>
      <button id="settingsGSheetBtn" class="btn-secondary">⚙️ Sheets Config</button>
    </div>
  </div>

  <!-- Offline Notice Banner -->
  <div class="offline-alert-banner">
    <div class="banner-content">
      <span class="banner-badge">OFFLINE VAULT</span>
      <span class="banner-text">All emails you browse are automatically added here and filtered by website. Runs 100% offline with zero 403 errors and no manual copy-pasting.</span>
    </div>
    <button id="markFilteredOutreachedBtn" class="btn-mini-success">✓ Mark All Filtered Outreached</button>
  </div>

  <!-- Main Container -->
  <main class="main-container">
    <!-- Metrics Cards Grid -->
    <section class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">TOTAL LEADS CAPTURED</div>
        <div class="metric-value-row">
          <span id="metricTotal" class="metric-number">0</span>
          <span class="metric-unit">emails</span>
        </div>
        <div class="metric-footer" id="metricDomains">Across 0 domains</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">OUTREACH CONVERSION</div>
        <div class="metric-value-row">
          <span id="metricOutreached" class="metric-number text-success">0</span>
          <span id="metricRate" class="metric-rate">(0%)</span>
        </div>
        <div class="progress-bar-bg">
          <div id="metricProgressBar" class="progress-bar-fill" style="width: 0%;"></div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-label">FOLLOW-UP REMINDERS</div>
        <div class="metric-value-row">
          <span id="metricReminders" class="metric-number text-danger">0</span>
          <span class="metric-unit">due/overdue</span>
        </div>
        <div class="metric-footer">
          <button id="filterDueBtn" class="btn-link">Show Due Reminders</button>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-label">PROJECT TAGS</div>
        <div class="metric-value-row">
          <span id="metricTags" class="metric-number text-info">5</span>
          <span class="metric-unit">categories</span>
        </div>
        <div class="metric-footer">
          <button id="manageTagsBtn" class="btn-link">+ Manage Color Tags</button>
        </div>
      </div>
    </section>

    <!-- Toolbar: Search, Filters & Website Chips -->
    <section class="toolbar-card">
      <div class="search-row">
        <input type="text" id="searchInput" placeholder="Search by email, brand, domain, tags, or notes..." class="search-input" />
        
        <select id="domainSelect" class="filter-select">
          <option value="all">All Domains</option>
        </select>

        <select id="statusSelect" class="filter-select">
          <option value="all">All Outreach Statuses</option>
          <option value="uncontacted">⚪ Uncontacted</option>
          <option value="outreached">🟢 Outreached</option>
          <option value="replied">🔵 Replied</option>
          <option value="converted">⭐ Converted</option>
        </select>

        <select id="tagSelect" class="filter-select">
          <option value="all">All Tags</option>
        </select>

        <select id="sortSelect" class="filter-select">
          <option value="newest">Newest Scraped</option>
          <option value="oldest">Oldest Scraped</option>
          <option value="email">Email (A-Z)</option>
          <option value="website">Website (A-Z)</option>
        </select>
      </div>

      <!-- Website Filter Chips (Auto-Grouping) -->
      <div class="website-chips-container">
        <span class="chips-label">FILTER BY WEBSITE:</span>
        <div id="websiteChipsList" class="website-chips-row">
          <button class="site-chip active" data-site="all">All Websites (0)</button>
        </div>
      </div>
    </section>

    <!-- Bulk Action Toolbar -->
    <div id="bulkActionBar" class="bulk-toolbar" style="display: none;">
      <div class="bulk-group-left">
        <span id="bulkSelectedText" class="bulk-count">0 of 0 selected</span>
        <button id="bulkSelectAllActionBtn" class="btn-text-link">Select all</button>
        <span class="bulk-dot">•</span>
        <button id="bulkSelectUncontactedBtn" class="btn-text-link">Uncontacted only</button>
        <span class="bulk-dot">•</span>
        <button id="bulkSelectOutreachedBtn" class="btn-text-link" style="color: #f59e0b; font-weight: 700;">Outreached only</button>
        <span class="bulk-dot">•</span>
        <button id="bulkDeselectBtn" class="btn-text-link" style="color: #94a3b8;">Deselect</button>
      </div>
      <div class="bulk-group-right">
        <button id="bulkQuickFollowUpBtn" class="btn-bulk-amber">
          ⚡ Bulk Quick Follow-up (<span class="bulk-counter">0</span>)
        </button>
        <button id="bulkSequencerBtn" class="btn-bulk-indigo">
          ⚡ Bulk Sequencer (<span class="bulk-counter">0</span>)
        </button>
        <button id="bulkMarkOutreachedBtn" class="btn-bulk-emerald">
          ✓ Mark Outreached
        </button>
        <button id="bulkDeleteBtn" class="btn-bulk-danger">
          🗑️ Bulk Delete (<span class="bulk-counter">0</span>)
        </button>
      </div>
    </div>

    <!-- Leads Table Card -->
    <section class="table-card">
      <div class="table-header-row">
        <div class="col-checkbox"><input type="checkbox" id="selectAllCheckbox" title="Select all leads" /></div>
        <div class="col-email">EMAIL & LEAD</div>
        <div class="col-website">WEBSITE & URL</div>
        <div class="col-tags">PROJECT TAGS</div>
        <div class="col-reminder">FOLLOW-UP</div>
        <div class="col-status">OUTREACH</div>
        <div class="col-actions">ACTIONS</div>
      </div>

      <div id="leadsTableBody" class="table-body">
        <div class="empty-state">Loading leads from local extension storage...</div>
      </div>
    </section>
  </main>

  <!-- Add Lead Modal -->
  <div id="addLeadModal" class="modal-overlay" style="display: none;">
    <div class="modal-box">
      <div class="modal-header">
        <h3>+ Add Lead Manually</h3>
        <button class="close-modal-btn" data-close="addLeadModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Email Address *</label>
          <input type="email" id="newLeadEmail" placeholder="contact@example.com" class="form-input" />
        </div>
        <div class="form-group">
          <label>Website Name</label>
          <input type="text" id="newLeadWebsite" placeholder="e.g. Acme Corp" class="form-input" />
        </div>
        <div class="form-group">
          <label>Webpage URL</label>
          <input type="url" id="newLeadUrl" placeholder="https://example.com/team" class="form-input" />
        </div>
        <div class="form-group">
          <label>Notes / Context</label>
          <textarea id="newLeadNotes" placeholder="Met at conference / Outreach message..." class="form-textarea" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="addLeadModal">Cancel</button>
        <button id="saveNewLeadBtn" class="btn-primary">Save Lead</button>
      </div>
    </div>
  </div>

  <!-- Tag Management Modal -->
  <div id="tagModal" class="modal-overlay" style="display: none;">
    <div class="modal-box">
      <div class="modal-header">
        <h3>Manage Project Tags</h3>
        <button class="close-modal-btn" data-close="tagModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="tags-list" id="modalTagsList"></div>
        <div class="form-row-add-tag">
          <input type="text" id="newTagName" placeholder="New tag name (e.g. Q4 Target)" class="form-input" />
          <input type="color" id="newTagColor" value="#0284c7" class="color-picker" />
          <button id="createTagBtn" class="btn-primary">Add Tag</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="tagModal">Done</button>
      </div>
    </div>
  </div>

  <!-- Backup & Offline Sync Modal -->
  <div id="backupModal" class="modal-overlay" style="display: none;">
    <div class="modal-box">
      <div class="modal-header">
        <h3>Offline Backup & Cross-Device Sync</h3>
        <button class="close-modal-btn" data-close="backupModal">&times;</button>
      </div>
      <div class="modal-body space-y-4">
        <p class="modal-desc">Transfer leads across computers or back up your data completely offline without cloud servers.</p>
        <div class="backup-actions-grid">
          <div class="backup-card">
            <h4>Export JSON Backup</h4>
            <p>Save all captured leads, tags, and outreach status to a downloadable file.</p>
            <button id="downloadBackupBtn" class="btn-primary">📥 Download Backup JSON</button>
          </div>
          <div class="backup-card">
            <h4>Import JSON Backup</h4>
            <p>Restore leads from an existing JSON backup file.</p>
            <input type="file" id="importBackupInput" accept=".json" style="display: none;" />
            <button id="triggerImportBtn" class="btn-secondary">📂 Select JSON to Import</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="backupModal">Close</button>
      </div>
    </div>
  </div>

  <!-- Import CSV Modal -->
  <div id="importCsvModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 540px;">
      <div class="modal-header">
        <h3>📥 Import Leads from CSV</h3>
        <button class="close-modal-btn" data-close="importCsvModal">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-desc" style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
          Import leads from any CSV file or paste raw CSV text. Automatically detects email column, extracts domains, strips <code>mailto:</code>, and prevents duplicate imports.
        </p>

        <div style="border: 2px dashed #334155; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 12px; background: rgba(30, 41, 59, 0.4);">
          <input type="file" id="csvFileInput" accept=".csv,text/csv" style="display: none;" />
          <button id="triggerCsvFileBtn" class="btn-secondary" style="margin-bottom: 6px;">📂 Choose CSV File</button>
          <div id="csvFileNameDisplay" style="font-size: 11px; color: #94a3b8;">or paste CSV text below</div>
        </div>

        <div class="form-group">
          <label>Raw CSV Content</label>
          <textarea id="csvRawText" placeholder="email,website,url&#10;contact@example.com,Example Corp,https://example.com" class="form-textarea" rows="4"></textarea>
        </div>

        <div class="form-group">
          <label>Apply Project Tag (Optional)</label>
          <select id="importTagSelect" class="form-input">
            <option value="">No tag</option>
          </select>
        </div>

        <div id="importSummaryCard" style="display: none; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px; font-size: 11px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Detected: <b id="importSummaryTotal" class="text-info">0</b></span>
            <span>New Valid: <b id="importSummaryValid" class="text-success">0</b></span>
            <span>Duplicates: <b id="importSummaryDupes" style="color: #fbbf24;">0</b></span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="importCsvModal">Cancel</button>
        <button id="confirmImportCsvBtn" class="btn-primary" disabled>Import 0 Leads</button>
      </div>
    </div>
  </div>

  <!-- Excluded Sites Modal -->
  <div id="excludedSitesModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-header">
        <h3>🛡️ Excluded Sites / Blacklist</h3>
        <button class="close-modal-btn" data-close="excludedSitesModal">&times;</button>
      </div>
      <div class="modal-body">
        <p class="modal-desc" style="font-size: 11px; color: #94a3b8; margin-bottom: 12px;">
          Domains on this list will be bypassed during scanning and link extraction. Common social platforms are pre-populated.
        </p>
        <div class="form-row-add-tag" style="margin-top: 0; margin-bottom: 12px;">
          <input type="text" id="newExcludeDomainInput" placeholder="e.g. competitor.com or portal.org" class="form-input" style="flex: 1;" />
          <button id="addExcludeDomainBtn" class="btn-primary">+ Add Domain</button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">CURRENTLY EXCLUDED (<span id="excludeCountSpan">0</span>)</span>
          <button id="resetExcludeDefaultsBtn" class="btn-link" style="font-size: 11px;">Reset to Defaults</button>
        </div>
        <div id="excludedDomainsList" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow-y: auto; padding: 4px; background: rgba(30, 41, 59, 0.4); border-radius: 6px; border: 1px solid #334155;">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="excludedSitesModal">Done</button>
      </div>
    </div>
  </div>

  <!-- Gmail Compose / Outreach Preview Modal -->
  <div id="gmailModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 560px;">
      <div class="modal-header">
        <h3>✉️ Guest Article & Content Collaboration</h3>
        <button class="close-modal-btn" data-close="gmailModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Recipient Email</label>
          <input type="email" id="gmailRecipient" class="form-input" readonly />
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input type="text" id="gmailSubject" class="form-input" value="Guest Article & Content Collaboration" />
        </div>
        <div class="form-group">
          <label>Email Body (Jerry / Sustainable Growth Experts)</label>
          <textarea id="gmailBody" class="form-textarea" rows="10" style="font-family: monospace; font-size: 11px;"></textarea>
        </div>
        <div style="margin-top: 6px;">
          <button type="button" id="editTemplateFromGmailBtn" class="btn-link" style="font-size: 11px; color: #38bdf8;">⚙️ Edit Default Template in Settings</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="gmailModal">Cancel</button>
        <button id="launchGmailBtn" class="btn-primary" style="background: #ea4335;">🚀 Open in Gmail Web Compose</button>
      </div>
    </div>
  </div>

  <!-- Quick Follow-up Modal -->
  <div id="quickFollowUpModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 580px;">
      <div class="modal-header">
        <h3 style="color: #f59e0b;">⚡ Quick Follow-up Outreach</h3>
        <button class="close-modal-btn" data-close="quickFollowUpModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Recipient Email</label>
          <input type="email" id="followUpRecipient" class="form-input" readonly />
        </div>
        <div class="form-group">
          <label>Subject Line</label>
          <input type="text" id="followUpSubject" class="form-input" />
        </div>
        <div class="form-group">
          <label>Follow-up Message (Jerry / Sustainable Growth Experts)</label>
          <textarea id="followUpBody" class="form-textarea" rows="9" style="font-family: monospace; font-size: 11px;"></textarea>
        </div>
        <div style="margin-top: 6px;">
          <button type="button" id="editFollowUpTemplateBtn" class="btn-link" style="font-size: 11px; color: #f59e0b;">⚙️ Edit Follow-up Template in Settings</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="quickFollowUpModal">Cancel</button>
        <a id="launchFollowUpGmailLink" href="#" target="_blank" rel="noopener noreferrer" class="btn-primary" style="background: #ea580c; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          🚀 Open Follow-up in Gmail Web Compose ↗
        </a>
      </div>
    </div>
  </div>

  <!-- Bulk Sequencer Modal -->
  <div id="bulkSequencerModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 620px;">
      <div class="modal-header">
        <h3 id="seqModalTitle">⚡ Step-by-Step Gmail Sequencer</h3>
        <button class="close-modal-btn" data-close="bulkSequencerModal">&times;</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 8px 12px; border-radius: 8px; font-size: 11px;">
          <span>Prospect <strong id="seqCurrentIdx">1</strong> of <strong id="seqTotalCount">1</strong></span>
          <span id="seqStepBadge" style="padding: 2px 10px; border-radius: 12px; font-weight: 700; background: #0284c7; color: white;">Step 1: Initial Pitch</span>
        </div>
        <div class="form-group">
          <label>Prospect Email</label>
          <input type="text" id="seqRecipient" class="form-input" readonly />
        </div>
        <div class="form-group">
          <label>Website / Brand</label>
          <input type="text" id="seqWebsite" class="form-input" readonly />
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input type="text" id="seqSubject" class="form-input" />
        </div>
        <div class="form-group">
          <label>Draft Email</label>
          <textarea id="seqBody" class="form-textarea" rows="8" style="font-family: monospace; font-size: 11px;"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" id="seqPrevBtn" class="btn-secondary">◀ Previous</button>
        <div style="display: flex; gap: 8px;">
          <a id="seqLaunchGmailLink" href="#" target="_blank" rel="noopener noreferrer" class="btn-primary" style="background: #ea4335; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            🚀 Open in Gmail Web Compose ↗
          </a>
          <button type="button" id="seqNextBtn" class="btn-primary">Next Prospect ▶</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Bulk Delete Confirm Modal -->
  <div id="bulkDeleteConfirmModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 440px;">
      <div class="modal-header">
        <h3 style="color: #f43f5e;">🗑️ Bulk Delete Selected Leads?</h3>
        <button class="close-modal-btn" data-close="bulkDeleteConfirmModal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px;">
          You are about to delete <strong id="deleteCountDisplay" style="color: #f43f5e;">0</strong> selected leads permanently from your local offline CRM.
        </p>
        <div style="background: rgba(225, 29, 72, 0.15); border: 1px solid #e11d48; padding: 10px; border-radius: 8px; font-size: 11px; color: #fda4af;">
          ⚠️ This action is permanent and cannot be undone.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-close="bulkDeleteConfirmModal">Cancel</button>
        <button id="confirmBulkDeleteBtn" class="btn-danger" style="background: #e11d48; color: #fff; font-weight: 700; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">Confirm Delete</button>
      </div>
    </div>
  </div>

  <!-- 3-Tab Settings Modal -->
  <div id="settingsModal" class="modal-overlay" style="display: none;">
    <div class="modal-box" style="max-width: 640px;">
      <div class="modal-header">
        <h3>⚙️ CRM & Outreach Settings</h3>
        <button class="close-modal-btn" data-close="settingsModal">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Settings Tabs Header -->
        <div class="settings-tabs-nav" style="display: flex; gap: 4px; border-bottom: 1px solid #334155; margin-bottom: 14px; padding-bottom: 4px;">
          <button type="button" class="tab-btn active" id="tabPitchBtn" data-tab="tabPitch">Initial Pitch</button>
          <button type="button" class="tab-btn" id="tabFollowUpBtn" data-tab="tabFollowUp">Quick Follow-up</button>
          <button type="button" class="tab-btn" id="tabGSheetBtn" data-tab="tabGSheet">Google Sheets Sync</button>
        </div>

        <!-- Tab 1: Initial Pitch -->
        <div id="tabPitchContent" class="tab-panel">
          <div class="form-group">
            <label>Subject Line</label>
            <input type="text" id="settingsSubjectInput" class="form-input" />
          </div>
          <div class="form-group" style="margin-bottom: 6px;">
            <label>Insert Personalization Tag:</label>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsBodyTextarea" data-var="[Site Name and hyperlink to website]" style="font-size: 10px; padding: 2px 6px;">+ [Site Name]</button>
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsBodyTextarea" data-var="{{website}}" style="font-size: 10px; padding: 2px 6px;">+ {{website}}</button>
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsBodyTextarea" data-var="{{url}}" style="font-size: 10px; padding: 2px 6px;">+ {{url}}</button>
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsBodyTextarea" data-var="{{domain}}" style="font-size: 10px; padding: 2px 6px;">+ {{domain}}</button>
            </div>
          </div>
          <div class="form-group">
            <label>Email Body</label>
            <textarea id="settingsBodyTextarea" class="form-textarea" rows="8" style="font-family: monospace; font-size: 11px;"></textarea>
          </div>
        </div>

        <!-- Tab 2: Quick Follow-up -->
        <div id="tabFollowUpContent" class="tab-panel" style="display: none;">
          <div class="form-group">
            <label>Follow-up Subject Line</label>
            <input type="text" id="settingsFollowUpSubjectInput" class="form-input" />
          </div>
          <div class="form-group">
            <label>Default Follow-up Delay (Days)</label>
            <input type="number" id="settingsFollowUpDaysInput" class="form-input" min="1" max="30" value="4" style="max-width: 120px;" />
          </div>
          <div class="form-group" style="margin-bottom: 6px;">
            <label>Insert Personalization Tag:</label>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsFollowUpBodyTextarea" data-var="[Site Name and hyperlink to website]" style="font-size: 10px; padding: 2px 6px;">+ [Site Name]</button>
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsFollowUpBodyTextarea" data-var="{{website}}" style="font-size: 10px; padding: 2px 6px;">+ {{website}}</button>
              <button type="button" class="btn-secondary insert-var-btn" data-target="settingsFollowUpBodyTextarea" data-var="{{url}}" style="font-size: 10px; padding: 2px 6px;">+ {{url}}</button>
            </div>
          </div>
          <div class="form-group">
            <label>Follow-up Body</label>
            <textarea id="settingsFollowUpBodyTextarea" class="form-textarea" rows="8" style="font-family: monospace; font-size: 11px;"></textarea>
          </div>
        </div>

        <!-- Tab 3: Google Sheets Sync -->
        <div id="tabGSheetContent" class="tab-panel" style="display: none;">
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 11px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">📊 Google Sheets Live Auto-Sync</div>
            <div>All leads captured by this extension can be auto-uploaded to your Google Drive spreadsheet in real time.</div>
          </div>
          <div class="form-group">
            <label>Spreadsheet URL / ID</label>
            <input type="text" id="settingsGSheetUrlInput" placeholder="https://docs.google.com/spreadsheets/d/... or ID" class="form-input" />
          </div>
          <div class="form-group">
            <label>Sheet Tab Name</label>
            <input type="text" id="settingsGSheetTabInput" value="Leads" class="form-input" style="max-width: 160px;" />
          </div>
          <div style="margin-top: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="settingsGSheetAutoSyncCheckbox" checked />
              <span>Enable live auto-sync on every newly scraped lead</span>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" id="resetSettingsDefaultBtn" class="btn-link" style="font-size: 11px; color: #38bdf8;">↺ Reset Defaults</button>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary" data-close="settingsModal">Cancel</button>
          <button type="button" id="saveSettingsBtn" class="btn-primary">Save Settings</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast message -->
  <div id="dashboardToast" class="dashboard-toast"></div>

  <script src="dashboard.js"></script>
</body>
</html>
`;

  const dashboardCss = `/* LeadScrape Pro - Standalone Offline CRM Stylesheet */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  transition: background 0.2s, color 0.2s;
  min-height: 100vh;
}
body.dark-theme {
  background: #090d16;
  color: #f1f5f9;
}
body.light-theme {
  background: #f8fafc;
  color: #0f172a;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(15, 23, 42, 0.95);
  border-bottom: 1px solid #1e293b;
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(8px);
}
body.light-theme .app-header {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.logo-badge { display: flex; align-items: center; gap: 10px; }
.brand-logo { width: 34px; height: 34px; border-radius: 8px; }
.brand-title { font-size: 17px; font-weight: 800; }
.highlight { color: #0284c7; }
.brand-subtitle { font-size: 11px; color: #94a3b8; }
.offline-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 14px;
  background: #064e3b;
  color: #34d399;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #059669;
}
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #10b981; }
.header-right { display: flex; align-items: center; gap: 8px; }
.btn-secondary {
  padding: 8px 13px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
body.light-theme .btn-secondary { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
.btn-secondary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-primary {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: #0284c7;
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover { background: #0369a1; transform: translateY(-1px); }

/* Google Sheets Live Auto-Sync Bar */
.gsheet-sync-bar {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.25) 100%);
  border-bottom: 1px solid rgba(16, 185, 129, 0.3);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.gsheet-left { display: flex; align-items: center; gap: 12px; }
.gsheet-badge-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(16, 185, 129, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: 1px solid #10b981;
}
.gsheet-heading { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #f8fafc; }
body.light-theme .gsheet-heading { color: #0f172a; }
.gsheet-subtext { font-size: 11px; color: #94a3b8; margin-top: 2px; }
.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}
.status-pill.status-connected {
  background: #064e3b;
  color: #34d399;
  border: 1px solid #059669;
}
.status-pill.status-disconnected {
  background: #374151;
  color: #9ca3af;
  border: 1px solid #4b5563;
}
.gsheet-right { display: flex; align-items: center; gap: 8px; }
.btn-sheet-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  background: #10b981;
  color: white;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-sheet-link:hover { background: #059669; transform: translateY(-1px); }

.offline-alert-banner {
  background: linear-gradient(90deg, rgba(2, 132, 199, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%);
  border-bottom: 1px solid rgba(2, 132, 199, 0.3);
  padding: 8px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}
.banner-content { display: flex; align-items: center; gap: 8px; }
.banner-badge {
  background: #0284c7;
  color: white;
  font-weight: 800;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.banner-text { color: #cbd5e1; }
body.light-theme .banner-text { color: #334155; }
.btn-mini-success {
  background: #059669;
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.btn-mini-success:hover { background: #047857; }
.main-container { max-width: 1360px; margin: 0 auto; padding: 20px; }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.metric-card {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 10px;
  padding: 16px;
}
body.light-theme .metric-card { background: #ffffff; border-color: #e2e8f0; }
.metric-label { font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: 0.05em; }
.metric-value-row { display: flex; align-items: baseline; gap: 8px; margin: 6px 0; }
.metric-number { font-size: 24px; font-weight: 800; }
.text-success { color: #10b981; }
.text-danger { color: #f43f5e; }
.text-info { color: #38bdf8; }
.metric-unit { font-size: 11px; color: #9ca3af; }
.metric-rate { font-size: 13px; font-weight: 700; color: #10b981; }
.progress-bar-bg { width: 100%; height: 5px; background: #1f2937; border-radius: 4px; overflow: hidden; }
body.light-theme .progress-bar-bg { background: #e2e8f0; }
.progress-bar-fill { height: 100%; background: #10b981; border-radius: 4px; transition: width 0.3s; }
.metric-footer { font-size: 11px; color: #6b7280; }
.btn-link { background: none; border: none; color: #38bdf8; cursor: pointer; padding: 0; font-size: 11px; text-decoration: underline; }
.toolbar-card {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 16px;
}
body.light-theme .toolbar-card { background: #ffffff; border-color: #e2e8f0; }
.search-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.search-input {
  flex: 2;
  min-width: 200px;
  padding: 8px 12px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
}
body.light-theme .search-input { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
.filter-select {
  padding: 8px 10px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
}
body.light-theme .filter-select { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
.website-chips-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-top: 8px;
  border-top: 1px solid #1f2937;
}
body.light-theme .website-chips-container { border-color: #e2e8f0; }
.chips-label { font-size: 10px; font-weight: 800; color: #9ca3af; white-space: nowrap; }
.website-chips-row { display: flex; gap: 6px; flex-wrap: nowrap; overflow-x: auto; }
.site-chip {
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #d1d5db;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
body.light-theme .site-chip { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
.site-chip.active { background: #0284c7; color: white; border-color: #0284c7; }

/* Bulk Action Toolbar */
.bulk-toolbar {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid #0284c7;
  box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  animation: slideDown 0.2s ease-out;
}
@keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.bulk-group-left { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.bulk-count { font-weight: 800; color: #38bdf8; }
.bulk-dot { color: #475569; font-size: 12px; }
.btn-text-link {
  background: none;
  border: none;
  color: #38bdf8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.btn-text-link:hover { color: #7dd3fc; }
.bulk-group-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-bulk-amber {
  background: #d97706;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.btn-bulk-amber:hover { background: #b45309; transform: translateY(-1px); }
.btn-bulk-indigo {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.btn-bulk-indigo:hover { background: #4338ca; transform: translateY(-1px); }
.btn-bulk-emerald {
  background: #059669;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.btn-bulk-emerald:hover { background: #047857; transform: translateY(-1px); }
.btn-bulk-danger {
  background: #e11d48;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.btn-bulk-danger:hover { background: #be123c; transform: translateY(-1px); }

/* Table Structure */
.table-card {
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 10px;
  overflow: hidden;
}
body.light-theme .table-card { background: #ffffff; border-color: #e2e8f0; }
.table-header-row {
  display: grid;
  grid-template-columns: 38px 2fr 1.5fr 1.3fr 1.1fr 1.1fr 175px;
  padding: 10px 14px;
  background: rgba(31, 41, 55, 0.6);
  border-bottom: 1px solid #1f2937;
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  letter-spacing: 0.05em;
  align-items: center;
}
body.light-theme .table-header-row { background: #f1f5f9; border-color: #e2e8f0; }
.table-row {
  display: grid;
  grid-template-columns: 38px 2fr 1.5fr 1.3fr 1.1fr 1.1fr 175px;
  padding: 10px 14px;
  border-bottom: 1px solid #1f2937;
  align-items: center;
  font-size: 12px;
  transition: background 0.15s;
}
body.light-theme .table-row { border-color: #f1f5f9; }
.table-row:hover { background: rgba(31, 41, 55, 0.4); }
body.light-theme .table-row:hover { background: #f8fafc; }
.table-row.selected { background: rgba(2, 132, 199, 0.12) !important; }

.col-checkbox { display: flex; align-items: center; justify-content: center; }
.col-checkbox input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #0284c7; }

.email-text { font-weight: 700; color: #f8fafc; word-break: break-all; }
body.light-theme .email-text { color: #0f172a; }
.site-name-text { font-weight: 700; color: #38bdf8; cursor: pointer; }
.domain-subtext { font-size: 10px; color: #64748b; }
.tags-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.tag-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.btn-add-tag-mini {
  background: #1f2937;
  border: 1px dashed #4b5563;
  color: #9ca3af;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  cursor: pointer;
}
body.light-theme .btn-add-tag-mini { background: #f1f5f9; border-color: #cbd5e1; }
.btn-outreached-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-outreached-toggle.outreached {
  background: #064e3b;
  color: #34d399;
  border: 1px solid #059669;
}
.btn-outreached-toggle.uncontacted {
  background: #1f2937;
  color: #94a3b8;
  border: 1px solid #374151;
}
.reminder-date-input {
  background: #1f2937;
  border: 1px solid #374151;
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
  padding: 3px 6px;
  width: 105px;
}
body.light-theme .reminder-date-input { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
.reminder-overdue { border-color: #f43f5e !important; color: #f43f5e !important; }
.actions-cell { display: flex; gap: 4px; align-items: center; }
.btn-action-icon {
  background: #1f2937;
  color: #38bdf8;
  border: 1px solid #374151;
  border-radius: 4px;
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.btn-action-icon:hover { background: #374151; }
.btn-action-danger { color: #f87171; }
.btn-action-danger:hover { background: #7f1d1d; color: white; }
.btn-action-gmail {
  background: rgba(234, 67, 53, 0.15);
  color: #f87171;
  border: 1px solid rgba(234, 67, 53, 0.35);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s;
}
.btn-action-gmail:hover {
  background: #ea4335;
  color: white;
}

/* Compound Button for Quick Follow-up */
.btn-compound {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.btn-action-followup-main {
  background: #d97706;
  color: white;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-action-followup-main:hover { background: #b45309; }
.btn-action-followup-edit {
  background: #b45309;
  color: #fef3c7;
  padding: 4px 5px;
  font-size: 10px;
  border: none;
  border-left: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-action-followup-edit:hover { background: #92400e; }

.empty-state { text-align: center; padding: 48px; color: #9ca3af; font-size: 13px; }

/* Modal Dialog Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}
.modal-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  padding: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
body.light-theme .modal-box { background: #ffffff; border-color: #cbd5e1; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.modal-header h3 { font-size: 15px; font-weight: 800; }
.close-modal-btn { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px; }
.form-input, .form-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #fff;
  font-size: 12px;
}
body.light-theme .form-input, body.light-theme .form-textarea { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.form-row-add-tag { display: flex; gap: 6px; align-items: center; margin-top: 12px; }
.color-picker { width: 36px; height: 32px; border: none; border-radius: 4px; cursor: pointer; background: transparent; }
.tags-list { display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
.tag-manage-item { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: #1e293b; border-radius: 6px; font-size: 12px; }
body.light-theme .tag-manage-item { background: #f1f5f9; }
.backup-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.backup-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; }
body.light-theme .backup-card { background: #f1f5f9; border-color: #cbd5e1; }
.backup-card h4 { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.backup-card p { font-size: 10px; color: #94a3b8; margin-bottom: 10px; }

/* Settings tabs */
.settings-tabs-nav {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #334155;
  margin-bottom: 14px;
  padding-bottom: 4px;
}
.settings-tabs-nav .tab-btn {
  padding: 7px 14px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.settings-tabs-nav .tab-btn.active {
  background: #1e293b;
  color: #38bdf8;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
body.light-theme .settings-tabs-nav .tab-btn.active {
  background: #e2e8f0;
  color: #0284c7;
}

.dashboard-toast {
  display: none;
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #059669;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 999;
}
@media (max-width: 900px) {
  .table-header-row, .table-row {
    grid-template-columns: 38px 2fr 1.5fr 1fr 120px;
  }
  .col-tags, .col-reminder { display: none; }
}
`;

  const dashboardJs = `// LeadScrape Pro - 100% Offline Standalone Lead CRM Engine
// Running locally inside Chrome Extension (chrome-extension://)
// Synchronized with Google Sheets & Web Dashboard

document.addEventListener('DOMContentLoaded', () => {
  let leads = [];
  let selectedIds = new Set();
  let customTags = [
    { id: 'tag_founder', name: 'Founder / C-Level', color: '#059669' },
    { id: 'tag_marketing', name: 'Marketing / Growth', color: '#0284c7' },
    { id: 'tag_investor', name: 'Investor / VC', color: '#7c3aed' },
    { id: 'tag_priority', name: 'High Priority', color: '#e11d48' },
    { id: 'tag_sales', name: 'Sales Prospect', color: '#0891b2' }
  ];

  const DEFAULT_EXCLUDED = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    'reddit.com', 'google.com'
  ];

  let excludedDomains = [...DEFAULT_EXCLUDED];
  let activeLeadForGmail = null;
  let pendingImportLeads = [];

  const JERRY_TEMPLATE_SUBJECT = ${JSON.stringify(customTemplate?.subject || 'Guest Article & Content Collaboration')};
  const JERRY_TEMPLATE_BODY = ${JSON.stringify(customTemplate?.body || "Hi,\n\nI’m Jerry from Sustainable Growth Experts. We’re currently looking to collaborate with reputable health and medical websites through guest articles or relevant contextual mentions in existing content on [Site Name and hyperlink to website].\n\nWe can provide:\n\n  - Original, high-quality content written with medical accuracy\n  - Content tailored to your audience, tone, and editorial guidelines\n\nIf you’re open to collaborations, we’d be happy to review your guidelines and requirements.\n\nLooking forward to hearing from you and exploring a potential collaboration.\n\nBest regards,\nJerry\nSustainable Growth Experts")};

  let currentEmailTemplate = {
    subject: JERRY_TEMPLATE_SUBJECT,
    body: JERRY_TEMPLATE_BODY
  };

  const DEFAULT_FOLLOWUP_SUBJECT = ${JSON.stringify(customFollowUpTemplate?.subject || JERRY_DEFAULT_FOLLOWUP_TEMPLATE.subject)};
  const DEFAULT_FOLLOWUP_BODY = ${JSON.stringify(customFollowUpTemplate?.body || JERRY_DEFAULT_FOLLOWUP_TEMPLATE.body)};
  const DEFAULT_FOLLOWUP_DAYS = ${customFollowUpTemplate?.defaultDelayDays ?? JERRY_DEFAULT_FOLLOWUP_TEMPLATE.defaultDelayDays ?? 4};

  let currentFollowUpTemplate = {
    subject: DEFAULT_FOLLOWUP_SUBJECT,
    body: DEFAULT_FOLLOWUP_BODY,
    delayDays: DEFAULT_FOLLOWUP_DAYS
  };

  let currentGoogleSheetConfig = {
    spreadsheetId: ${JSON.stringify(googleSheetConfig?.spreadsheetId || '')},
    spreadsheetUrl: ${JSON.stringify(googleSheetConfig?.spreadsheetUrl || '')},
    sheetName: ${JSON.stringify(googleSheetConfig?.sheetName || 'Leads')},
    autoSyncEnabled: ${googleSheetConfig?.autoSyncEnabled !== false},
    lastSyncedAt: ${JSON.stringify(googleSheetConfig?.lastSyncedAt || null)}
  };

  function extractDomain(input) {
    try {
      const parsed = new URL(input.startsWith('http') ? input : 'https://' + input);
      return parsed.hostname.replace(/^www\\./, '').toLowerCase();
    } catch (e) {
      return (input || '').replace(/^mailto:/i, '').split('@')[1] || '';
    }
  }

  function formatJerryEmail(websiteName, webpageUrl, toEmail) {
    let siteRef = websiteName || 'your website';
    if (webpageUrl) {
      siteRef = websiteName ? (websiteName + ' (' + webpageUrl + ')') : webpageUrl;
    }
    let body = currentEmailTemplate.body || JERRY_TEMPLATE_BODY;
    body = body.replace(/\\[Site Name and hyperlink to website\\]/g, siteRef);
    body = body.replace(/\\{\\{website\\}\\}/gi, siteRef);
    body = body.replace(/\\{\\{site\\}\\}/gi, siteRef);
    body = body.replace(/\\{\\{url\\}\\}/gi, webpageUrl || '');
    body = body.replace(/\\{\\{domain\\}\\}/gi, extractDomain(webpageUrl || toEmail || ''));
    body = body.replace(/\\{\\{email\\}\\}/gi, cleanEmail(toEmail || ''));
    return body;
  }

  function formatJerrySubject(websiteName, webpageUrl, toEmail) {
    let siteRef = websiteName || 'your website';
    let subj = currentEmailTemplate.subject || JERRY_TEMPLATE_SUBJECT;
    subj = subj.replace(/\\[Site Name and hyperlink to website\\]/g, siteRef);
    subj = subj.replace(/\\{\\{website\\}\\}/gi, siteRef);
    subj = subj.replace(/\\{\\{site\\}\\}/gi, siteRef);
    subj = subj.replace(/\\{\\{url\\}\\}/gi, webpageUrl || '');
    subj = subj.replace(/\\{\\{domain\\}\\}/gi, extractDomain(webpageUrl || toEmail || ''));
    subj = subj.replace(/\\{\\{email\\}\\}/gi, cleanEmail(toEmail || ''));
    return subj;
  }

  function formatFollowUpEmail(websiteName, webpageUrl, toEmail) {
    let siteRef = websiteName || 'your website';
    if (webpageUrl) {
      siteRef = websiteName ? (websiteName + ' (' + webpageUrl + ')') : webpageUrl;
    }
    let body = currentFollowUpTemplate.body || DEFAULT_FOLLOWUP_BODY;
    body = body.replace(/\\[Site Name and hyperlink to website\\]/g, siteRef);
    body = body.replace(/\\{\\{website\\}\\}/gi, siteRef);
    body = body.replace(/\\{\\{site\\}\\}/gi, siteRef);
    body = body.replace(/\\{\\{url\\}\\}/gi, webpageUrl || '');
    body = body.replace(/\\{\\{domain\\}\\}/gi, extractDomain(webpageUrl || toEmail || ''));
    body = body.replace(/\\{\\{email\\}\\}/gi, cleanEmail(toEmail || ''));
    return body;
  }

  function formatFollowUpSubject(websiteName, webpageUrl, toEmail) {
    let siteRef = websiteName || 'your website';
    let subj = currentFollowUpTemplate.subject || DEFAULT_FOLLOWUP_SUBJECT;
    subj = subj.replace(/\\[Site Name and hyperlink to website\\]/g, siteRef);
    subj = subj.replace(/\\{\\{website\\}\\}/gi, siteRef);
    subj = subj.replace(/\\{\\{site\\}\\}/gi, siteRef);
    subj = subj.replace(/\\{\\{url\\}\\}/gi, webpageUrl || '');
    subj = subj.replace(/\\{\\{domain\\}\\}/gi, extractDomain(webpageUrl || toEmail || ''));
    subj = subj.replace(/\\{\\{email\\}\\}/gi, cleanEmail(toEmail || ''));
    return subj;
  }

  function buildGmailComposeUrl(to, subject, body) {
    return 'https://mail.google.com/mail/?view=cm&fs=1' +
      '&to=' + encodeURIComponent(cleanEmail(to)) +
      '&su=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  let currentWebsiteFilter = 'all';
  let currentDomainFilter = 'all';
  let currentStatusFilter = 'all';
  let currentTagFilter = 'all';
  let searchQuery = '';
  let sortBy = 'newest';
  let filterDueOnly = false;

  // DOM Elements
  const leadsTableBody = document.getElementById('leadsTableBody');
  const metricTotal = document.getElementById('metricTotal');
  const metricOutreached = document.getElementById('metricOutreached');
  const metricRate = document.getElementById('metricRate');
  const metricProgressBar = document.getElementById('metricProgressBar');
  const metricDomains = document.getElementById('metricDomains');
  const metricReminders = document.getElementById('metricReminders');
  const metricTags = document.getElementById('metricTags');
  const websiteChipsList = document.getElementById('websiteChipsList');
  const domainSelect = document.getElementById('domainSelect');
  const statusSelect = document.getElementById('statusSelect');
  const tagSelect = document.getElementById('tagSelect');
  const sortSelect = document.getElementById('sortSelect');
  const searchInput = document.getElementById('searchInput');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const excludedSitesBtn = document.getElementById('excludedSitesBtn');
  const filterDueBtn = document.getElementById('filterDueBtn');
  const markFilteredOutreachedBtn = document.getElementById('markFilteredOutreachedBtn');
  const dashboardToast = document.getElementById('dashboardToast');

  // Google Sheets Banner Elements
  const gsheetSyncBar = document.getElementById('gsheetSyncBar');
  const gsheetStatusBadge = document.getElementById('gsheetStatusBadge');
  const gsheetLastSyncedDisplay = document.getElementById('gsheetLastSyncedDisplay');
  const openGSheetBtn = document.getElementById('openGSheetBtn');
  const syncNowGSheetBtn = document.getElementById('syncNowGSheetBtn');
  const settingsGSheetBtn = document.getElementById('settingsGSheetBtn');

  // Bulk Toolbar Elements
  const bulkActionBar = document.getElementById('bulkActionBar');
  const bulkSelectedText = document.getElementById('bulkSelectedText');
  const bulkSelectAllActionBtn = document.getElementById('bulkSelectAllActionBtn');
  const bulkSelectUncontactedBtn = document.getElementById('bulkSelectUncontactedBtn');
  const bulkSelectOutreachedBtn = document.getElementById('bulkSelectOutreachedBtn');
  const bulkDeselectBtn = document.getElementById('bulkDeselectBtn');
  const bulkQuickFollowUpBtn = document.getElementById('bulkQuickFollowUpBtn');
  const bulkSequencerBtn = document.getElementById('bulkSequencerBtn');
  const bulkMarkOutreachedBtn = document.getElementById('bulkMarkOutreachedBtn');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');

  // Modals
  const addLeadModal = document.getElementById('addLeadModal');
  const tagModal = document.getElementById('tagModal');
  const backupModal = document.getElementById('backupModal');
  const importCsvModal = document.getElementById('importCsvModal');
  const excludedSitesModal = document.getElementById('excludedSitesModal');
  const gmailModal = document.getElementById('gmailModal');
  const quickFollowUpModal = document.getElementById('quickFollowUpModal');
  const bulkSequencerModal = document.getElementById('bulkSequencerModal');
  const bulkDeleteConfirmModal = document.getElementById('bulkDeleteConfirmModal');
  const settingsModal = document.getElementById('settingsModal');

  // Quick Follow-up Modal Elements
  const followUpRecipient = document.getElementById('followUpRecipient');
  const followUpSubject = document.getElementById('followUpSubject');
  const followUpBody = document.getElementById('followUpBody');
  const launchFollowUpGmailLink = document.getElementById('launchFollowUpGmailLink');
  const editFollowUpTemplateBtn = document.getElementById('editFollowUpTemplateBtn');

  // Bulk Sequencer Modal Elements
  const seqModalTitle = document.getElementById('seqModalTitle');
  const seqCurrentIdx = document.getElementById('seqCurrentIdx');
  const seqTotalCount = document.getElementById('seqTotalCount');
  const seqStepBadge = document.getElementById('seqStepBadge');
  const seqRecipient = document.getElementById('seqRecipient');
  const seqWebsite = document.getElementById('seqWebsite');
  const seqSubject = document.getElementById('seqSubject');
  const seqBody = document.getElementById('seqBody');
  const seqPrevBtn = document.getElementById('seqPrevBtn');
  const seqNextBtn = document.getElementById('seqNextBtn');
  const seqLaunchGmailLink = document.getElementById('seqLaunchGmailLink');

  // Bulk Delete Modal Elements
  const deleteCountDisplay = document.getElementById('deleteCountDisplay');
  const confirmBulkDeleteBtn = document.getElementById('confirmBulkDeleteBtn');

  // Settings & Template Elements
  const settingsBtn = document.getElementById('settingsBtn');
  const tabPitchBtn = document.getElementById('tabPitchBtn');
  const tabFollowUpBtn = document.getElementById('tabFollowUpBtn');
  const tabGSheetBtn = document.getElementById('tabGSheetBtn');
  const tabPitchContent = document.getElementById('tabPitchContent');
  const tabFollowUpContent = document.getElementById('tabFollowUpContent');
  const tabGSheetContent = document.getElementById('tabGSheetContent');
  const settingsSubjectInput = document.getElementById('settingsSubjectInput');
  const settingsBodyTextarea = document.getElementById('settingsBodyTextarea');
  const settingsFollowUpSubjectInput = document.getElementById('settingsFollowUpSubjectInput');
  const settingsFollowUpDaysInput = document.getElementById('settingsFollowUpDaysInput');
  const settingsFollowUpBodyTextarea = document.getElementById('settingsFollowUpBodyTextarea');
  const settingsGSheetUrlInput = document.getElementById('settingsGSheetUrlInput');
  const settingsGSheetTabInput = document.getElementById('settingsGSheetTabInput');
  const settingsGSheetAutoSyncCheckbox = document.getElementById('settingsGSheetAutoSyncCheckbox');
  const resetSettingsDefaultBtn = document.getElementById('resetSettingsDefaultBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const editTemplateFromGmailBtn = document.getElementById('editTemplateFromGmailBtn');

  function showToast(msg) {
    dashboardToast.textContent = msg;
    dashboardToast.style.display = 'block';
    setTimeout(() => { dashboardToast.style.display = 'none'; }, 2200);
  }

  function cleanEmail(raw) {
    if (!raw) return '';
    let str = String(raw).trim();
    str = str.replace(/^mailto:\\s*/i, '');
    if (str.includes('?')) str = str.split('?')[0];
    str = str.replace(/[.,;:!?)'"\\]}>]+$/, '');
    str = str.replace(/^[<('"{[]+/, '');
    str = str.replace(/^mailto:\\s*/i, '');
    return str.trim().toLowerCase();
  }

  // Pre-filter from URL query params (e.g. ?filterWebsite=Stripe)
  const urlParams = new URLSearchParams(window.location.search);
  const initialSite = urlParams.get('filterWebsite');
  if (initialSite) {
    currentWebsiteFilter = initialSite;
  }

  // Load from chrome.storage.local with localStorage fallback
  function loadData() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['leadsHistory', 'customTags', 'theme', 'excludedDomains', 'emailTemplate', 'followUpTemplate', 'googleSheetConfig'], (res) => {
        leads = res.leadsHistory || [];
        leads = leads.map(l => ({
          ...l,
          email: cleanEmail(l.email),
          tags: Array.isArray(l.tags) ? l.tags : []
        }));
        if (Array.isArray(res.customTags) && res.customTags.length > 0) {
          customTags = res.customTags;
        }
        if (Array.isArray(res.excludedDomains) && res.excludedDomains.length > 0) {
          excludedDomains = res.excludedDomains;
        }
        if (res.emailTemplate && res.emailTemplate.subject && res.emailTemplate.body) {
          currentEmailTemplate = res.emailTemplate;
        }
        if (res.followUpTemplate && res.followUpTemplate.subject && res.followUpTemplate.body) {
          currentFollowUpTemplate = res.followUpTemplate;
        }
        if (res.googleSheetConfig && res.googleSheetConfig.spreadsheetUrl) {
          currentGoogleSheetConfig = { ...currentGoogleSheetConfig, ...res.googleSheetConfig };
        }
        if (res.theme === 'light') {
          document.body.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
        }
        updateGSheetBanner();
        renderAll();
      });
    } else {
      const storedLeads = localStorage.getItem('leadscrape_offline_leads');
      leads = storedLeads ? JSON.parse(storedLeads) : [];
      const storedEx = localStorage.getItem('leadscrape_excluded_domains');
      if (storedEx) {
        try { excludedDomains = JSON.parse(storedEx); } catch(e) {}
      }
      const storedTpl = localStorage.getItem('leadscrape_email_template');
      if (storedTpl) {
        try { currentEmailTemplate = JSON.parse(storedTpl); } catch(e) {}
      }
      const storedFollowUp = localStorage.getItem('leadscrape_followup_template');
      if (storedFollowUp) {
        try { currentFollowUpTemplate = JSON.parse(storedFollowUp); } catch(e) {}
      }
      const storedSheets = localStorage.getItem('leadscrape_sheets_config');
      if (storedSheets) {
        try { currentGoogleSheetConfig = JSON.parse(storedSheets); } catch(e) {}
      }
      updateGSheetBanner();
      renderAll();
    }
  }

  function saveData(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        leadsHistory: leads,
        customTags: customTags,
        excludedDomains: excludedDomains,
        emailTemplate: currentEmailTemplate,
        followUpTemplate: currentFollowUpTemplate,
        googleSheetConfig: currentGoogleSheetConfig
      }, () => {
        renderAll();
        if (callback) callback();
      });
    } else {
      localStorage.setItem('leadscrape_offline_leads', JSON.stringify(leads));
      localStorage.setItem('leadscrape_excluded_domains', JSON.stringify(excludedDomains));
      localStorage.setItem('leadscrape_email_template', JSON.stringify(currentEmailTemplate));
      localStorage.setItem('leadscrape_followup_template', JSON.stringify(currentFollowUpTemplate));
      localStorage.setItem('leadscrape_sheets_config', JSON.stringify(currentGoogleSheetConfig));
      renderAll();
      if (callback) callback();
    }
  }

  // Update Google Sheets Live Auto-Sync Banner
  function updateGSheetBanner() {
    if (currentGoogleSheetConfig.spreadsheetUrl) {
      openGSheetBtn.href = currentGoogleSheetConfig.spreadsheetUrl;
      openGSheetBtn.style.display = 'inline-flex';
      gsheetStatusBadge.className = 'status-pill status-connected';
      gsheetStatusBadge.textContent = '● Active Mirror';
      if (currentGoogleSheetConfig.lastSyncedAt) {
        const d = new Date(currentGoogleSheetConfig.lastSyncedAt);
        gsheetLastSyncedDisplay.textContent = '• Last synced: ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      openGSheetBtn.style.display = 'none';
      gsheetStatusBadge.className = 'status-pill status-disconnected';
      gsheetStatusBadge.textContent = '○ Needs Setup';
      gsheetLastSyncedDisplay.textContent = '• Configure sheet in Settings';
    }
  }

  // Live auto-sync: When content scripts scrape websites in other tabs,
  // the offline dashboard updates automatically in real-time!
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.leadsHistory) {
        leads = (changes.leadsHistory.newValue || []).map(l => ({
          ...l,
          email: cleanEmail(l.email),
          tags: Array.isArray(l.tags) ? l.tags : []
        }));
        renderAll();
      }
    });
  }

  function renderAll() {
    renderMetrics();
    renderWebsiteChips();
    renderDomainDropdown();
    renderTagDropdown();
    renderTable();
    updateBulkActionBar();
  }

  function renderMetrics() {
    const total = leads.length;
    const outreached = leads.filter(l => l.status === 'outreached' || l.status === 'replied' || l.status === 'converted').length;
    const rate = total > 0 ? Math.round((outreached / total) * 100) : 0;
    const uniqueDomains = new Set(leads.map(l => l.domain).filter(Boolean)).size;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueCount = leads.filter(l => l.followUpDate && l.followUpDate <= todayStr && l.status !== 'converted').length;

    metricTotal.textContent = total;
    metricOutreached.textContent = outreached;
    metricRate.textContent = '(' + rate + '%)';
    metricProgressBar.style.width = rate + '%';
    metricDomains.textContent = 'Across ' + uniqueDomains + ' domains';
    metricReminders.textContent = dueCount;
    metricTags.textContent = customTags.length;
  }

  function renderWebsiteChips() {
    const siteMap = new Map();
    leads.forEach(l => {
      const s = l.websiteName || 'Unknown';
      siteMap.set(s, (siteMap.get(s) || 0) + 1);
    });

    const sites = Array.from(siteMap.entries()).sort((a,b) => b[1] - a[1]);
    websiteChipsList.innerHTML = \`
      <button class="site-chip \${currentWebsiteFilter === 'all' ? 'active' : ''}" data-site="all">
        All (\${leads.length})
      </button>
    \` + sites.map(([site, count]) => \`
      <button class="site-chip \${currentWebsiteFilter.toLowerCase() === site.toLowerCase() ? 'active' : ''}" data-site="\${site}">
        \${site} (\${count})
      </button>
    \`).join('');

    websiteChipsList.querySelectorAll('.site-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentWebsiteFilter = btn.getAttribute('data-site');
        renderWebsiteChips();
        renderTable();
        updateBulkActionBar();
      });
    });
  }

  function renderDomainDropdown() {
    const domainSet = new Set(leads.map(l => l.domain).filter(Boolean));
    const currentVal = domainSelect.value;
    domainSelect.innerHTML = '<option value="all">All Domains (' + domainSet.size + ')</option>' +
      Array.from(domainSet).sort().map(d => \`<option value="\${d}">\${d}</option>\`).join('');
    domainSelect.value = currentVal || 'all';
  }

  function renderTagDropdown() {
    const currentVal = tagSelect.value;
    tagSelect.innerHTML = '<option value="all">All Project Tags</option>' +
      customTags.map(t => \`<option value="\${t.id}">🏷️ \${t.name}</option>\`).join('');
    tagSelect.value = currentVal || 'all';
  }

  function getFilteredLeads() {
    const q = searchQuery.toLowerCase().trim();
    const todayStr = new Date().toISOString().split('T')[0];

    return leads.filter(l => {
      if (filterDueOnly) {
        if (!l.followUpDate || l.followUpDate > todayStr || l.status === 'converted') return false;
      }
      if (q) {
        const emailMatch = l.email.toLowerCase().includes(q);
        const websiteMatch = (l.websiteName || '').toLowerCase().includes(q);
        const domainMatch = (l.domain || '').toLowerCase().includes(q);
        const notesMatch = (l.notes || '').toLowerCase().includes(q);
        const tagsMatch = (l.tags || []).some(tId => {
          const t = customTags.find(ct => ct.id === tId);
          return t && t.name.toLowerCase().includes(q);
        });
        if (!emailMatch && !websiteMatch && !domainMatch && !notesMatch && !tagsMatch) return false;
      }
      if (currentWebsiteFilter !== 'all' && (l.websiteName || '').toLowerCase() !== currentWebsiteFilter.toLowerCase()) {
        return false;
      }
      if (currentDomainFilter !== 'all' && l.domain !== currentDomainFilter) {
        return false;
      }
      if (currentStatusFilter !== 'all' && l.status !== currentStatusFilter) {
        return false;
      }
      if (currentTagFilter !== 'all' && !(l.tags || []).includes(currentTagFilter)) {
        return false;
      }
      return true;
    });
  }

  function updateBulkActionBar() {
    const filtered = getFilteredLeads();
    const count = selectedIds.size;

    if (count > 0) {
      bulkActionBar.style.display = 'flex';
      bulkSelectedText.textContent = \`\${count} of \${filtered.length} selected\`;
      document.querySelectorAll('.bulk-counter').forEach(el => {
        el.textContent = count.toString();
      });
    } else {
      bulkActionBar.style.display = 'none';
    }

    if (selectAllCheckbox) {
      const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
      const someSelected = filtered.some(l => selectedIds.has(l.id));
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = !allSelected && someSelected;
    }
  }

  function renderTable() {
    const filtered = getFilteredLeads();

    if (sortBy === 'newest') {
      filtered.sort((a,b) => new Date(b.discoveredAt || 0).getTime() - new Date(a.discoveredAt || 0).getTime());
    } else if (sortBy === 'oldest') {
      filtered.sort((a,b) => new Date(a.discoveredAt || 0).getTime() - new Date(b.discoveredAt || 0).getTime());
    } else if (sortBy === 'email') {
      filtered.sort((a,b) => a.email.localeCompare(b.email));
    } else if (sortBy === 'website') {
      filtered.sort((a,b) => (a.websiteName || '').localeCompare(b.websiteName || ''));
    }

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = '<div class="empty-state">No matching leads found for current filters. Visit any website to auto-scrape new emails!</div>';
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    leadsTableBody.innerHTML = filtered.map(lead => {
      const clean = cleanEmail(lead.email);
      const isOutreached = lead.status === 'outreached' || lead.status === 'replied' || lead.status === 'converted';
      const isDue = lead.followUpDate && lead.followUpDate <= todayStr;
      const isSelected = selectedIds.has(lead.id);

      const pitchUrl = buildGmailComposeUrl(
        clean,
        formatJerrySubject(lead.websiteName, lead.url, clean),
        formatJerryEmail(lead.websiteName, lead.url, clean)
      );

      const followUpUrl = buildGmailComposeUrl(
        clean,
        formatFollowUpSubject(lead.websiteName, lead.url, clean),
        formatFollowUpEmail(lead.websiteName, lead.url, clean)
      );
      
      const tagPills = (lead.tags || []).map(tId => {
        const t = customTags.find(ct => ct.id === tId);
        if (!t) return '';
        return \`<span class="tag-badge" style="background: \${t.color}20; color: \${t.color}; border: 1px solid \${t.color}60;">\${t.name}</span>\`;
      }).filter(Boolean).join('');

      return \`
        <div class="table-row \${isSelected ? 'selected' : ''}" data-id="\${lead.id}">
          <div class="col-checkbox">
            <input type="checkbox" class="row-select-checkbox" data-id="\${lead.id}" \${isSelected ? 'checked' : ''} />
          </div>
          <div class="col-email">
            <div class="email-text">\${clean}</div>
            <div class="domain-subtext">\${lead.domain || 'domain'}</div>
          </div>
          <div class="col-website">
            <div class="site-name-text filter-site-btn" data-site="\${lead.websiteName}">\${lead.websiteName || 'Webpage'}</div>
            <div class="domain-subtext" title="\${lead.url || ''}">\${lead.url ? (lead.url.length > 35 ? lead.url.substring(0, 35) + '...' : lead.url) : ''}</div>
          </div>
          <div class="col-tags">
            <div class="tags-row">
              \${tagPills}
              <button class="btn-add-tag-mini assign-tag-btn" data-id="\${lead.id}">+ Tag</button>
            </div>
          </div>
          <div class="col-reminder">
            <input type="date" class="reminder-date-input \${isDue ? 'reminder-overdue' : ''}" value="\${lead.followUpDate || ''}" data-id="\${lead.id}" title="Follow-up reminder date" />
          </div>
          <div class="col-status">
            <button class="btn-outreached-toggle \${isOutreached ? 'outreached' : 'uncontacted'} toggle-outreach-btn" data-id="\${lead.id}">
              \${isOutreached ? '✓ Outreached' : 'Mark Outreached'}
            </button>
          </div>
          <div class="col-actions actions-cell">
            \${isOutreached ? \`
              <div class="btn-compound">
                <a href="\${followUpUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-followup-main mark-outreached-on-click" data-id="\${lead.id}" title="Send quick follow-up in Gmail (New Tab)">⚡ Follow-up ↗</a>
                <button type="button" class="btn-action-followup-edit edit-followup-btn" data-id="\${lead.id}" title="Preview / Edit Follow-up">✏️</button>
              </div>
            \` : \`
              <a href="\${pitchUrl}" target="_blank" rel="noopener noreferrer" class="btn-action-gmail mark-outreached-on-click" data-id="\${lead.id}" title="Send outreach via Gmail (New Tab)">✉️ Gmail ↗</a>
            \`}
            <button class="btn-action-icon copy-btn" data-email="\${clean}" title="Copy email">Copy</button>
            <button class="btn-action-icon btn-action-danger delete-btn" data-id="\${lead.id}" title="Delete lead">&times;</button>
          </div>
        </div>
      \`;
    }).join('');

    // Attach row checkbox selection handlers
    leadsTableBody.querySelectorAll('.row-select-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = chk.getAttribute('data-id');
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        renderTable();
        updateBulkActionBar();
      });
    });

    // Mark as outreached when clicking direct Gmail outbound link
    leadsTableBody.querySelectorAll('.mark-outreached-on-click').forEach(link => {
      link.addEventListener('click', () => {
        const id = link.getAttribute('data-id');
        const nowIso = new Date().toISOString();
        leads = leads.map(l => l.id === id ? { ...l, status: 'outreached', outreachedAt: nowIso } : l);
        saveData(() => {
          showToast('Opened Gmail Compose & marked as Outreached!');
        });
      });
    });

    // Edit quick follow-up button handler
    leadsTableBody.querySelectorAll('.edit-followup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const targetLead = leads.find(l => l.id === id);
        if (!targetLead) return;

        activeLeadForGmail = targetLead;
        const to = cleanEmail(targetLead.email);
        const subj = formatFollowUpSubject(targetLead.websiteName, targetLead.url, to);
        const body = formatFollowUpEmail(targetLead.websiteName, targetLead.url, to);

        followUpRecipient.value = to;
        followUpSubject.value = subj;
        followUpBody.value = body;
        launchFollowUpGmailLink.href = buildGmailComposeUrl(to, subj, body);

        quickFollowUpModal.style.display = 'flex';
      });
    });

    leadsTableBody.querySelectorAll('.toggle-outreach-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        leads = leads.map(l => {
          if (l.id === id) {
            const next = l.status === 'outreached' ? 'uncontacted' : 'outreached';
            return {
              ...l,
              status: next,
              outreachedAt: next === 'outreached' ? new Date().toISOString() : undefined
            };
          }
          return l;
        });
        saveData();
      });
    });

    leadsTableBody.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        navigator.clipboard.writeText(email);
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });

    leadsTableBody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        selectedIds.delete(id);
        leads = leads.filter(l => l.id !== id);
        saveData(() => showToast('Lead deleted'));
      });
    });

    leadsTableBody.querySelectorAll('.filter-site-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentWebsiteFilter = btn.getAttribute('data-site');
        renderWebsiteChips();
        renderTable();
        updateBulkActionBar();
      });
    });

    leadsTableBody.querySelectorAll('.reminder-date-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = input.getAttribute('data-id');
        const val = e.target.value;
        leads = leads.map(l => l.id === id ? { ...l, followUpDate: val } : l);
        saveData(() => showToast('Reminder updated'));
      });
    });

    leadsTableBody.querySelectorAll('.assign-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const targetLead = leads.find(l => l.id === id);
        if (!targetLead) return;

        const availableTags = customTags.map((t, idx) => \`\${idx + 1}. \${t.name}\`).join('\\n');
        const choice = prompt('Select tag number to toggle:\\n' + availableTags);
        const index = parseInt(choice, 10) - 1;
        if (customTags[index]) {
          const tagId = customTags[index].id;
          const current = new Set(targetLead.tags || []);
          if (current.has(tagId)) current.delete(tagId);
          else current.add(tagId);
          targetLead.tags = Array.from(current);
          saveData();
        }
      });
    });
  }

  // Live update Compose URL as user edits followUpSubject or followUpBody
  [followUpSubject, followUpBody].forEach(el => {
    el.addEventListener('input', () => {
      launchFollowUpGmailLink.href = buildGmailComposeUrl(
        followUpRecipient.value,
        followUpSubject.value,
        followUpBody.value
      );
    });
  });

  launchFollowUpGmailLink.addEventListener('click', () => {
    if (activeLeadForGmail) {
      const nowIso = new Date().toISOString();
      leads = leads.map(l => l.id === activeLeadForGmail.id ? { ...l, status: 'outreached', outreachedAt: nowIso } : l);
      saveData();
    }
    quickFollowUpModal.style.display = 'none';
    showToast('Launched follow-up in Gmail Compose!');
  });

  // Bulk Selection Toolbar Handlers
  selectAllCheckbox.addEventListener('change', (e) => {
    const filtered = getFilteredLeads();
    if (e.target.checked) {
      filtered.forEach(l => selectedIds.add(l.id));
    } else {
      filtered.forEach(l => selectedIds.delete(l.id));
    }
    renderTable();
    updateBulkActionBar();
  });

  bulkSelectAllActionBtn.addEventListener('click', () => {
    getFilteredLeads().forEach(l => selectedIds.add(l.id));
    renderTable();
    updateBulkActionBar();
  });

  bulkSelectUncontactedBtn.addEventListener('click', () => {
    selectedIds.clear();
    getFilteredLeads().forEach(l => {
      if (l.status !== 'outreached' && l.status !== 'replied' && l.status !== 'converted') {
        selectedIds.add(l.id);
      }
    });
    renderTable();
    updateBulkActionBar();
  });

  bulkSelectOutreachedBtn.addEventListener('click', () => {
    selectedIds.clear();
    getFilteredLeads().forEach(l => {
      if (l.status === 'outreached' || l.status === 'replied' || l.status === 'converted') {
        selectedIds.add(l.id);
      }
    });
    renderTable();
    updateBulkActionBar();
  });

  bulkDeselectBtn.addEventListener('click', () => {
    selectedIds.clear();
    renderTable();
    updateBulkActionBar();
  });

  bulkMarkOutreachedBtn.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const nowIso = new Date().toISOString();
    leads = leads.map(l => selectedIds.has(l.id) ? { ...l, status: 'outreached', outreachedAt: nowIso } : l);
    const count = selectedIds.size;
    selectedIds.clear();
    saveData(() => showToast('Marked ' + count + ' leads as outreached!'));
  });

  bulkDeleteBtn.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    deleteCountDisplay.textContent = selectedIds.size.toString();
    bulkDeleteConfirmModal.style.display = 'flex';
  });

  confirmBulkDeleteBtn.addEventListener('click', () => {
    const count = selectedIds.size;
    leads = leads.filter(l => !selectedIds.has(l.id));
    selectedIds.clear();
    saveData(() => {
      bulkDeleteConfirmModal.style.display = 'none';
      showToast('Successfully deleted ' + count + ' selected leads');
    });
  });

  // Step-by-Step Bulk Sequencer State & Controls
  let sequencerQueue = [];
  let sequencerIdx = 0;
  let sequencerStep = 1; // 1 = initial pitch, 2 = quick follow-up

  function openSequencer(step) {
    const candidates = leads.filter(l => selectedIds.has(l.id));
    if (candidates.length === 0) {
      alert('Please select at least 1 lead to start sequence');
      return;
    }
    sequencerQueue = candidates;
    sequencerIdx = 0;
    sequencerStep = step;
    seqModalTitle.textContent = step === 2 ? '⚡ Bulk Quick Follow-up Sequencer' : '⚡ Step-by-Step Outreach Sequencer';
    seqStepBadge.textContent = step === 2 ? 'Step 2: Quick Follow-up' : 'Step 1: Initial Pitch';
    seqStepBadge.style.background = step === 2 ? '#d97706' : '#0284c7';
    renderSequencerStep();
    bulkSequencerModal.style.display = 'flex';
  }

  function renderSequencerStep() {
    const cur = sequencerQueue[sequencerIdx];
    if (!cur) return;

    seqCurrentIdx.textContent = (sequencerIdx + 1).toString();
    seqTotalCount.textContent = sequencerQueue.length.toString();
    seqRecipient.value = cleanEmail(cur.email);
    seqWebsite.value = cur.websiteName || cur.domain || 'Prospect';

    let subj = '';
    let body = '';
    if (sequencerStep === 2) {
      subj = formatFollowUpSubject(cur.websiteName, cur.url, cur.email);
      body = formatFollowUpEmail(cur.websiteName, cur.url, cur.email);
    } else {
      subj = formatJerrySubject(cur.websiteName, cur.url, cur.email);
      body = formatJerryEmail(cur.websiteName, cur.url, cur.email);
    }

    seqSubject.value = subj;
    seqBody.value = body;
    seqLaunchGmailLink.href = buildGmailComposeUrl(cur.email, subj, body);

    seqPrevBtn.disabled = sequencerIdx === 0;
    seqNextBtn.textContent = sequencerIdx >= sequencerQueue.length - 1 ? 'Finish Sequence ✓' : 'Next Prospect ▶';
  }

  [seqSubject, seqBody].forEach(el => {
    el.addEventListener('input', () => {
      seqLaunchGmailLink.href = buildGmailComposeUrl(seqRecipient.value, seqSubject.value, seqBody.value);
    });
  });

  seqLaunchGmailLink.addEventListener('click', () => {
    const cur = sequencerQueue[sequencerIdx];
    if (cur) {
      const nowIso = new Date().toISOString();
      leads = leads.map(l => l.id === cur.id ? { ...l, status: 'outreached', outreachedAt: nowIso } : l);
      saveData();
      showToast('Opened Gmail for ' + cur.email);
    }
  });

  seqPrevBtn.addEventListener('click', () => {
    if (sequencerIdx > 0) {
      sequencerIdx--;
      renderSequencerStep();
    }
  });

  seqNextBtn.addEventListener('click', () => {
    if (sequencerIdx < sequencerQueue.length - 1) {
      sequencerIdx++;
      renderSequencerStep();
    } else {
      bulkSequencerModal.style.display = 'none';
      showToast('Finished email sequence!');
    }
  });

  bulkQuickFollowUpBtn.addEventListener('click', () => openSequencer(2));
  bulkSequencerBtn.addEventListener('click', () => openSequencer(1));

  // Optional Sync to Google Sheet button in banner
  if (syncNowGSheetBtn) {
    syncNowGSheetBtn.addEventListener('click', () => {
      if (!currentGoogleSheetConfig.spreadsheetUrl) {
        switchSettingsTab('tabGSheet');
        settingsModal.style.display = 'flex';
        return;
      }
      const nowIso = new Date().toISOString();
      currentGoogleSheetConfig.lastSyncedAt = nowIso;
      updateGSheetBanner();
      saveData(() => {
        showToast('Google Sheet mirror synced (' + leads.length + ' leads)');
      });
    });
  }

  if (settingsGSheetBtn) {
    settingsGSheetBtn.addEventListener('click', () => {
      switchSettingsTab('tabGSheet');
      populateSettingsInputs();
      settingsModal.style.display = 'flex';
    });
  }

  // Filter Event Listeners
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
    updateBulkActionBar();
  });

  domainSelect.addEventListener('change', (e) => {
    currentDomainFilter = e.target.value;
    renderTable();
    updateBulkActionBar();
  });

  statusSelect.addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    renderTable();
    updateBulkActionBar();
  });

  tagSelect.addEventListener('change', (e) => {
    currentTagFilter = e.target.value;
    renderTable();
    updateBulkActionBar();
  });

  sortSelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderTable();
  });

  filterDueBtn.addEventListener('click', () => {
    filterDueOnly = !filterDueOnly;
    filterDueBtn.textContent = filterDueOnly ? 'Show All Leads' : 'Show Due Reminders';
    renderTable();
    updateBulkActionBar();
  });

  markFilteredOutreachedBtn.addEventListener('click', () => {
    const filtered = getFilteredLeads();
    if (filtered.length === 0) return alert('No leads to update');
    const idSet = new Set(filtered.map(l => l.id));
    const nowIso = new Date().toISOString();

    leads = leads.map(l => idSet.has(l.id) ? { ...l, status: 'outreached', outreachedAt: nowIso } : l);
    saveData(() => showToast('Marked ' + filtered.length + ' leads as outreached!'));
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: 'light' });
      }
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: 'dark' });
      }
    }
  });

  // CSV Export (Strictly Clean, NO mailto:, escaped RFC 4180)
  exportCsvBtn.addEventListener('click', () => {
    const list = getFilteredLeads();
    if (list.length === 0) return alert('No leads to export');

    const header = '"Email","Website Name","Domain","URL","Status","Outreached At","Follow-up Date","Notes"\\r\\n';
    const rows = list.map(l => {
      const e = cleanEmail(l.email);
      const site = (l.websiteName || '').replace(/"/g, '""');
      const domain = (l.domain || '').replace(/"/g, '""');
      const url = (l.url || '').replace(/"/g, '""');
      const status = (l.status || 'uncontacted').replace(/"/g, '""');
      const outreachedAt = (l.outreachedAt || '').replace(/"/g, '""');
      const followUp = (l.followUpDate || '').replace(/"/g, '""');
      const notes = (l.notes || '').replace(/"/g, '""');
      return \`"\${e}","\${site}","\${domain}","\${url}","\${status}","\${outreachedAt}","\${followUp}","\${notes}"\`;
    }).join('\\r\\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const filterTag = currentWebsiteFilter !== 'all' ? '-' + currentWebsiteFilter.toLowerCase().replace(/[^a-z0-9]/g, '-') : '';
    a.download = 'leadscrape-leads' + filterTag + '.csv';
    a.click();
    URL.revokeObjectURL(blobUrl);
    showToast('Exported ' + list.length + ' leads to CSV');
  });

  // Modal Close Handlers
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      document.getElementById(targetId).style.display = 'none';
    });
  });

  // Add Lead Modal
  document.getElementById('addLeadBtn').addEventListener('click', () => {
    addLeadModal.style.display = 'flex';
  });

  document.getElementById('saveNewLeadBtn').addEventListener('click', () => {
    const email = cleanEmail(document.getElementById('newLeadEmail').value);
    if (!email || !email.includes('@')) return alert('Please enter a valid email address');

    const websiteName = document.getElementById('newLeadWebsite').value.trim() || 'Custom Prospect';
    const url = document.getElementById('newLeadUrl').value.trim();
    const notes = document.getElementById('newLeadNotes').value.trim();

    let domain = 'custom';
    try {
      if (url) domain = new URL(url).hostname.replace(/^www\\./, '');
    } catch(e) {}

    const newLead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      email,
      websiteName,
      url,
      domain,
      discoveredAt: new Date().toISOString(),
      status: 'uncontacted',
      tags: [],
      notes
    };

    leads = [newLead, ...leads];
    saveData(() => {
      addLeadModal.style.display = 'none';
      document.getElementById('newLeadEmail').value = '';
      document.getElementById('newLeadWebsite').value = '';
      document.getElementById('newLeadUrl').value = '';
      document.getElementById('newLeadNotes').value = '';
      showToast('Lead added successfully');
    });
  });

  // Tag Management Modal
  document.getElementById('manageTagsBtn').addEventListener('click', () => {
    renderModalTagsList();
    tagModal.style.display = 'flex';
  });

  function renderModalTagsList() {
    const modalTagsList = document.getElementById('modalTagsList');
    modalTagsList.innerHTML = customTags.map(t => \`
      <div class="tag-manage-item">
        <span class="tag-badge" style="background: \${t.color}20; color: \${t.color}; border: 1px solid \${t.color};">
          \${t.name}
        </span>
        <button class="btn-action-icon btn-action-danger delete-tag-btn" data-id="\${t.id}">&times;</button>
      </div>
    \`).join('');

    modalTagsList.querySelectorAll('.delete-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        customTags = customTags.filter(t => t.id !== id);
        saveData(renderModalTagsList);
      });
    });
  }

  document.getElementById('createTagBtn').addEventListener('click', () => {
    const name = document.getElementById('newTagName').value.trim();
    const color = document.getElementById('newTagColor').value;
    if (!name) return;

    const newTag = {
      id: 'tag_' + Date.now(),
      name,
      color
    };
    customTags.push(newTag);
    document.getElementById('newTagName').value = '';
    saveData(renderModalTagsList);
  });

  // Backup & Sync Modal
  document.getElementById('backupBtn').addEventListener('click', () => {
    backupModal.style.display = 'flex';
  });

  document.getElementById('downloadBackupBtn').addEventListener('click', () => {
    const backupData = {
      version: '1.4.0',
      exportedAt: new Date().toISOString(),
      leads,
      customTags,
      googleSheetConfig: currentGoogleSheetConfig
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leadscrape-offline-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Offline backup downloaded!');
  });

  document.getElementById('triggerImportBtn').addEventListener('click', () => {
    document.getElementById('importBackupInput').click();
  });

  document.getElementById('importBackupInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed.leads)) {
          const existingEmails = new Set(leads.map(l => l.email.toLowerCase()));
          const newEntries = parsed.leads.filter(l => !existingEmails.has(cleanEmail(l.email)));
          leads = [...newEntries, ...leads];
          if (Array.isArray(parsed.customTags)) {
            const tagIds = new Set(customTags.map(t => t.id));
            parsed.customTags.forEach(t => {
              if (!tagIds.has(t.id)) customTags.push(t);
            });
          }
          if (parsed.googleSheetConfig) {
            currentGoogleSheetConfig = { ...currentGoogleSheetConfig, ...parsed.googleSheetConfig };
            updateGSheetBanner();
          }
          saveData(() => {
            backupModal.style.display = 'none';
            showToast('Imported ' + newEntries.length + ' new leads!');
          });
        }
      } catch (err) {
        alert('Invalid JSON backup file');
      }
    };
    reader.readAsText(file);
  });

  // Settings 3-Tab Controller
  function switchSettingsTab(tabId) {
    [tabPitchBtn, tabFollowUpBtn, tabGSheetBtn].forEach(b => b.classList.remove('active'));
    [tabPitchContent, tabFollowUpContent, tabGSheetContent].forEach(c => c.style.display = 'none');

    if (tabId === 'tabPitch') {
      tabPitchBtn.classList.add('active');
      tabPitchContent.style.display = 'block';
    } else if (tabId === 'tabFollowUp') {
      tabFollowUpBtn.classList.add('active');
      tabFollowUpContent.style.display = 'block';
    } else if (tabId === 'tabGSheet') {
      tabGSheetBtn.classList.add('active');
      tabGSheetContent.style.display = 'block';
    }
  }

  [tabPitchBtn, tabFollowUpBtn, tabGSheetBtn].forEach(btn => {
    btn.addEventListener('click', () => switchSettingsTab(btn.getAttribute('data-tab')));
  });

  function populateSettingsInputs() {
    settingsSubjectInput.value = currentEmailTemplate.subject || JERRY_TEMPLATE_SUBJECT;
    settingsBodyTextarea.value = currentEmailTemplate.body || JERRY_TEMPLATE_BODY;
    settingsFollowUpSubjectInput.value = currentFollowUpTemplate.subject || DEFAULT_FOLLOWUP_SUBJECT;
    settingsFollowUpDaysInput.value = currentFollowUpTemplate.delayDays || DEFAULT_FOLLOWUP_DAYS;
    settingsFollowUpBodyTextarea.value = currentFollowUpTemplate.body || DEFAULT_FOLLOWUP_BODY;
    settingsGSheetUrlInput.value = currentGoogleSheetConfig.spreadsheetUrl || '';
    settingsGSheetTabInput.value = currentGoogleSheetConfig.sheetName || 'Leads';
    settingsGSheetAutoSyncCheckbox.checked = currentGoogleSheetConfig.autoSyncEnabled !== false;
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      populateSettingsInputs();
      switchSettingsTab('tabPitch');
      settingsModal.style.display = 'flex';
    });
  }

  if (editFollowUpTemplateBtn) {
    editFollowUpTemplateBtn.addEventListener('click', () => {
      quickFollowUpModal.style.display = 'none';
      populateSettingsInputs();
      switchSettingsTab('tabFollowUp');
      settingsModal.style.display = 'flex';
    });
  }

  if (editTemplateFromGmailBtn) {
    editTemplateFromGmailBtn.addEventListener('click', () => {
      gmailModal.style.display = 'none';
      populateSettingsInputs();
      switchSettingsTab('tabPitch');
      settingsModal.style.display = 'flex';
    });
  }

  document.querySelectorAll('.insert-var-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-var');
      const targetId = btn.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        const cur = targetInput.value;
        targetInput.value += (cur.endsWith(' ') || cur.endsWith('\\n') || cur.length === 0 ? '' : ' ') + tag;
      }
    });
  });

  if (resetSettingsDefaultBtn) {
    resetSettingsDefaultBtn.addEventListener('click', () => {
      const isPitchActive = tabPitchBtn.classList.contains('active');
      const isFollowUpActive = tabFollowUpBtn.classList.contains('active');
      if (isPitchActive) {
        settingsSubjectInput.value = JERRY_TEMPLATE_SUBJECT;
        settingsBodyTextarea.value = JERRY_TEMPLATE_BODY;
      } else if (isFollowUpActive) {
        settingsFollowUpSubjectInput.value = DEFAULT_FOLLOWUP_SUBJECT;
        settingsFollowUpDaysInput.value = DEFAULT_FOLLOWUP_DAYS;
        settingsFollowUpBodyTextarea.value = DEFAULT_FOLLOWUP_BODY;
      } else {
        settingsGSheetUrlInput.value = '';
        settingsGSheetTabInput.value = 'Leads';
        settingsGSheetAutoSyncCheckbox.checked = true;
      }
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      currentEmailTemplate = {
        subject: settingsSubjectInput.value.trim() || JERRY_TEMPLATE_SUBJECT,
        body: settingsBodyTextarea.value.trim() || JERRY_TEMPLATE_BODY
      };

      currentFollowUpTemplate = {
        subject: settingsFollowUpSubjectInput.value.trim() || DEFAULT_FOLLOWUP_SUBJECT,
        body: settingsFollowUpBodyTextarea.value.trim() || DEFAULT_FOLLOWUP_BODY,
        delayDays: parseInt(settingsFollowUpDaysInput.value, 10) || DEFAULT_FOLLOWUP_DAYS
      };

      const rawSheetUrl = settingsGSheetUrlInput.value.trim();
      let extractedId = '';
      const match = rawSheetUrl.match(/\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
      if (match) extractedId = match[1];
      else if (rawSheetUrl && !rawSheetUrl.includes('/')) extractedId = rawSheetUrl;

      currentGoogleSheetConfig = {
        ...currentGoogleSheetConfig,
        spreadsheetId: extractedId,
        spreadsheetUrl: rawSheetUrl,
        sheetName: settingsGSheetTabInput.value.trim() || 'Leads',
        autoSyncEnabled: settingsGSheetAutoSyncCheckbox.checked
      };

      updateGSheetBanner();
      saveData(() => {
        settingsModal.style.display = 'none';
        showToast('Settings saved successfully!');
      });
    });
  }

  // CSV Import Modal & Parsing Logic
  function parseCsvText(text) {
    if (!text || !text.trim()) return [];
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\\r' || char === '\\n') && !insideQuotes) {
        if (char === '\\r' && nextChar === '\\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
    }
    return rows;
  }

  function evaluateCsvContent(csvString) {
    const rows = parseCsvText(csvString);
    if (rows.length === 0) {
      pendingImportLeads = [];
      importSummaryCard.style.display = 'none';
      confirmImportCsvBtn.disabled = true;
      confirmImportCsvBtn.textContent = 'Import 0 Leads';
      return;
    }

    const firstRow = rows[0].map(c => c.toLowerCase());
    let emailIdx = -1;
    let siteIdx = -1;
    let urlIdx = -1;

    firstRow.forEach((col, idx) => {
      if (col.includes('email') || col.includes('e-mail') || col.includes('mail') || col.includes('address')) {
        if (emailIdx === -1) emailIdx = idx;
      }
      if (col.includes('site') || col.includes('website') || col.includes('company') || col.includes('name')) {
        if (siteIdx === -1) siteIdx = idx;
      }
      if (col.includes('url') || col.includes('link') || col.includes('domain') || col.includes('href')) {
        if (urlIdx === -1) urlIdx = idx;
      }
    });

    const hasHeader = emailIdx !== -1;
    const dataRows = hasHeader ? rows.slice(1) : rows;
    if (!hasHeader) emailIdx = 0;

    const existingEmails = new Set(leads.map(l => cleanEmail(l.email)));
    const seenInBatch = new Set();
    const validLeads = [];
    let duplicateCount = 0;

    dataRows.forEach(row => {
      if (!row || row.length === 0) return;
      const rawEmail = row[emailIdx] || '';
      const email = cleanEmail(rawEmail);
      if (!email || !email.includes('@') || email.length < 5) return;

      if (existingEmails.has(email) || seenInBatch.has(email)) {
        duplicateCount++;
        return;
      }
      seenInBatch.add(email);

      let websiteName = (siteIdx !== -1 && row[siteIdx]) ? row[siteIdx].trim() : '';
      let url = (urlIdx !== -1 && row[urlIdx]) ? row[urlIdx].trim() : '';
      let domain = '';

      if (url) {
        try {
          domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace(/^www\\./, '');
        } catch(e) {
          domain = url;
        }
      } else {
        domain = email.split('@')[1] || '';
      }

      if (!websiteName) {
        const parts = domain.split('.');
        const brand = parts[0] || 'Company';
        websiteName = brand.charAt(0).toUpperCase() + brand.slice(1);
      }

      validLeads.push({
        id: 'csv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
        email,
        websiteName,
        url: url || (domain ? 'https://' + domain : ''),
        domain,
        discoveredAt: new Date().toISOString(),
        status: 'uncontacted',
        tags: [],
        notes: 'Imported via CSV'
      });
    });

    pendingImportLeads = validLeads;
    importSummaryTotal.textContent = dataRows.length;
    importSummaryValid.textContent = validLeads.length;
    importSummaryDupes.textContent = duplicateCount;
    importSummaryCard.style.display = 'block';

    confirmImportCsvBtn.disabled = validLeads.length === 0;
    confirmImportCsvBtn.textContent = 'Import ' + validLeads.length + ' Leads';
  }

  importCsvBtn.addEventListener('click', () => {
    importTagSelect.innerHTML = '<option value="">No tag</option>' +
      customTags.map(t => \`<option value="\${t.id}">🏷️ \${t.name}</option>\`).join('');
    csvRawText.value = '';
    csvFileInput.value = '';
    csvFileNameDisplay.textContent = 'or paste CSV text below';
    importSummaryCard.style.display = 'none';
    confirmImportCsvBtn.disabled = true;
    confirmImportCsvBtn.textContent = 'Import 0 Leads';
    pendingImportLeads = [];
    importCsvModal.style.display = 'flex';
  });

  triggerCsvFileBtn.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    csvFileNameDisplay.textContent = 'Selected: ' + file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      csvRawText.value = content;
      evaluateCsvContent(content);
    };
    reader.readAsText(file);
  });

  csvRawText.addEventListener('input', (e) => {
    evaluateCsvContent(e.target.value);
  });

  confirmImportCsvBtn.addEventListener('click', () => {
    if (pendingImportLeads.length === 0) return;
    const chosenTag = importTagSelect.value;
    const leadsToAdd = pendingImportLeads.map(l => ({
      ...l,
      tags: chosenTag ? [chosenTag] : []
    }));

    leads = [...leadsToAdd, ...leads];
    saveData(() => {
      importCsvModal.style.display = 'none';
      showToast('Successfully imported ' + leadsToAdd.length + ' leads!');
    });
  });

  // Excluded Sites Blacklist Management
  function renderExcludedList() {
    excludeCountSpan.textContent = excludedDomains.length;
    excludedDomainsList.innerHTML = excludedDomains.map(d => \`
      <span class="tag-badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 3px 8px;">
        \${d}
        <button class="remove-exclude-btn" data-domain="\${d}" style="background: none; border: none; color: #f87171; cursor: pointer; margin-left: 4px; font-weight: bold;">&times;</button>
      </span>
    \`).join('');

    excludedDomainsList.querySelectorAll('.remove-exclude-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetDomain = btn.getAttribute('data-domain');
        excludedDomains = excludedDomains.filter(d => d !== targetDomain);
        saveData(renderExcludedList);
      });
    });
  }

  excludedSitesBtn.addEventListener('click', () => {
    renderExcludedList();
    newExcludeDomainInput.value = '';
    excludedSitesModal.style.display = 'flex';
  });

  function handleAddExcludedDomain() {
    let domain = newExcludeDomainInput.value.trim().toLowerCase();
    domain = domain.replace(/^https?:\\/\\//, '').replace(/^www\\./, '').split('/')[0];
    if (!domain || !domain.includes('.')) {
      alert('Please enter a valid domain (e.g. competitor.com)');
      return;
    }
    if (excludedDomains.includes(domain)) {
      alert('Domain is already excluded');
      return;
    }

    excludedDomains = [domain, ...excludedDomains];
    newExcludeDomainInput.value = '';
    saveData(renderExcludedList);
  }

  addExcludeDomainBtn.addEventListener('click', handleAddExcludedDomain);
  newExcludeDomainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddExcludedDomain();
  });

  resetExcludeDefaultsBtn.addEventListener('click', () => {
    excludedDomains = [...DEFAULT_EXCLUDED];
    saveData(() => {
      renderExcludedList();
      showToast('Reset excluded domains to default social platforms');
    });
  });

  loadData();
});
`;

  const readmeMd = `# LeadScrape Pro - Chrome Extension & Offline Prospect CRM

## 100% Offline Standalone Architecture
The CRM Dashboard is bundled **directly inside the extension** (\`dashboard.html\`).
- Clicking **"🚀 Open Offline CRM Dashboard"** opens \`chrome-extension://[id]/dashboard.html\`.
- It works **100% offline**, requires **zero internet access**, and **never opens AI Studio or triggers 403 Forbidden errors**.

## Features:
1. **Automatic Background Ingestion**: All visible emails on websites you visit are automatically saved to your local CRM database. No manual copying or pasting needed!
2. **Hidden Spam Trap Bypass**: Detects and ignores \`display:none\`, \`visibility:hidden\`, \`type="hidden"\`, and honeypot traps.
3. **Outbound Link Grabber**: Dedicated tab in the popup extension that captures external outbound links, strips in-links/anchors, and extracts target domains and anchor texts with CSV export.
4. **Excluded Sites Blacklist**: Pre-configured with major social networks and search engines; supports adding custom domains to bypass scraping.
5. **1-Click Gmail Collaboration Outreach**: Pre-fills Jerry's guest post and content collaboration template for Sustainable Growth Experts, automatically hyperlinking the target website and tagging the lead as outreached.
6. **CSV Import**: Import leads from CSV files with auto column mapping, strict \`mailto:\` stripping, and deduplication.
7. **Strictly No "mailto:"**: All emails are cleaned without \`mailto:\` prefixes or URL query strings.
8. **Website Grouping & Filtering**: Easily filter all leads by website brand or domain.
9. **Color-Coded Tag System & Follow-Up Reminders**: Organize leads by custom categories with overdue date alerts.
10. **100% Offline Standalone Architecture**: Runs directly inside \`chrome-extension://[id]/dashboard.html\` without remote servers or 403 errors.

## How to Install in Google Chrome:
1. Extract the downloaded \`leadscrape-pro-extension.zip\` file.
2. In Google Chrome, go to \`chrome://extensions/\`
3. In the top-right corner, turn ON **Developer mode**.
4. Click **Load unpacked** in the top-left corner.
5. Select the extracted \`leadscrape-pro-extension\` folder.
6. The LeadScrape Pro icon will appear in your Chrome extensions bar! Shortcut: \`Ctrl+Shift+L\` or \`Cmd+Shift+L\`.
7. Click the extension icon and click **"🚀 Open Offline CRM Dashboard"** to view your offline CRM dashboard at \`chrome-extension://[id]/dashboard.html\`!
`;

  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'background.js': backgroundJs,
    'content.js': contentJs,
    'content.css': contentCss,
    'popup.html': popupHtml,
    'popup.js': popupJs,
    'dashboard.html': dashboardHtml,
    'dashboard.js': dashboardJs,
    'dashboard.css': dashboardCss,
    'icon.svg': EXTENSION_ICON_SVG,
    'README.md': readmeMd
  };
}

/**
 * Builds and downloads a ready-to-load Chrome Extension ZIP file containing code and icons
 */
export async function downloadExtensionZip(
  customTemplate?: EmailTemplate,
  customFollowUpTemplate?: FollowUpTemplate,
  googleSheetConfig?: GoogleSheetSyncConfig
): Promise<void> {
  const files = getExtensionSourceFiles(customTemplate, customFollowUpTemplate, googleSheetConfig);
  const zip = new JSZip();

  const folder = zip.folder('leadscrape-pro-extension') || zip;

  // Add source code text files
  Object.entries(files).forEach(([filename, content]) => {
    folder.file(filename, content);
  });

  // Generate and bundle binary PNG icons
  try {
    const icon16Base64 = generateIconPngBase64(16);
    const icon48Base64 = generateIconPngBase64(48);
    const icon128Base64 = generateIconPngBase64(128);

    if (icon16Base64) folder.file('icon16.png', icon16Base64, { base64: true });
    if (icon48Base64) folder.file('icon48.png', icon48Base64, { base64: true });
    if (icon128Base64) folder.file('icon128.png', icon128Base64, { base64: true });
  } catch (e) {
    console.warn('Canvas icon generation error, SVG is available', e);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'leadscrape-pro-extension.zip');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
