import React, { useState, useMemo } from 'react';
import { Mail, ExternalLink, Check, Copy, X, Send, Settings, BookmarkCheck, AlertCircle } from 'lucide-react';
import { JERRY_GUEST_POST_TEMPLATE } from '../types/index.ts';
import { formatJerryCollaborationEmail, formatEmailSubject, buildGmailComposeUrl } from '../utils/scraper.ts';
import type { Lead, EmailTemplate } from '../types/index.ts';

interface GmailComposeModalProps {
  lead: Lead;
  emailTemplate?: EmailTemplate;
  isFollowUp?: boolean;
  customSubject?: string;
  customBody?: string;
  onSendSuccess: (leadId: string) => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onSaveAsDefaultTemplate?: (template: EmailTemplate) => void;
}

export const GmailComposeModal: React.FC<GmailComposeModalProps> = ({
  lead,
  emailTemplate = JERRY_GUEST_POST_TEMPLATE,
  isFollowUp = false,
  customSubject,
  customBody,
  onSendSuccess,
  onClose,
  onOpenSettings,
  onSaveAsDefaultTemplate
}) => {
  const [subject, setSubject] = useState(() =>
    customSubject
      ? formatEmailSubject(customSubject, lead.websiteName, lead.url, lead.email)
      : formatEmailSubject(emailTemplate.subject, lead.websiteName, lead.url, lead.email)
  );
  const [body, setBody] = useState(() =>
    customBody
      ? formatJerryCollaborationEmail(lead.websiteName, lead.url, customBody, lead.email)
      : formatJerryCollaborationEmail(lead.websiteName, lead.url, emailTemplate.body, lead.email)
  );
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedDefaultFeedback, setSavedDefaultFeedback] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);

  // Compute live Gmail compose URL reactively
  const gmailUrl = useMemo(() => {
    return buildGmailComposeUrl(
      lead.email,
      lead.websiteName,
      lead.url,
      subject,
      body
    );
  }, [lead.email, lead.websiteName, lead.url, subject, body]);

  const handleCopyBody = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyGmailLink = () => {
    navigator.clipboard.writeText(gmailUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveAsDefault = () => {
    if (onSaveAsDefaultTemplate) {
      onSaveAsDefaultTemplate({
        id: 'custom_saved_default',
        name: 'Custom Default Template',
        subject: subject,
        body: body
      });
      setSavedDefaultFeedback(true);
      setTimeout(() => setSavedDefaultFeedback(false), 2500);
    }
  };

  const handleLaunchClick = () => {
    // Mark as outreached immediately
    onSendSuccess(lead.id);
    setHasLaunched(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              isFollowUp
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
                : 'bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400'
            }`}>
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isFollowUp ? 'Send Quick Follow-up' : 'Send with Gmail'}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  isFollowUp
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800'
                }`}>
                  {isFollowUp ? 'Follow-up Bump' : 'Gmail Web Compose'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Template: <span className="text-slate-700 dark:text-slate-200 font-medium">{isFollowUp ? 'Quick Follow-up' : emailTemplate.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                title="Edit default email template in Settings"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
              >
                <Settings className="w-4 h-4 text-sky-500" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lead recipient summary */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            <span className="text-slate-500 dark:text-slate-400">To: </span>
            <span className="font-bold text-slate-900 dark:text-white">{lead.email.replace(/^mailto:/i, '')}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-2">({lead.websiteName || lead.domain})</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 font-semibold">
            Auto-marks lead as Outreached
          </span>
        </div>

        {/* Success Banner if launched */}
        {hasLaunched && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Draft launched! Lead status updated to <strong>Outreached</strong>.</span>
            </div>
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold underline hover:text-emerald-700 dark:hover:text-emerald-300"
            >
              Click here if blocked
            </a>
          </div>
        )}

        {/* Subject input */}
        <div className="space-y-1 shrink-0">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Subject:
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Body textarea */}
        <div className="space-y-1 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Personalized Email Body:
            </label>
            <div className="flex items-center gap-3">
              {onSaveAsDefaultTemplate && (
                <button
                  type="button"
                  onClick={handleSaveAsDefault}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  title="Save current subject & body as default template for all future emails"
                >
                  <BookmarkCheck className={`w-3.5 h-3.5 ${savedDefaultFeedback ? 'text-emerald-500' : ''}`} />
                  {savedDefaultFeedback ? 'Saved as Default!' : 'Save as Default'}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyBody}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            </div>
          </div>
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-3 font-sans text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 leading-relaxed resize-none flex-1 min-h-[120px]"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyGmailLink}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
              title="Copy the direct Gmail Web Compose link"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedLink ? 'Link Copied!' : 'Copy Gmail URL'}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <a
              href={`mailto:${lead.email.replace(/^mailto:/i, '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              title="Open in Desktop Mail app (Apple Mail, Outlook, Thunderbird)"
            >
              Desktop Mail
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {hasLaunched ? 'Done' : 'Cancel'}
            </button>

            {/* Direct Native Link with target="_blank" that popup blockers will NEVER block */}
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLaunchClick}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer no-underline"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{hasLaunched ? 'Open Again in Gmail' : 'Open in Gmail Compose'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
