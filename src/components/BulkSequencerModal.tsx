import React, { useState, useMemo } from 'react';
import {
  X,
  Send,
  ExternalLink,
  Check,
  Copy,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  Play
} from 'lucide-react';
import type { Lead, EmailTemplate, SequenceStepTemplate, FollowUpTemplate } from '../types/index.ts';
import { DEFAULT_SEQUENCE_STEPS } from '../types/index.ts';
import { formatJerryCollaborationEmail, formatEmailSubject, buildGmailComposeUrl, sanitizeEmail } from '../utils/scraper.ts';

interface BulkSequencerModalProps {
  selectedLeads: Lead[];
  emailTemplate?: EmailTemplate;
  followUpTemplate?: FollowUpTemplate;
  initialStep?: number;
  onUpdateLead: (lead: Lead) => void;
  onBulkUpdateStatus: (leadIds: string[], status: any) => void;
  onClose: () => void;
}

export const BulkSequencerModal: React.FC<BulkSequencerModalProps> = ({
  selectedLeads,
  emailTemplate,
  followUpTemplate,
  initialStep = 1,
  onUpdateLead,
  onBulkUpdateStatus,
  onClose
}) => {
  // Active sequence step (1 = Initial Pitch, 2 = Follow-up #1, 3 = Follow-up #2, 4 = Breakup)
  const [activeStep, setActiveStep] = useState<number>(initialStep);
  const [steps, setSteps] = useState<SequenceStepTemplate[]>(() => {
    return DEFAULT_SEQUENCE_STEPS.map(s => {
      if (s.step === 1 && emailTemplate) {
        return { ...s, subject: emailTemplate.subject, body: emailTemplate.body };
      }
      if (s.step === 2 && followUpTemplate) {
        return {
          ...s,
          subject: followUpTemplate.subject,
          body: followUpTemplate.body,
          defaultDelayDays: followUpTemplate.defaultDelayDays || s.defaultDelayDays
        };
      }
      return s;
    });
  });

  // Current active step template
  const currentStep = useMemo(() => {
    return steps.find(s => s.step === activeStep) || steps[0];
  }, [steps, activeStep]);

  // Editable subject & body for current step
  const [stepSubject, setStepSubject] = useState(currentStep.subject);
  const [stepBody, setStepBody] = useState(currentStep.body);

  // Sync editor when active step changes
  const handleSelectStep = (stepNum: number) => {
    setActiveStep(stepNum);
    const target = steps.find(s => s.step === stepNum) || steps[0];
    setStepSubject(target.subject);
    setStepBody(target.body);
  };

  // Follow-up reminder interval selection (in days)
  const [followUpDays, setFollowUpDays] = useState<number>(currentStep.defaultDelayDays || 3);
  const [autoScheduleFollowUp, setAutoScheduleFollowUp] = useState<boolean>(true);

  // State to track which leads in the batch have been launched
  const [launchedLeadIds, setLaunchedLeadIds] = useState<Set<string>>(new Set());
  const [isAutoLaunching, setIsAutoLaunching] = useState<boolean>(false);
  const [copiedBcc, setCopiedBcc] = useState<boolean>(false);
  const [copiedLinks, setCopiedLinks] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Pre-generate personalized items for all selected leads
  const personalizedQueue = useMemo(() => {
    return selectedLeads.map(lead => {
      const cleanTo = sanitizeEmail(lead.email);
      const subj = formatEmailSubject(stepSubject, lead.websiteName, lead.url, cleanTo);
      const content = formatJerryCollaborationEmail(lead.websiteName, lead.url, stepBody, cleanTo);
      const gmailUrl = buildGmailComposeUrl(cleanTo, lead.websiteName, lead.url, subj, content);
      return {
        lead,
        cleanEmail: cleanTo,
        subject: subj,
        body: content,
        gmailUrl
      };
    });
  }, [selectedLeads, stepSubject, stepBody]);

  // Calculate target follow-up date string YYYY-MM-DD
  const targetFollowUpDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + followUpDays);
    return d.toISOString().split('T')[0];
  }, [followUpDays]);

  // Mark single lead as launched and update follow-up
  const handleMarkLeadLaunched = (lead: Lead) => {
    setLaunchedLeadIds(prev => new Set(prev).add(lead.id));

    const nowIso = new Date().toISOString();
    const updatedLead: Lead = {
      ...lead,
      status: 'outreached',
      outreachedAt: nowIso,
      sequenceStep: activeStep,
      followUpDate: autoScheduleFollowUp ? targetFollowUpDate : lead.followUpDate,
      history: [
        ...(lead.history || []),
        {
          timestamp: nowIso,
          action: `Sequence Step ${activeStep} draft launched in Gmail`
        }
      ]
    };
    onUpdateLead(updatedLead);
  };

  // Staggered auto-launcher for all selected leads
  const handleLaunchAllStaggered = async () => {
    setIsAutoLaunching(true);
    let count = 0;

    for (const item of personalizedQueue) {
      // Open in a new window/tab
      window.open(item.gmailUrl, '_blank', 'noopener,noreferrer');
      handleMarkLeadLaunched(item.lead);
      count++;

      // 800ms stagger between tab opens so browser does not choke
      if (count < personalizedQueue.length) {
        await new Promise(res => setTimeout(res, 800));
      }
    }

    setIsAutoLaunching(false);
    showToast(`Successfully launched all ${count} outreach drafts in Gmail!`);
  };

  // Copy all Gmail URLs to clipboard
  const handleCopyAllLinks = () => {
    const text = personalizedQueue.map(item => `${item.cleanEmail} (${item.lead.websiteName}): ${item.gmailUrl}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedLinks(true);
    setTimeout(() => setCopiedLinks(false), 2000);
    showToast('Copied all direct Gmail Compose links to clipboard');
  };

  // Copy BCC list
  const handleCopyBcc = () => {
    const emails = personalizedQueue.map(item => item.cleanEmail).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedBcc(true);
    setTimeout(() => setCopiedBcc(false), 2000);
    showToast('Copied recipient emails to clipboard');
  };

  // Export Cold Outreach Sequence CSV (compatible with Lemlist, Instantly, Apollo)
  const handleExportSequenceCsv = () => {
    const header = '"Email","Website Name","Domain","URL","Sequence Step","Subject","Body","Gmail Direct URL"\r\n';
    const rows = personalizedQueue.map(item => {
      const e = item.cleanEmail.replace(/"/g, '""');
      const site = (item.lead.websiteName || '').replace(/"/g, '""');
      const domain = (item.lead.domain || '').replace(/"/g, '""');
      const url = (item.lead.url || '').replace(/"/g, '""');
      const step = `Step ${activeStep}: ${currentStep.name}`.replace(/"/g, '""');
      const subj = item.subject.replace(/"/g, '""');
      const body = item.body.replace(/"/g, '""');
      const link = item.gmailUrl.replace(/"/g, '""');
      return `"${e}","${site}","${domain}","${url}","${step}","${subj}","${body}","${link}"`;
    }).join('\r\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `leadscrape-sequence-step-${activeStep}-${selectedLeads.length}-leads.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);
    showToast(`Exported sequence campaign for ${selectedLeads.length} leads!`);
  };

  // Mark all selected leads as outreached and apply sequence schedule
  const handleApplyBatchSchedule = () => {
    const leadIds = selectedLeads.map(l => l.id);
    onBulkUpdateStatus(leadIds, 'outreached');

    selectedLeads.forEach(lead => {
      onUpdateLead({
        ...lead,
        status: 'outreached',
        sequenceStep: activeStep,
        followUpDate: autoScheduleFollowUp ? targetFollowUpDate : lead.followUpDate
      });
    });

    setLaunchedLeadIds(new Set(leadIds));
    showToast(`Updated ${selectedLeads.length} leads with Step ${activeStep} & scheduled follow-up!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Bulk Email Sequencer
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-semibold border border-sky-300 dark:border-sky-800">
                  {selectedLeads.length} Leads Queued
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Execute automated step-by-step Gmail sequences and follow-up campaigns with personalization.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
          {steps.map(s => {
            const isActive = s.step === activeStep;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => handleSelectStep(s.step)}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 dark:border-sky-600 ring-2 ring-sky-500/20 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className={isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}>
                    Step {s.step}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    +{s.defaultDelayDays}d
                  </span>
                </div>
                <div className="font-semibold text-xs text-slate-900 dark:text-white truncate mt-0.5">
                  {s.step === 1 ? 'Initial Pitch' : s.step === 2 ? 'Follow-up #1' : s.step === 3 ? 'Topic Outlines' : 'Final Check-in'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Middle Area: Editor & Scheduling config */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Left Column: Template Editor for Current Step */}
          <div className="lg:col-span-7 space-y-3 flex flex-col">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Subject for Step {activeStep}:</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Variables: <code className="text-sky-500">[Site Name and hyperlink to website]</code>
                </span>
              </label>
              <input
                type="text"
                value={stepSubject}
                onChange={e => setStepSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1 flex-1 flex flex-col">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Body for Step {activeStep}:
              </label>
              <textarea
                rows={7}
                value={stepBody}
                onChange={e => setStepBody(e.target.value)}
                className="w-full p-3 font-sans text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed resize-none flex-1 min-h-[140px]"
              />
            </div>

            {/* Sequence Schedule Controls */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScheduleFollowUp}
                    onChange={e => setAutoScheduleFollowUp(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                  />
                  <span>Auto-schedule Next Follow-up in CRM</span>
                </label>
                {autoScheduleFollowUp && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span>Remind in:</span>
                    <select
                      value={followUpDays}
                      onChange={e => setFollowUpDays(Number(e.target.value))}
                      className="py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value={2}>2 Days</option>
                      <option value={3}>3 Days</option>
                      <option value={4}>4 Days</option>
                      <option value={5}>5 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={10}>10 Days</option>
                      <option value={14}>14 Days</option>
                    </select>
                    <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                      ({targetFollowUpDate})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Sequence Queue */}
          <div className="lg:col-span-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                Prospect Queue ({launchedLeadIds.size}/{personalizedQueue.length} Launched)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyBcc}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                  title="Copy all emails for BCC"
                >
                  {copiedBcc ? '✓ Copied' : 'BCC List'}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCopyAllLinks}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                  title="Copy all direct Gmail URLs"
                >
                  {copiedLinks ? '✓ Copied' : 'All Links'}
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/50">
              {personalizedQueue.map(({ lead, cleanEmail, gmailUrl }) => {
                const isLaunched = launchedLeadIds.has(lead.id);
                return (
                  <div
                    key={lead.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                      isLaunched
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {cleanEmail}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {lead.websiteName} • <span className="text-sky-600 dark:text-sky-400">{lead.domain}</span>
                      </div>
                    </div>

                    {/* Native Link with target="_blank" that popup blockers will NEVER block */}
                    <a
                      href={gmailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkLeadLaunched(lead)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs shrink-0 cursor-pointer no-underline ${
                        isLaunched
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/60 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800'
                      }`}
                      title="Open draft directly in Gmail Web Compose"
                    >
                      {isLaunched ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Sent</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <span>Open Gmail</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </>
                      )}
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Batch Helper Buttons */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleApplyBatchSchedule}
                className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors text-center"
              >
                Mark All Outreached
              </button>
              <button
                type="button"
                onClick={handleExportSequenceCsv}
                className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                title="Export cold email sequence CSV"
              >
                <Download className="w-3.5 h-3.5 text-sky-500" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toast feedback */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs px-3 py-2 rounded-xl flex items-center gap-2 shadow-md animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>Progress: <strong>{launchedLeadIds.size}</strong> of {personalizedQueue.length} launched</span>
            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(launchedLeadIds.size / Math.max(personalizedQueue.length, 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isAutoLaunching}
              onClick={handleLaunchAllStaggered}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isAutoLaunching ? 'Launching Tabs...' : `Launch All ${personalizedQueue.length} in Gmail`}
              </span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
