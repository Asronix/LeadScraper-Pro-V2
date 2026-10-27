import React, { useState } from 'react';
import { Tag as TagIcon, Plus, Trash2, X, Check } from 'lucide-react';
import type { Tag } from '../types/index.ts';

interface TagManagerModalProps {
  tags: Tag[];
  onAddTag: (tag: Tag) => void;
  onDeleteTag: (tagId: string) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  { name: 'Emerald', hex: '#059669', bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-800' },
  { name: 'Sky Blue', hex: '#0284c7', bg: 'bg-sky-100 dark:bg-sky-950/60', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-800' },
  { name: 'Purple', hex: '#7c3aed', bg: 'bg-purple-100 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800' },
  { name: 'Rose', hex: '#e11d48', bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-800' },
  { name: 'Amber', hex: '#d97706', bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800' },
  { name: 'Indigo', hex: '#4f46e5', bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-800' },
  { name: 'Teal', hex: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-950/60', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-300 dark:border-teal-800' }
];

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  tags,
  onAddTag,
  onDeleteTag,
  onClose
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    const colorConfig = PRESET_COLORS[selectedColorIndex];
    const newTag: Tag = {
      id: 'tag_' + Date.now(),
      name: newTagName.trim(),
      color: colorConfig.hex,
      bgColor: colorConfig.bg,
      textColor: colorConfig.text,
      borderColor: colorConfig.border
    };

    onAddTag(newTag);
    setNewTagName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
              <TagIcon className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Project Category Tags
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Tags List */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Tags ({tags.length})
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {tags.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${t.bgColor} ${t.textColor} ${t.borderColor}`}>
                    {t.name}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteTag(t.id)}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Delete Tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Create New Tag Form */}
        <form onSubmit={handleCreate} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Create Custom Tag
          </label>
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="e.g. Q4 Enterprise, Seed Investor, AI Startup..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {/* Color Palettes */}
          <div>
            <span className="text-[11px] text-slate-500 block mb-1.5">Choose Color:</span>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((col, idx) => (
                <button
                  type="button"
                  key={col.name}
                  onClick={() => setSelectedColorIndex(idx)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                    selectedColorIndex === idx ? 'scale-115 ring-2 ring-offset-2 ring-sky-500' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: col.hex }}
                  title={col.name}
                >
                  {selectedColorIndex === idx && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!newTagName.trim()}
            className="w-full py-2 px-4 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Tag Category
          </button>
        </form>
      </div>
    </div>
  );
};
