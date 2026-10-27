import type { Lead, GoogleSheetSyncConfig } from '../types/index.ts';
import { sanitizeEmail, extractDomain } from '../utils/scraper.ts';

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
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }).catch(() => {
    // Ignore clear error if blank
  });

  await updateSheetValues(accessToken, spreadsheetId, `${sheetName}!A1:L${rows.length}`, rows);
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

/**
 * Fetches and parses all leads from the connected Google Sheet to display in the dashboard
 */
export async function fetchLeadsFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string = 'Leads'
): Promise<Lead[]> {
  const range = encodeURIComponent(`${sheetName}!A1:L2000`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to read leads from Google Sheet: ${response.status} ${err}`);
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  if (rows.length <= 1) {
    return []; // Only header or empty
  }

  // Row 0 is header; data rows start at index 1
  const leads: Lead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const email = sanitizeEmail(row[1] || '');
    if (!email || !email.includes('@')) continue;

    const id = row[0] || `gsheet_${Date.now()}_${i}`;
    const websiteName = row[2] || 'Lead Prospect';
    const domain = row[3] || extractDomain(row[4] || email);
    const url = row[4] || '';
    const status = (['uncontacted', 'outreached', 'replied', 'converted', 'bounced'].includes(row[5])
      ? row[5]
      : 'uncontacted') as any;
    const outreachedAt = row[6] || undefined;
    const followUpDate = row[7] || undefined;
    let sequenceStep: number | undefined = undefined;
    if (row[8]) {
      const match = String(row[8]).match(/\d+/);
      if (match) sequenceStep = parseInt(match[0], 10);
    }
    const tags = row[9] ? row[9].split(',').map(t => t.trim()).filter(Boolean) : [];
    const notes = row[10] || '';
    const discoveredAt = row[11] || new Date().toISOString();

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
