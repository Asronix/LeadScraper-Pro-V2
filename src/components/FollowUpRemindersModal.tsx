import React, { useMemo } from 'react';
import {
  Bell,
  X,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  Mail,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type { Lead } from '../types/index.ts';

interface FollowUpRemindersModalProps {
  leads: Lead[];
  onUpdateLead: (lead: Lead) => void;
  onClose: () => void;
  onNavigateToLead: (leadId: string) => void;
}

export const FollowUpRemindersModal: React.FC<FollowUpRemindersModalProps> = ({
  leads,
  onUpdateLead,
  onClose,
  onNavigateToLead
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Split into Overdue, Due Today, and Upcoming
  const { overdue, dueToday, upcoming } = useMemo(() => {
    const overdueList: Lead[] = [];
    const todayList: Lead[] = [];
    const upcomingList: Lead[] = [];

    leads.forEach(lead => {
      if (!lead.followUpDate || lead.status === 'converted') return;

      if (lead.followUpDate < todayStr) {
        overdueList.push(lead);
      } else if (lead.followUpDate === todayStr) {
        todayList.push(lead);
      } else {
        upcomingList.push(lead);
      }
    });

    return {
      overdue: overdueList.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || '')),
      dueToday: todayList,
      upcoming: upcomingList.sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))
    };
  }, [leads, todayStr]);

  const handleMarkOutreached = (lead: Lead) => {
    const nowIso = new Date().toISOString();
    onUpdateLead({
      ...lead,
      status: 'outreached',
      outreachedAt: nowIso,
      history: [
        ...(lead.history || []),
        { timestamp: nowIso, action: 'Outreached via Follow-up Reminder' }
      ]
    });
  };

  const handleSnooze = (lead: Lead, days: number = 3) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().split('T')[0];

    onUpdateLead({
      ...lead,
      followUpDate: dateStr
    });
  };

  const handleClearReminder = (lead: Lead) => {
    onUpdateLead({
      ...lead,
      followUpDate: undefined
    });
  };

  const totalActive = overdue.length + dueToday.length + upcoming.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Follow-up Notification Center
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Timely reminders for scheduled lead outreach and partner check-ins
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

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {totalActive === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                You're all caught up!
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                No pending follow-ups. You can schedule follow-up dates on any lead in the CRM table.
              </p>
            </div>
          ) : (
            <>
              {/* Overdue Section */}
              {overdue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Overdue Reminders ({overdue.length})
                    </span>
                    <span>Action Required</span>
                  </div>

                  <div className="space-y-2">
                    {overdue.map(lead => (
                      <div
                        key={lead.id}
                        className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-rose-950 dark:text-rose-200">
                              {lead.email}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-300 font-bold">
                              Due: {lead.followUpDate}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {lead.websiteName} • {lead.domain}
                          </div>
                          {lead.followUpNote && (
                            <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 italic">
                              "{lead.followUpNote}"
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleMarkOutreached(lead)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Outreach
                          </button>
                          <button
                            onClick={() => handleSnooze(lead, 3)}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            +3d
                          </button>
                          <button
                            onClick={() => handleClearReminder(lead)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Dismiss reminder"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Today Section */}
              {dueToday.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Due Today ({dueToday.length})
                    </span>
                    <span>Today</span>
                  </div>

                  <div className="space-y-2">
                    {dueToday.map(lead => (
                      <div
                        key={lead.id}
                        className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                              {lead.email}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 font-bold">
                              Today
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {lead.websiteName} • {lead.domain}
                          </div>
                          {lead.followUpNote && (
                            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 italic">
                              "{lead.followUpNote}"
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleMarkOutreached(lead)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Outreach
                          </button>
                          <button
                            onClick={() => handleSnooze(lead, 2)}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            +2d
                          </button>
                          <button
                            onClick={() => handleClearReminder(lead)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Dismiss reminder"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Section */}
              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Upcoming Follow-ups ({upcoming.length})
                  </div>

                  <div className="space-y-2">
                    {upcoming.map(lead => (
                      <div
                        key={lead.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {lead.email}
                          </span>
                          <span className="text-slate-400 ml-2">
                            ({lead.websiteName})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">
                            {lead.followUpDate}
                          </span>
                          <button
                            onClick={() => handleClearReminder(lead)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close Center
          </button>
        </div>
      </div>
    </div>
  );
};
