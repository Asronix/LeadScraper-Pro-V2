import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { parseCsvLeads, ParsedCsvLeadsResult } from '../utils/csv.ts';
import type { Lead, Tag } from '../types/index.ts';

interface CsvImportModalProps {
  tags: Tag[];
  onImportLeads: (newLeads: Lead[]) => void;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  tags,
  onImportLeads,
  onClose
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedCsvLeadsResult | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [importTab, setImportTab] = useState<'upload' | 'paste'>('upload');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      setCsvContent(text);
      const res = parseCsvLeads(text);
      setParsedResult(res);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setCsvContent(text);
    if (text.trim().length > 0) {
      const res = parseCsvLeads(text);
      setParsedResult(res);
    } else {
      setParsedResult(null);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.leads.length === 0) return;

    const fullLeads: Lead[] = parsedResult.leads.map((partial, idx) => ({
      id: partial.id || 'imported_' + Date.now() + '_' + idx,
      email: partial.email || '',
      domain: partial.domain || 'unknown',
      websiteName: partial.websiteName || 'Imported Prospect',
      url: partial.url || '',
      discoveredAt: partial.discoveredAt || new Date().toISOString(),
      status: partial.status || 'uncontacted',
      tags: selectedTagId ? [selectedTagId] : [],
      notes: partial.notes || 'Imported from CSV',
      followUpDate: partial.followUpDate
    }));

    onImportLeads(fullLeads);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import Leads from CSV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload CSV files with columns for Email, Website, Domain, URL, or Notes. Strictly strips <code className="text-rose-500 font-mono">mailto:</code> prefixes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setImportTab('upload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              importTab === 'upload'
                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Upload .CSV File
          </button>
          <button
            onClick={() => setImportTab('paste')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              importTab === 'paste'
                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Paste Raw CSV Text
          </button>
        </div>

        {/* Upload Mode */}
        {importTab === 'upload' && (
          <div className="space-y-3">
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-slate-50/50 dark:bg-slate-800/20">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {fileName ? fileName : 'Click to browse or drop CSV file here'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Supports RFC 4180 format with commas and quote escaping
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Paste Mode */}
        {importTab === 'paste' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Paste CSV text:
            </label>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder={`"Email","Website Name","Domain","URL"\n"dr.smith@healthclinic.org","Health Clinic","healthclinic.org","https://healthclinic.org/team"`}
              className="w-full font-mono text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        )}

        {/* Parsed Result Stats */}
        {parsedResult && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 rounded-xl p-2.5 text-center">
                <div className="text-base font-extrabold text-sky-600 dark:text-sky-400">
                  {parsedResult.validLeadsCount}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Valid Leads</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-2.5 text-center">
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {parsedResult.totalParsedRows}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Rows Parsed</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-2.5 text-center">
                <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {parsedResult.duplicateEmailsSkipped}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Duplicates Filtered</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-2.5 text-center">
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {parsedResult.invalidRowsSkipped}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Invalid Skipped</div>
              </div>
            </div>

            {/* Optional Tag assignment */}
            {tags.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                  Assign Tag to Imported Leads:
                </label>
                <select
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">No tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview of first 5 leads */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800/70 px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>Preview (First {Math.min(5, parsedResult.leads.length)} leads):</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Clean emails • Strictly no mailto:
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-36 overflow-y-auto">
                {parsedResult.leads.slice(0, 5).map((l, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                      {l.email}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {l.websiteName || l.domain}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parsedResult || parsedResult.validLeadsCount === 0}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>Import {parsedResult?.validLeadsCount || 0} Leads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
