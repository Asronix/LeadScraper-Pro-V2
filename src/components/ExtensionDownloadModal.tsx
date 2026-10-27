import React, { useState } from 'react';
import {
  Download,
  X,
  Chrome,
  FolderArchive,
  FileCode,
  Check,
  Copy,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { getExtensionSourceFiles, downloadExtensionZip, ExtensionCodeFiles } from '../utils/extensionGenerator.ts';
import type { EmailTemplate, FollowUpTemplate, GoogleSheetSyncConfig } from '../types/index.ts';

import { EXTENSION_ICON_SVG } from '../utils/extensionIcons.ts';

interface ExtensionDownloadModalProps {
  onClose: () => void;
  emailTemplate?: EmailTemplate;
  followUpTemplate?: FollowUpTemplate;
  googleSheetConfig?: GoogleSheetSyncConfig;
}

export const ExtensionDownloadModal: React.FC<ExtensionDownloadModalProps> = ({
  onClose,
  emailTemplate,
  followUpTemplate,
  googleSheetConfig
}) => {
  const [activeFileTab, setActiveFileTab] = useState<keyof ExtensionCodeFiles>('manifest.json');
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const files = getExtensionSourceFiles(emailTemplate, followUpTemplate, googleSheetConfig);

  const handleDownloadZip = async () => {
    try {
      setIsDownloading(true);
      await downloadExtensionZip(emailTemplate, followUpTemplate, googleSheetConfig);
    } catch (err) {
      console.error('Failed to download zip', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCurrentCode = () => {
    navigator.clipboard.writeText(files[activeFileTab]);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex items-center justify-center shrink-0"
              dangerouslySetInnerHTML={{ __html: EXTENSION_ICON_SVG }}
            />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                LeadScrape Pro Chrome Extension
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800">
                  Manifest V3 + Logo Bundled
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ready to install in Google Chrome with background scraping, DOM highlighting, and honeypot bypass
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Download & Fast Setup Banner */}
        <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-sky-200 dark:border-sky-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 justify-center sm:justify-start">
              <FolderArchive className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Download Pre-packaged Extension ZIP (v1.4 Offline CRM)
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Includes <strong>100% Offline CRM Dashboard</strong> (<code className="text-sky-600 dark:text-sky-400">dashboard.html</code>), auto-scraper, DOM highlighter, and icons. <em>Never opens AI Studio &bull; Zero 403 errors!</em>
            </p>
          </div>
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Packaging ZIP...' : 'Download Extension (.ZIP)'}
          </button>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            How to Load into Chrome in 30 Seconds:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold">1</span>
                Extract the ZIP
              </div>
              <p className="text-slate-500 text-[11px]">
                Unzip the downloaded <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">leadscrape-pro-extension.zip</code> file onto your desktop or folder.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold">2</span>
                Open Chrome Extensions
              </div>
              <p className="text-slate-500 text-[11px]">
                In Chrome, go to <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">chrome://extensions</code> and toggle <strong>Developer mode</strong> in the top right.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold">3</span>
                Click Load Unpacked
              </div>
              <p className="text-slate-500 text-[11px]">
                Click <strong>Load unpacked</strong> and select the unzipped folder. Done! The scraper will run automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Source Code Viewer Tabs */}
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-[80%]">
              {(Object.keys(files) as Array<keyof ExtensionCodeFiles>).map(filename => (
                <button
                  key={filename}
                  onClick={() => setActiveFileTab(filename)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeFileTab === filename
                      ? 'bg-slate-800 text-sky-400 font-bold border border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {filename}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopyCurrentCode}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Body */}
          <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 leading-relaxed max-h-56">
            <pre className="whitespace-pre-wrap">{files[activeFileTab]}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Runs 100% locally with zero telemetry
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
