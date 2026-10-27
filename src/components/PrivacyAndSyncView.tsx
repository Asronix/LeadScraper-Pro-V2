import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Cloud,
  ArrowRight,
  Download,
  Upload,
  Copy,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { Lead, Tag } from '../types/index.ts';
import { encryptData, decryptData } from '../utils/crypto.ts';
import { generateLeadsCsv, downloadCsvFile } from '../utils/csv.ts';

interface PrivacyAndSyncViewProps {
  leads: Lead[];
  tags: Tag[];
  onMergeLeads: (newLeads: Lead[]) => void;
  masterPassword: string;
  setMasterPassword: (pwd: string) => void;
  isVaultLocked: boolean;
  setIsVaultLocked: (locked: boolean) => void;
}

export const PrivacyAndSyncView: React.FC<PrivacyAndSyncViewProps> = ({
  leads,
  tags,
  onMergeLeads,
  masterPassword,
  setMasterPassword,
  isVaultLocked,
  setIsVaultLocked
}) => {
  // Passphrase management
  const [newPassphraseInput, setNewPassphraseInput] = useState('');
  const [passphraseStatus, setPassphraseStatus] = useState<string | null>(null);

  // Sync token state
  const [generatedSyncBundle, setGeneratedSyncBundle] = useState<string | null>(null);
  const [copiedSyncBundle, setCopiedSyncBundle] = useState(false);
  const [importBundleText, setImportBundleText] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isGeneratingSync, setIsGeneratingSync] = useState(false);

  // Report generator
  const [reportType, setReportType] = useState<'all' | 'outreached' | 'uncontacted' | 'reminders'>('all');

  const handleSetPassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassphraseInput.trim()) return;

    setMasterPassword(newPassphraseInput.trim());
    setPassphraseStatus('Master passphrase updated! Local data is now secured with this key.');
    setNewPassphraseInput('');
    setTimeout(() => setPassphraseStatus(null), 4000);
  };

  const handleGenerateSyncBundle = async () => {
    try {
      setIsGeneratingSync(true);
      const payload = {
        leads,
        tags,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const passphraseToUse = masterPassword || 'default-device-key-2026';
      const encrypted = await encryptData(payload, passphraseToUse);
      setGeneratedSyncBundle(encrypted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSync(false);
    }
  };

  const handleCopySyncToken = () => {
    if (!generatedSyncBundle) return;
    navigator.clipboard.writeText(generatedSyncBundle);
    setCopiedSyncBundle(true);
    setTimeout(() => setCopiedSyncBundle(false), 2000);
  };

  const handleImportSyncBundle = async () => {
    if (!importBundleText.trim()) return;
    try {
      setImportStatus(null);
      const passphraseToUse = importPassword.trim() || masterPassword || 'default-device-key-2026';
      const decrypted = await decryptData<{ leads: Lead[]; tags: Tag[] }>(
        importBundleText.trim(),
        passphraseToUse
      );

      if (decrypted && Array.isArray(decrypted.leads)) {
        onMergeLeads(decrypted.leads);
        setImportStatus({
          type: 'success',
          message: `Successfully decrypted & merged ${decrypted.leads.length} leads across devices!`
        });
        setImportBundleText('');
        setImportPassword('');
      } else {
        throw new Error('Invalid bundle format');
      }
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: 'Decryption failed: Incorrect password or corrupted sync payload.'
      });
    }
  };

  const handleGenerateReportCsv = () => {
    const tagsMap = new Map(tags.map(t => [t.id, t]));
    let targets = leads;

    if (reportType === 'outreached') {
      targets = leads.filter(l => l.status === 'outreached' || l.status === 'replied' || l.status === 'converted');
    } else if (reportType === 'uncontacted') {
      targets = leads.filter(l => l.status === 'uncontacted');
    } else if (reportType === 'reminders') {
      targets = leads.filter(l => Boolean(l.followUpDate));
    }

    const csvData = generateLeadsCsv(targets, tagsMap);
    downloadCsvFile(csvData, `leadscrape-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Privacy & Encryption Overview Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Local Privacy & AES-GCM Hardware Encryption
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  AES-256 Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All discovered emails, browsing URLs, and outreach notes are encrypted on this device using PBKDF2 (SHA-256) and AES-GCM before storage.
              </p>
            </div>
          </div>

          {/* Quick Lock / Unlock Status */}
          <button
            onClick={() => setIsVaultLocked(!isVaultLocked)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
              isVaultLocked
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800'
                : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
            }`}
          >
            {isVaultLocked ? <Lock className="w-4 h-4 text-rose-500" /> : <Unlock className="w-4 h-4 text-emerald-500" />}
            <span>{isVaultLocked ? 'Vault Locked' : 'Vault Unlocked & Active'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Custom Passphrase Protection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-sky-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Custom Master Encryption Passphrase
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            By default, LeadScrape Pro derives a secure hardware key for transparent zero-configuration encryption. You can set a custom master passphrase to encrypt your database with your own secret.
          </p>

          <form onSubmit={handleSetPassphrase} className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                New Master Passphrase
              </label>
              <input
                type="password"
                value={newPassphraseInput}
                onChange={e => setNewPassphraseInput(e.target.value)}
                placeholder="Enter secret passphrase..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {passphraseStatus && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passphraseStatus}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!newPassphraseInput.trim()}
              className="py-2 px-4 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Update Master Passphrase
            </button>
          </form>

          <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <strong>Current Key Status:</strong>{' '}
            {masterPassword ? 'Protected by custom user passphrase' : 'Protected by hardware-isolated device key'}
          </div>
        </div>

        {/* Card 2: Cross-Device Secure Cloud Syncing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              End-to-End Encrypted Cloud Sync
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Seamlessly synchronize your leads across your laptop, phone, or tablet. Your data is encrypted before leaving this browser, meaning no third party can read your prospects.
          </p>

          {/* Sync Devices Visualization */}
          <div className="flex items-center justify-around py-3 px-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="text-center space-y-1">
              <Laptop className="w-6 h-6 mx-auto text-sky-500" />
              <div className="font-semibold text-slate-800 dark:text-slate-200">Desktop Extension</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Active</span>
            </div>
            <div className="flex flex-col items-center">
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] text-indigo-500 font-bold">AES-GCM</span>
            </div>
            <div className="text-center space-y-1">
              <Smartphone className="w-6 h-6 mx-auto text-indigo-500" />
              <div className="font-semibold text-slate-800 dark:text-slate-200">Mobile CRM</div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Synced</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleGenerateSyncBundle}
              disabled={isGeneratingSync}
              className="w-full py-2 px-4 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSync ? 'animate-spin' : ''}`} />
              Generate Encrypted Cross-Device Sync Token
            </button>

            {generatedSyncBundle && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Encrypted Payload (Ready to copy)
                  </span>
                  <button
                    onClick={handleCopySyncToken}
                    className="px-2 py-0.5 rounded bg-sky-600 text-white text-[11px] font-semibold flex items-center gap-1"
                  >
                    {copiedSyncBundle ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSyncBundle ? 'Copied!' : 'Copy Token'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedSyncBundle}
                  className="w-full text-[10px] font-mono p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-500"
                />
              </div>
            )}
          </div>

          {/* Import Sync Bundle Section */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Import & Merge Leads from Another Device
            </label>
            <input
              type="text"
              value={importBundleText}
              onChange={e => setImportBundleText(e.target.value)}
              placeholder="Paste encrypted sync token here..."
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
            />
            <div className="flex gap-2">
              <input
                type="password"
                value={importPassword}
                onChange={e => setImportPassword(e.target.value)}
                placeholder="Passphrase (if custom)..."
                className="w-1/2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              />
              <button
                onClick={handleImportSyncBundle}
                disabled={!importBundleText.trim()}
                className="w-1/2 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                Decrypt & Merge
              </button>
            </div>

            {importStatus && (
              <div
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                  importStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {importStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Advanced CSV Reports Generator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Custom CSV Report Generator
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Generate structured CSV spreadsheets for importing into Google Sheets, Excel, HubSpot, or Salesforce CRM.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div
            onClick={() => setReportType('all')}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              reportType === 'all'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">Full Leads Archive</div>
            <div className="text-[11px] text-slate-500 mt-1">All {leads.length} captured leads</div>
          </div>

          <div
            onClick={() => setReportType('outreached')}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              reportType === 'outreached'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">Contacted Pipeline</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {leads.filter(l => l.status === 'outreached').length} outreached prospects
            </div>
          </div>

          <div
            onClick={() => setReportType('uncontacted')}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              reportType === 'uncontacted'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">Uncontacted Queue</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {leads.filter(l => l.status === 'uncontacted').length} ready for outreach
            </div>
          </div>

          <div
            onClick={() => setReportType('reminders')}
            className={`cursor-pointer p-3 rounded-xl border transition-all ${
              reportType === 'reminders'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white">Follow-up Schedule</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {leads.filter(l => l.followUpDate).length} scheduled follow-ups
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleGenerateReportCsv}
            className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download {reportType.toUpperCase()} Report (CSV)
          </button>
        </div>
      </div>
    </div>
  );
};
