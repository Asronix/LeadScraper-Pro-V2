import type { Lead, Tag, OutboundLink } from '../types/index.ts';
import { sanitizeEmail, isValidEmail, extractDomain, extractWebsiteName } from './scraper.ts';

/**
 * Escapes a single CSV value according to RFC 4180
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If string contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates formatted CSV string from leads array
 */
export function generateLeadsCsv(leads: Lead[], tagsMap?: Map<string, Tag>): string {
  const headers = [
    'Email',
    'Website Name',
    'Domain',
    'Source URL',
    'Status',
    'Outreached Date',
    'Discovered Date',
    'Tags',
    'Follow-up Reminder Date',
    'Notes'
  ];

  const rows = leads.map(lead => {
    // Map tag ids to tag names
    const tagNames = lead.tags
      .map(tid => (tagsMap && tagsMap.get(tid)?.name) || tid)
      .join(', ');

    return [
      escapeCsvValue(lead.email),
      escapeCsvValue(lead.websiteName),
      escapeCsvValue(lead.domain),
      escapeCsvValue(lead.url),
      escapeCsvValue(lead.status.toUpperCase()),
      escapeCsvValue(lead.outreachedAt ? new Date(lead.outreachedAt).toLocaleString() : 'Not Outreached'),
      escapeCsvValue(new Date(lead.discoveredAt).toLocaleString()),
      escapeCsvValue(tagNames),
      escapeCsvValue(lead.followUpDate || 'None'),
      escapeCsvValue(lead.notes || '')
    ].join(',');
  });

  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * Generates formatted CSV string from outbound links
 */
export function generateOutboundLinksCsv(links: OutboundLink[], sourceUrl?: string): string {
  const headers = ['Domain', 'Anchor Text', 'Target URL', 'Source URL'];
  const rows = links.map(link => [
    escapeCsvValue(link.domain),
    escapeCsvValue(link.anchorText || ''),
    escapeCsvValue(link.url),
    escapeCsvValue(sourceUrl || '')
  ].join(','));

  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * RFC 4180 Compliant CSV parser that handles quoted strings, escaped quotes, and newlines
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // End of row
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0].trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
    } else {
      currentField += char;
    }
  }

  // Add final field and row if any left
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0].trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface ParsedCsvLeadsResult {
  leads: Partial<Lead>[];
  totalParsedRows: number;
  validLeadsCount: number;
  duplicateEmailsSkipped: number;
  invalidRowsSkipped: number;
  detectedHeaders: string[];
}

/**
 * Parses raw CSV content into Lead objects, stripping mailto: and mapping columns flexibly
 */
export function parseCsvLeads(csvText: string): ParsedCsvLeadsResult {
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length === 0) {
    return {
      leads: [],
      totalParsedRows: 0,
      validLeadsCount: 0,
      duplicateEmailsSkipped: 0,
      invalidRowsSkipped: 0,
      detectedHeaders: []
    };
  }

  // Header detection
  const headerRow = rawRows[0].map(h => h.trim().toLowerCase());
  let emailColIdx = -1;
  let websiteColIdx = -1;
  let domainColIdx = -1;
  let urlColIdx = -1;
  let statusColIdx = -1;
  let notesColIdx = -1;
  let followUpColIdx = -1;

  headerRow.forEach((col, idx) => {
    if (['email', 'email address', 'e-mail', 'contact email', 'lead email'].includes(col)) emailColIdx = idx;
    else if (['website', 'website name', 'company', 'brand', 'company name', 'site'].includes(col)) websiteColIdx = idx;
    else if (['domain', 'host', 'hostname'].includes(col)) domainColIdx = idx;
    else if (['url', 'source url', 'page url', 'link', 'webpage'].includes(col)) urlColIdx = idx;
    else if (['status', 'outreach status'].includes(col)) statusColIdx = idx;
    else if (['notes', 'note', 'context', 'comments', 'details'].includes(col)) notesColIdx = idx;
    else if (['follow-up reminder date', 'followup', 'follow up', 'reminder', 'reminder date'].includes(col)) followUpColIdx = idx;
  });

  // If no email header matched, try to infer from data or use first column
  let dataRows = rawRows.slice(1);
  if (emailColIdx === -1) {
    // Check if row 0 was actually data without a header
    const sampleVal = sanitizeEmail(rawRows[0][0]);
    if (isValidEmail(sampleVal)) {
      emailColIdx = 0;
      dataRows = rawRows; // include row 0 as data
    } else {
      // Try to find any column where row 1 has a valid email
      if (rawRows.length > 1) {
        for (let c = 0; c < rawRows[1].length; c++) {
          if (isValidEmail(sanitizeEmail(rawRows[1][c]))) {
            emailColIdx = c;
            break;
          }
        }
      }
    }
  }

  if (emailColIdx === -1) {
    emailColIdx = 0; // Default to first column
  }

  const seenEmails = new Set<string>();
  const leads: Partial<Lead>[] = [];
  let invalidRowsSkipped = 0;
  let duplicateEmailsSkipped = 0;

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const rawEmail = row[emailColIdx];
    const cleanedEmail = sanitizeEmail(rawEmail || '');

    if (!cleanedEmail || !isValidEmail(cleanedEmail)) {
      invalidRowsSkipped++;
      continue;
    }

    if (seenEmails.has(cleanedEmail)) {
      duplicateEmailsSkipped++;
      continue;
    }
    seenEmails.add(cleanedEmail);

    const rawUrl = urlColIdx !== -1 && row[urlColIdx] ? row[urlColIdx].trim() : '';
    const rawDomain = domainColIdx !== -1 && row[domainColIdx]
      ? row[domainColIdx].trim().toLowerCase()
      : (rawUrl ? extractDomain(rawUrl) : extractDomain(cleanedEmail));

    const rawWebsite = websiteColIdx !== -1 && row[websiteColIdx]
      ? row[websiteColIdx].trim()
      : (rawUrl ? extractWebsiteName(rawUrl) : extractWebsiteName(rawDomain));

    const rawStatus = statusColIdx !== -1 && row[statusColIdx]
      ? row[statusColIdx].trim().toLowerCase()
      : 'uncontacted';

    const validStatus = ['uncontacted', 'outreached', 'replied', 'converted', 'bounced'].includes(rawStatus)
      ? (rawStatus as Lead['status'])
      : 'uncontacted';

    const notes = notesColIdx !== -1 && row[notesColIdx] ? row[notesColIdx].trim() : '';
    const followUpDate = followUpColIdx !== -1 && row[followUpColIdx] ? row[followUpColIdx].trim() : undefined;

    leads.push({
      id: 'import_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: cleanedEmail,
      websiteName: rawWebsite,
      domain: rawDomain,
      url: rawUrl || `https://${rawDomain}`,
      status: validStatus,
      discoveredAt: new Date().toISOString(),
      tags: [],
      notes: notes || 'Imported via CSV',
      followUpDate: followUpDate && /^\d{4}-\d{2}-\d{2}$/.test(followUpDate) ? followUpDate : undefined
    });
  }

  return {
    leads,
    totalParsedRows: dataRows.length,
    validLeadsCount: leads.length,
    duplicateEmailsSkipped,
    invalidRowsSkipped,
    detectedHeaders: rawRows[0] || []
  };
}

/**
 * Trigger direct client-side CSV download
 */
export function downloadCsvFile(csvContent: string, filename: string = 'leadscrape-leads.csv'): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
