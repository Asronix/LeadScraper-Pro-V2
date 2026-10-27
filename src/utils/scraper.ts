import type { ScrapeAnalysisResult, ScrapedEmailItem } from '../types/index.ts';

/**
 * Standard RFC 5322 compatible email extraction regex.
 * Designed to capture emails cleanly and avoid trailing punctuation like periods or commas.
 */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/gi;

/**
 * Common fake/example or tracking strings to filter out
 */
const JUNK_DOMAINS = ['example.com', 'sample.com', 'yourdomain.com', 'domain.com', 'email.com', 'placeholder.com'];

/**
 * Clean and normalize email address
 */
export function sanitizeEmail(rawEmail: string): string {
  if (!rawEmail) return '';
  let cleaned = rawEmail.trim();
  // Strip mailto: prefix case-insensitively (e.g. mailto:user@domain.com, MAILTO:user@domain.com)
  cleaned = cleaned.replace(/^mailto:\s*/i, '');
  // Remove query parameters from mailto links e.g. ?subject=Hi&body=Hello
  if (cleaned.includes('?')) {
    cleaned = cleaned.split('?')[0];
  }
  // Strip unwanted trailing punctuation and closing brackets/quotes
  cleaned = cleaned.replace(/[.,;:!?)'"\]}>]+$/, '');
  cleaned = cleaned.replace(/^[<('"{[]+/, '');
  // Double check in case of nested brackets like <mailto:user@domain.com>
  cleaned = cleaned.replace(/^mailto:\s*/i, '');
  return cleaned.trim().toLowerCase();
}

/**
 * Validates whether string is a plausible email
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [user, domain] = parts;
  if (!user || !domain) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  
  // Avoid common dummy domains if needed, but allow valid test emails
  return true;
}

/**
 * Extract clean domain name from URL or email
 */
export function extractDomain(input: string): string {
  if (!input) return 'unknown';
  try {
    let clean = input.trim();
    if (clean.includes('@')) {
      return clean.split('@')[1].toLowerCase();
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    const parts = input.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0];
    return parts.toLowerCase() || 'unknown';
  }
}

/**
 * Extract website brand name from URL or hostname
 */
export function extractWebsiteName(url: string, pageTitle?: string): string {
  if (pageTitle && pageTitle.trim().length > 0 && !pageTitle.includes('404')) {
    // If title is like "Acme Corp | Leading AI Tools", extract the brand
    const parts = pageTitle.split(/[-|–—:•]/);
    if (parts[0] && parts[0].trim().length > 1 && parts[0].trim().length < 35) {
      return parts[0].trim();
    }
  }

  const domain = extractDomain(url);
  const namePart = domain.split('.')[0];
  if (!namePart) return 'Webpage';
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

/**
 * Checks if a standalone snippet has hidden CSS or attributes
 */
export function isSnippetHidden(snippet: string): { isHidden: boolean; reason?: string } {
  const lower = snippet.toLowerCase();
  if (/display\s*:\s*none/i.test(lower)) return { isHidden: true, reason: 'CSS display: none' };
  if (/visibility\s*:\s*hidden/i.test(lower)) return { isHidden: true, reason: 'CSS visibility: hidden' };
  if (/opacity\s*:\s*0(?![.0-9])/i.test(lower)) return { isHidden: true, reason: 'CSS opacity: 0' };
  if (/type\s*=\s*["']hidden["']/i.test(lower)) return { isHidden: true, reason: 'Hidden input field' };
  if (/aria-hidden\s*=\s*["']true["']/i.test(lower)) return { isHidden: true, reason: 'aria-hidden="true"' };
  if (/\bhidden\b/i.test(lower)) return { isHidden: true, reason: 'HTML hidden attribute' };
  return { isHidden: false };
}

/**
 * Checks if a specific position in an HTML string is inside a hidden tag or parent container.
 */
export function isPositionHiddenInHtml(html: string, pos: number): { isHidden: boolean; reason?: string } {
  // 1. Check if the email itself is inside a tag's attributes (e.g. <input type="hidden" value="email">)
  const prevOpening = html.lastIndexOf('<', pos);
  const nextClosing = html.indexOf('>', pos);
  const prevClosing = html.lastIndexOf('>', pos);

  // If prevOpening > prevClosing and nextClosing > pos, we are inside an HTML tag declaration
  if (prevOpening !== -1 && prevOpening > prevClosing && nextClosing > pos) {
    const tagContent = html.substring(prevOpening, nextClosing + 1).toLowerCase();
    if (/type\s*=\s*["']hidden["']/i.test(tagContent)) {
      return { isHidden: true, reason: 'Hidden input field (type="hidden")' };
    }
    if (/display\s*:\s*none/i.test(tagContent)) {
      return { isHidden: true, reason: 'Tag has style="display:none"' };
    }
    if (/visibility\s*:\s*hidden/i.test(tagContent)) {
      return { isHidden: true, reason: 'Tag has style="visibility:hidden"' };
    }
    if (/\bhidden\b/i.test(tagContent)) {
      return { isHidden: true, reason: 'Tag has HTML hidden attribute' };
    }
  }

  // 2. Scan backwards for unclosed parent tags before `pos`
  // We match tags from the start up to pos
  const textBefore = html.substring(0, pos);
  
  // Track open tags and their hidden attributes
  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;
  const tagStack: { tag: string; isHidden: boolean; reason?: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(textBefore)) !== null) {
    const isClosing = m[0].startsWith('</');
    const tagName = m[1].toLowerCase();
    const attrs = m[2] ? m[2].toLowerCase() : '';

    // Ignore self-closing or void tags
    const isVoid = ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName);

    if (isClosing) {
      // Pop matching tag from stack
      for (let i = tagStack.length - 1; i >= 0; i--) {
        if (tagStack[i].tag === tagName) {
          tagStack.splice(i, 1);
          break;
        }
      }
    } else if (!isVoid && !m[0].endsWith('/>')) {
      let isHidden = false;
      let reason: string | undefined;

      if (/display\s*:\s*none/i.test(attrs)) {
        isHidden = true;
        reason = 'Parent <' + tagName + '> has CSS display: none';
      } else if (/visibility\s*:\s*hidden/i.test(attrs)) {
        isHidden = true;
        reason = 'Parent <' + tagName + '> has CSS visibility: hidden';
      } else if (/opacity\s*:\s*0(?![.0-9])/i.test(attrs)) {
        isHidden = true;
        reason = 'Parent <' + tagName + '> has CSS opacity: 0';
      } else if (/aria-hidden\s*=\s*["']true["']/i.test(attrs)) {
        isHidden = true;
        reason = 'Parent <' + tagName + '> has aria-hidden="true"';
      } else if (/\bhidden\b/i.test(attrs)) {
        isHidden = true;
        reason = 'Parent <' + tagName + '> has hidden attribute';
      } else if (['script', 'style', 'template', 'noscript'].includes(tagName)) {
        isHidden = true;
        reason = 'Inside non-rendered <' + tagName + '> block';
      }

      tagStack.push({ tag: tagName, isHidden, reason });
    }
  }

  // If any open parent in tagStack is hidden, the email is hidden
  for (let i = tagStack.length - 1; i >= 0; i--) {
    if (tagStack[i].isHidden) {
      return { isHidden: true, reason: tagStack[i].reason };
    }
  }

  return { isHidden: false };
}

/**
 * Scrapes and classifies emails from HTML/text content.
 * Distinguishes visible from hidden emails.
 */
export function parseAndClassifyEmails(
  rawContent: string,
  pageUrl: string = 'https://example.com',
  pageTitle: string = 'Sample Page'
): ScrapeAnalysisResult {
  const visibleEmails = new Set<string>();
  const hiddenEmails = new Map<string, string>(); // email -> reason
  const scrapedItems: ScrapedEmailItem[] = [];

  // Match all potential emails in content
  const matches = rawContent.match(EMAIL_REGEX) || [];
  const uniqueCandidates = Array.from(new Set(matches.map(sanitizeEmail))).filter(isValidEmail);

  const lowerContent = rawContent.toLowerCase();

  // Analyze each email candidate with its surrounding context
  for (const candidate of uniqueCandidates) {
    const candidateLower = candidate.toLowerCase();
    const index = lowerContent.indexOf(candidateLower);

    const start = Math.max(0, index - 60);
    const end = Math.min(rawContent.length, index + candidate.length + 60);
    const contextSnippet = rawContent.substring(start, end).replace(/\s+/g, ' ').trim();

    const hiddenCheck = index !== -1 ? isPositionHiddenInHtml(rawContent, index) : { isHidden: false };

    if (hiddenCheck.isHidden) {
      hiddenEmails.set(candidate, hiddenCheck.reason || 'Hidden element');
      scrapedItems.push({
        email: candidate,
        contextSnippet,
        isVisible: false,
        bypassReason: hiddenCheck.reason,
        foundIn: 'hidden'
      });
    } else {
      visibleEmails.add(candidate);
      scrapedItems.push({
        email: candidate,
        contextSnippet,
        isVisible: true,
        foundIn: contextSnippet.toLowerCase().includes('mailto:') ? 'mailto' : 'text'
      });
    }
  }

  const visibleList = Array.from(visibleEmails);
  const hiddenList = Array.from(hiddenEmails.entries()).map(([email, reason]) => ({ email, reason }));

  return {
    websiteName: extractWebsiteName(pageUrl, pageTitle),
    url: pageUrl,
    pageTitle,
    totalFound: visibleList.length + hiddenList.length,
    visibleEmails: visibleList,
    hiddenEmailsBypassed: hiddenList,
    scrapedItems,
    timestamp: new Date().toISOString()
  };
}

/**
 * Checks whether a given URL or domain is in the excluded domain list (e.g. facebook.com, twitter.com)
 */
export function isDomainExcluded(urlOrDomain: string, excludedList: string[]): boolean {
  if (!urlOrDomain || !excludedList || excludedList.length === 0) return false;
  const domain = extractDomain(urlOrDomain).toLowerCase();
  return excludedList.some(excluded => {
    const cleanExcluded = excluded.trim().toLowerCase().replace(/^www\./, '');
    if (!cleanExcluded) return false;
    return domain === cleanExcluded || domain.endsWith('.' + cleanExcluded);
  });
}

/**
 * Extracts outbound links from an HTML string or document, filtering out internal in-links,
 * fragment anchors, javascript:, mailto:, and tel: schemes.
 */
export function extractOutboundLinksFromHtml(
  html: string,
  currentUrl: string,
  excludedList: string[] = []
): {
  url: string;
  domain: string;
  anchorText: string;
  isExcluded: boolean;
}[] {
  const outboundLinks: {
    url: string;
    domain: string;
    anchorText: string;
    isExcluded: boolean;
  }[] = [];

  const currentHost = extractDomain(currentUrl).toLowerCase();
  const seenUrls = new Set<string>();

  // Browser environment: use native DOMParser for 100% precision with live DOM
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const anchors = doc.querySelectorAll('a[href]');

      anchors.forEach(a => {
        const rawHref = a.getAttribute('href');
        if (!rawHref) return;
        const trimmed = rawHref.trim();
        if (
          !trimmed ||
          trimmed.startsWith('#') ||
          trimmed.toLowerCase().startsWith('javascript:') ||
          trimmed.toLowerCase().startsWith('mailto:') ||
          trimmed.toLowerCase().startsWith('tel:')
        ) {
          return;
        }

        try {
          const resolved = new URL(trimmed, currentUrl.startsWith('http') ? currentUrl : 'https://' + currentUrl);
          if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;

          const targetHost = resolved.hostname.replace(/^www\./, '').toLowerCase();

          // Skip internal in-links
          if (
            targetHost === currentHost ||
            targetHost.endsWith('.' + currentHost) ||
            currentHost.endsWith('.' + targetHost)
          ) {
            return;
          }

          const fullUrl = resolved.href;
          if (seenUrls.has(fullUrl)) return;
          seenUrls.add(fullUrl);

          const isExcluded = isDomainExcluded(targetHost, excludedList);
          const rawAnchor = (a.textContent || '').trim().replace(/\s+/g, ' ');

          outboundLinks.push({
            url: fullUrl,
            domain: targetHost,
            anchorText: rawAnchor || targetHost,
            isExcluded
          });
        } catch {}
      });

      return outboundLinks;
    } catch {}
  }

  // Regex fallback for non-DOM environments (Node.js tests / SSR)
  const linkRegex = /<a\b[^>]*?\bhref=(["']?)([^"'>\s]+)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[2].trim();
    const rawAnchorText = match[3].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');

    if (
      !rawHref ||
      rawHref.startsWith('#') ||
      rawHref.toLowerCase().startsWith('javascript:') ||
      rawHref.toLowerCase().startsWith('mailto:') ||
      rawHref.toLowerCase().startsWith('tel:')
    ) {
      continue;
    }

    try {
      // Resolve against currentUrl if relative
      const resolved = new URL(rawHref, currentUrl.startsWith('http') ? currentUrl : 'https://' + currentUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;

      const targetHost = resolved.hostname.replace(/^www\./, '').toLowerCase();

      // Check if it's an internal in-link (same domain or subdomain of current host)
      if (
        targetHost === currentHost ||
        targetHost.endsWith('.' + currentHost) ||
        currentHost.endsWith('.' + targetHost)
      ) {
        continue; // In-link, skip
      }

      const fullUrl = resolved.href;
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      const isExcluded = isDomainExcluded(targetHost, excludedList);

      outboundLinks.push({
        url: fullUrl,
        domain: targetHost,
        anchorText: rawAnchorText || targetHost,
        isExcluded
      });
    } catch {
      // invalid URL
    }
  }

  return outboundLinks;
}

/**
 * Formats outreach template variables with target website & lead details
 */
export function formatJerryCollaborationEmail(
  websiteName: string,
  websiteUrl: string,
  rawTemplate?: string,
  recipientEmail?: string
): string {
  const cleanSite = websiteName && websiteName !== 'Webpage' ? websiteName : extractWebsiteName(websiteUrl);
  const siteLinkDisplay = websiteUrl ? `${cleanSite} (${websiteUrl})` : cleanSite;
  const domain = extractDomain(websiteUrl || recipientEmail || '');
  const cleanEmailAddr = recipientEmail ? sanitizeEmail(recipientEmail) : '';

  const template = rawTemplate !== undefined && rawTemplate !== null ? rawTemplate : `Hi,

I’m Jerry from Sustainable Growth Experts. We’re currently looking to collaborate with reputable health and medical websites through guest articles or relevant contextual mentions in existing content on [Site Name and hyperlink to website].

We can provide:

  - Original, high-quality content written with medical accuracy
  - Content tailored to your audience, tone, and editorial guidelines

If you’re open to collaborations, we’d be happy to review your guidelines and requirements.

Looking forward to hearing from you and exploring a potential collaboration.

Best regards,
Jerry
Sustainable Growth Experts`;

  let text = template.replace(/\[Site Name and hyperlink to website\]/g, siteLinkDisplay);
  text = text.replace(/\{\{website\}\}/gi, cleanSite);
  text = text.replace(/\{\{site\}\}/gi, cleanSite);
  text = text.replace(/\{\{url\}\}/gi, websiteUrl || '');
  text = text.replace(/\{\{domain\}\}/gi, domain);
  text = text.replace(/\{\{email\}\}/gi, cleanEmailAddr);
  return text;
}

/**
 * Formats template subject line with dynamic variables
 */
export function formatEmailSubject(
  rawSubject: string,
  websiteName: string,
  websiteUrl: string,
  recipientEmail?: string
): string {
  const cleanSite = websiteName && websiteName !== 'Webpage' ? websiteName : extractWebsiteName(websiteUrl);
  const domain = extractDomain(websiteUrl || recipientEmail || '');
  let subj = rawSubject || 'Guest Article & Content Collaboration';
  subj = subj.replace(/\[Site Name and hyperlink to website\]/g, cleanSite);
  subj = subj.replace(/\{\{website\}\}/gi, cleanSite);
  subj = subj.replace(/\{\{site\}\}/gi, cleanSite);
  subj = subj.replace(/\{\{url\}\}/gi, websiteUrl || '');
  subj = subj.replace(/\{\{domain\}\}/gi, domain);
  subj = subj.replace(/\{\{email\}\}/gi, recipientEmail ? sanitizeEmail(recipientEmail) : '');
  return subj;
}

/**
 * Builds the direct Gmail Web Compose URL prefilled with lead email, subject, and personalized template.
 * Opens in browser without requiring OAuth credentials or API keys.
 */
export function buildGmailComposeUrl(
  toEmail: string,
  websiteName: string,
  websiteUrl: string,
  subject: string = 'Guest Article & Content Collaboration',
  customBody?: string
): string {
  const cleanTo = sanitizeEmail(toEmail);
  const personalizedSubject = formatEmailSubject(subject, websiteName, websiteUrl, toEmail);
  const personalizedBody = formatJerryCollaborationEmail(websiteName, websiteUrl, customBody, toEmail);

  const base = 'https://mail.google.com/mail/?view=cm&fs=1';
  const query = [
    `to=${encodeURIComponent(cleanTo)}`,
    `su=${encodeURIComponent(personalizedSubject)}`,
    `body=${encodeURIComponent(personalizedBody)}`
  ].join('&');

  return `${base}&${query}`;
}

/**
 * Formats Jerry's quick follow-up collaboration email
 */
export function formatFollowUpEmail(
  websiteName: string,
  websiteUrl: string,
  customTemplate?: string,
  recipientEmail?: string
): string {
  const cleanSite = websiteName && websiteName !== 'Webpage' ? websiteName : extractWebsiteName(websiteUrl);
  const domain = extractDomain(websiteUrl || recipientEmail || '');
  const cleanEmailAddr = recipientEmail ? sanitizeEmail(recipientEmail) : '';
  const siteLinkDisplay = websiteUrl ? `${cleanSite} (${websiteUrl})` : cleanSite;

  const defaultFollowUp = `Hi,

Following up on my previous note regarding a potential collaboration with ${cleanSite}.

Wanted to see if you had a chance to review my note, or if there's someone else on your team handling editorial and guest features?

Best regards,
Jerry
Sustainable Growth Experts`;

  const template = customTemplate || defaultFollowUp;

  let text = template.replace(/\[Site Name and hyperlink to website\]/g, siteLinkDisplay);
  text = text.replace(/\{\{website\}\}/gi, cleanSite);
  text = text.replace(/\{\{site\}\}/gi, cleanSite);
  text = text.replace(/\{\{url\}\}/gi, websiteUrl || '');
  text = text.replace(/\{\{domain\}\}/gi, domain);
  text = text.replace(/\{\{email\}\}/gi, cleanEmailAddr);
  return text;
}

/**
 * Builds direct Gmail Web Compose URL for quick follow-up
 */
export function buildGmailFollowUpComposeUrl(
  toEmail: string,
  websiteName: string,
  websiteUrl: string,
  subjectTemplate: string = 'Quick follow-up: Collaboration with {{website}}',
  bodyTemplate?: string
): string {
  const cleanTo = sanitizeEmail(toEmail);
  const personalizedSubject = formatEmailSubject(subjectTemplate, websiteName, websiteUrl, toEmail);
  const personalizedBody = formatFollowUpEmail(websiteName, websiteUrl, bodyTemplate, toEmail);

  const base = 'https://mail.google.com/mail/?view=cm&fs=1';
  const query = [
    `to=${encodeURIComponent(cleanTo)}`,
    `su=${encodeURIComponent(personalizedSubject)}`,
    `body=${encodeURIComponent(personalizedBody)}`
  ].join('&');

  return `${base}&${query}`;
}
