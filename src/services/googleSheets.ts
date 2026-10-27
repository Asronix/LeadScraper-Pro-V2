import type { Lead, GoogleSheetSyncConfig } from '../types/index.ts';
import { sanitizeEmail, extractDomain, extractWebsiteName } from '../utils/scraper.ts';

const SHEET_HEADERS = [
  'Lead ID',
  'Email',
  'Website Name',
  'Domain',
  'URL',
  'Status',
  'Outreached At',
  'Follow-up Date',
  'Sequence Step',
  'Tags',
  'Notes',
  'Discovered At'
];

/**
 * Creates a new Google Spreadsheet titled "LeadScrape Pro - Live CRM Leads"
 */
export async function createLeadsSpreadsheet(
  accessToken: string,
  title: string = 'LeadScrape Pro - Live CRM Leads'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; sheetName: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      },
      sheets: [
        {
          properties: {
            title: 'Leads',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create Google Spreadsheet: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const sheetName = data.sheets?.[0]?.properties?.title || 'Leads';
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write headers to the newly created sheet
  await updateSheetValues(accessToken, spreadsheetId, `${sheetName}!A1:L1`, [SHEET_HEADERS]);

  return {
    spreadsheetId,
    spreadsheetUrl,
    sheetName
  };
}

/**
 * Retrieves the first tab name for a spreadsheet to avoid assuming "Sheet1"
 */
export async function getSpreadsheetFirstSheetName(
  accessToken: string,
  spreadsheetId: string
): Promise<string> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    return 'Sheet1';
  }

  const data = await res.json();
  return data.sheets?.[0]?.properties?.title || 'Sheet1';
}

/**
 * Writes or overwrites values in a specified Google Sheet range
 */
export async function updateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> {
  const encodedRange = encodeURIComponent(range);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update sheet values: ${response.status} ${err}`);
  }
}

/**
 * Uploads all CRM leads simultaneously to Google Sheets
 */
export async function syncAllLeadsToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  leads: Lead[],
  sheetName: string = 'Leads'
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const rows: (string | number)[][] = [
    SHEET_HEADERS,
    ...leads.map(lead => [
      lead.id,
      sanitizeEmail(lead.email),
      lead.websiteName || '',
      lead.domain || extractDomain(lead.url || lead.email),
      lead.url || '',
      lead.status || 'uncontacted',
      lead.outreachedAt || '',
      lead.followUpDate || '',
      lead.sequenceStep ? `Step ${lead.sequenceStep}` : '',
      Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
      lead.notes || '',
      lead.discoveredAt || ''
    ])
  ];

  // Clear existing cells then write entire block
  const clearRange = encodeURIComponent(`${sheetName}!A1:Z${Math.max(rows.length + 50, 100)}`);
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${clearRange}:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }).catch(() => {
    // Ignore clear error if blank
  });

  await updateSheetValues(accessToken, cleanId, `${sheetName}!A1:L${rows.length}`, rows);
}

/**
 * Appends new leads to the bottom of the Google Sheet
 */
export async function appendLeadsToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  newLeads: Lead[],
  sheetName: string = 'Leads'
): Promise<void> {
  if (newLeads.length === 0) return;

  const rows = newLeads.map(lead => [
    lead.id,
    sanitizeEmail(lead.email),
    lead.websiteName || '',
    lead.domain || extractDomain(lead.url || lead.email),
    lead.url || '',
    lead.status || 'uncontacted',
    lead.outreachedAt || '',
    lead.followUpDate || '',
    lead.sequenceStep ? `Step ${lead.sequenceStep}` : '',
    Array.isArray(lead.tags) ? lead.tags.join(', ') : '',
    lead.notes || '',
    lead.discoveredAt || ''
  ]);

  const encodedRange = encodeURIComponent(`${sheetName}!A1`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: rows
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to append rows to Google Sheet: ${response.status} ${err}`);
  }
}

import { parseCsvRows } from '../utils/csv.ts';

/**
 * Helper to safely extract Spreadsheet ID from raw ID or Google Sheets URL
 */
export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

/**
 * Fetches and parses all leads from the connected Google Sheet to display in the dashboard.
 * Supports official v4 API with accessToken, or public link-shared sheets via CSV export.
 */
export async function fetchLeadsFromGoogleSheet(
  accessToken: string | null | undefined,
  spreadsheetId: string,
  sheetName: string = 'Leads'
): Promise<Lead[]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId) return [];

  let rows: string[][] = [];

  if (accessToken) {
    const range = encodeURIComponent(`${sheetName}!A1:L2000`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      rows = data.values || [];
    } else {
      const err = await response.text();
      console.warn(`v4 API read failed (${response.status}), falling back to public export:`, err);
    }
  }

  // If no accessToken or v4 API failed, try public CSV export
  if (rows.length === 0) {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    try {
      const csvRes = await fetch(exportUrl);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        rows = parseCsvRows(csvText);
      }
    } catch (e) {
      console.warn('Direct gviz fetch failed, trying proxy...', e);
    }

    // Backend proxy fallback if direct fetch was blocked by CORS or network
    if (rows.length === 0) {
      try {
        const proxyRes = await fetch(`/api/scrape-url?url=${encodeURIComponent(exportUrl)}`);
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          if (proxyData.html) {
            rows = parseCsvRows(proxyData.html);
          }
        }
      } catch (err) {
        console.warn('Proxy gviz fetch failed:', err);
      }
    }
  }

  if (rows.length === 0) {
    throw new Error(
      `Could not read Google Sheet '${cleanId}'. Make sure the sheet's Share settings are set to 'Anyone with the link can view' (or edit).`
    );
  }

  if (rows.length <= 1) {
    return []; // Only header or empty
  }

  // Row 0 is header - detect column positions dynamically
  const headers = rows[0].map(h => (h || '').toLowerCase().trim());
  const colId = headers.findIndex(h => /^(lead\s*id|id)$/i.test(h));
  const colEmail = headers.findIndex(h => /email/i.test(h));
  const colWebsite = headers.findIndex(h => /(website|company|site)/i.test(h));
  const colDomain = headers.findIndex(h => /domain/i.test(h));
  const colUrl = headers.findIndex(h => /(url|source|link)/i.test(h));
  const colStatus = headers.findIndex(h => /status/i.test(h));
  const colOutreach = headers.findIndex(h => /(outreach|contacted)/i.test(h));
  const colFollowUp = headers.findIndex(h => /(follow.*up|reminder)/i.test(h));
  const colSequence = headers.findIndex(h => /(sequence|step)/i.test(h));
  const colTags = headers.findIndex(h => /(tag|category)/i.test(h));
  const colNotes = headers.findIndex(h => /note/i.test(h));
  const colDiscovered = headers.findIndex(h => /(discover|date|created)/i.test(h));

  const leads: Lead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Find email either by matched column or by searching cells for '@'
    let email = colEmail !== -1 ? sanitizeEmail(row[colEmail] || '') : '';
    if (!email || !email.includes('@')) {
      const emailCell = row.find(c => c && typeof c === 'string' && c.includes('@'));
      if (emailCell) email = sanitizeEmail(emailCell);
    }
    if (!email || !email.includes('@')) continue;

    const id = (colId !== -1 && row[colId]) || `gsheet_${Date.now()}_${i}`;
    const websiteName = (colWebsite !== -1 && row[colWebsite]) || extractWebsiteName(row[colUrl] || email);
    const domain = (colDomain !== -1 && row[colDomain]) || extractDomain(row[colUrl] || email);
    const url = (colUrl !== -1 && row[colUrl]) || '';
    
    const rawStatus = (colStatus !== -1 && row[colStatus]) || 'uncontacted';
    const status = (['uncontacted', 'outreached', 'replied', 'converted', 'bounced'].includes(rawStatus.toLowerCase())
      ? rawStatus.toLowerCase()
      : 'uncontacted') as any;

    const outreachedAt = (colOutreach !== -1 && row[colOutreach]) || undefined;
    const followUpDate = (colFollowUp !== -1 && row[colFollowUp]) || undefined;
    
    let sequenceStep: number | undefined = undefined;
    if (colSequence !== -1 && row[colSequence]) {
      const match = String(row[colSequence]).match(/\d+/);
      if (match) sequenceStep = parseInt(match[0], 10);
    }

    const rawTags = (colTags !== -1 && row[colTags]) || '';
    const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const notes = (colNotes !== -1 && row[colNotes]) || '';
    const discoveredAt = (colDiscovered !== -1 && row[colDiscovered]) || new Date().toISOString();

    leads.push({
      id,
      email,
      websiteName,
      domain,
      url,
      status,
      outreachedAt,
      followUpDate,
      sequenceStep,
      tags,
      notes,
      discoveredAt
    });
  }

  return leads;
}
