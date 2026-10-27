import React, { useState } from 'react';
import { ShieldAlert, Plus, Trash2, RotateCcw, X, Check, Globe } from 'lucide-react';
import { DEFAULT_EXCLUDED_DOMAINS } from '../types/index.ts';

interface ExcludedSitesModalProps {
  excludedDomains: string[];
  onUpdateExcludedDomains: (domains: string[]) => void;
  onClose: () => void;
}

export const ExcludedSitesModal: React.FC<ExcludedSitesModalProps> = ({
  excludedDomains,
  onUpdateExcludedDomains,
  onClose
}) => {
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = newDomain.trim().toLowerCase();
    cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0];

    if (!cleaned || !cleaned.includes('.')) {
      setError('Please enter a valid domain (e.g. newsportal.com)');
      return;
    }

    if (excludedDomains.map(d => d.toLowerCase()).includes(cleaned)) {
      setError('This domain is already on the exclusion list');
      return;
    }

    onUpdateExcludedDomains([cleaned, ...excludedDomains]);
    setNewDomain('');
    setError(null);
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    onUpdateExcludedDomains(excludedDomains.filter(d => d.toLowerCase() !== domainToRemove.toLowerCase()));
  };

  const handleResetDefaults = () => {
    onUpdateExcludedDomains(DEFAULT_EXCLUDED_DOMAINS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Excluded Sites & Domain Blacklist
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bypasses scraping and filters out unwanted links on these domains.
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

        {/* Add custom domain form */}
        <form onSubmit={handleAddDomain} className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Add Domain to Exclude:
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. competitor.com or junkspam.org"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Exclude Site
            </button>
          </div>
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        </form>

        {/* Domain List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 py-1">
            <span>ACTIVE EXCLUDED SITES ({excludedDomains.length})</span>
            <button
              onClick={handleResetDefaults}
              className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {excludedDomains.map((domain) => {
              const isDefault = DEFAULT_EXCLUDED_DOMAINS.includes(domain);
              return (
                <div
                  key={domain}
                  className="px-3 py-2 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {domain}
                    </span>
                    {isDefault ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Default
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                        Custom
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    title="Remove exclusion"
                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
