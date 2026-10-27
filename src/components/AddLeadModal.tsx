import React, { useState } from 'react';
import { Plus, X, Mail, Globe, Calendar, Tag as TagIcon } from 'lucide-react';
import type { Lead, Tag, LeadStatus } from '../types/index.ts';
import { extractDomain, extractWebsiteName, isValidEmail, sanitizeEmail } from '../utils/scraper.ts';

interface AddLeadModalProps {
  tags: Tag[];
  onAddLead: (lead: Lead) => void;
  onClose: () => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ tags, onAddLead, onClose }) => {
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteName, setWebsiteName] = useState('');
  const [status, setStatus] = useState<LeadStatus>('uncontacted');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = () => {
    if (websiteUrl && !websiteName) {
      setWebsiteName(extractWebsiteName(websiteUrl));
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = sanitizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    const domain = websiteUrl ? extractDomain(websiteUrl) : extractDomain(cleanEmail);
    const finalName = websiteName.trim() || extractWebsiteName(websiteUrl || domain);
    const finalUrl = websiteUrl.trim() || `https://${domain}`;
    const nowIso = new Date().toISOString();

    const newLead: Lead = {
      id: 'manual_' + Date.now(),
      email: cleanEmail,
      domain,
      websiteName: finalName,
      url: finalUrl,
      discoveredAt: nowIso,
      status,
      outreachedAt: status === 'outreached' ? nowIso : undefined,
      tags: selectedTags,
      notes: notes.trim() || undefined,
      followUpDate: followUpDate || undefined,
      history: [
        {
          timestamp: nowIso,
          action: 'Manually added to CRM'
        }
      ]
    };

    onAddLead(newLead);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
              <Plus className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Add New Prospect Lead
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Website URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder="https://company.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Website / Company Name
              </label>
              <input
                type="text"
                value={websiteName}
                onChange={e => setWebsiteName(e.target.value)}
                placeholder="Company Name"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Outreach Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="uncontacted">⚪ Uncontacted</option>
                <option value="outreached">🟢 Outreached</option>
                <option value="replied">🔵 Replied</option>
                <option value="converted">⭐ Converted</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Follow-up Date Reminder
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Assign Category Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => {
                const isSelected = selectedTags.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => handleToggleTag(t.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                      isSelected
                        ? `${t.bgColor} ${t.textColor} ${t.borderColor} ring-1 ring-offset-1`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Prospect Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add key talking points, mutual connections, or proposal details..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors"
            >
              Save Prospect Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
