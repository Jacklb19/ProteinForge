import { useContext, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { languageTags } from '../../i18n/locale';
import { useAuth } from '../auth/authContext';
import { PROJECT_RELATIVE_INTERVALS, PROJECT_RELATIVE_NOW_SECONDS } from './config';
import { ProjectContext } from './projectContext';
import { isOpen, needsAttention } from './syncQueue';

/** «hace 14 minutos», with the thresholds of the project rows; it moves on once per threshold while on screen. */
export function useRelativeTime(): (moment: string | number) => string {
  const { t, locale } = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()); }, PROJECT_RELATIVE_NOW_SECONDS * 1_000);
    return () => { window.clearInterval(timer); };
  }, []);
  return (moment) => {
    const seconds = (new Date(moment).getTime() - now) / 1_000;
    const interval = PROJECT_RELATIVE_INTERVALS.find(item => Math.abs(seconds) >= item.seconds);
    return Math.abs(seconds) < PROJECT_RELATIVE_NOW_SECONDS || !interval ? t('projects.justNow')
      : new Intl.RelativeTimeFormat(languageTags[locale], { numeric: 'auto' }).format(Math.round(seconds / interval.seconds), interval.unit);
  };
}

export type SyncSummary =
  | { kind: 'session-ended'; email: string; count: number }
  | { kind: 'saving'; current: number; total: number } | { kind: 'attention'; count: number; saved: number }
  | { kind: 'waiting'; offline: boolean; count: number } | { kind: 'offline'; guest: boolean } | null;

/** Whether saves of another account wait in this tab while someone else is signed in. */
export function useOtherAccountWaiting(): boolean {
  const projects = useContext(ProjectContext);
  const auth = useAuth();
  const owner = auth.session?.user.id;
  return auth.status === 'signed-in' && Boolean(projects?.pending.some(entry => isOpen(entry) && entry.owner !== owner));
}

/** One reading of this account's queue and the connection for the sidebar foot and the phone bar. */
export function useSyncSummary(): SyncSummary {
  const projects = useContext(ProjectContext);
  const auth = useAuth();
  if (!projects || auth.status === 'loading') return null;
  const signedIn = auth.status === 'signed-in';
  const owner = auth.session?.user.id;
  const waiting = projects.pending.filter(isOpen);
  if (!signedIn) {
    const first = waiting[0];
    if (first) return { kind: 'session-ended', email: first.email, count: waiting.length };
    return projects.connection === 'offline' ? { kind: 'offline', guest: true } : null;
  }
  const mine = projects.pending.filter(entry => entry.owner === owner);
  const saved = mine.filter(entry => entry.state === 'saved').length;
  if (projects.syncing) {
    const total = mine.filter(entry => !needsAttention(entry)).length;
    return { kind: 'saving', current: Math.min(saved + 1, total), total };
  }
  const attention = mine.filter(needsAttention).length;
  if (attention) return { kind: 'attention', count: attention, saved };
  const open = mine.filter(isOpen).length;
  if (open) return { kind: 'waiting', offline: projects.connection === 'offline', count: open };
  return projects.connection === 'offline' ? { kind: 'offline', guest: false } : null;
}

/** The phone bar's short form; the detail is in the menu. */
export function useSyncShortLabel(): string | null {
  const { t, formatNumber } = useTranslation();
  const summary = useSyncSummary();
  if (!summary) return null;
  switch (summary.kind) {
    case 'session-ended': return t('sync.sessionEndedShort');
    case 'saving': return t('sync.savingShort');
    case 'attention': return t('sync.reviewShort', { count: formatNumber(summary.count) });
    case 'waiting': return summary.offline ? t('sync.offline') : t(summary.count === 1 ? 'sync.pendingOne' : 'sync.pendingMany', { count: formatNumber(summary.count) });
    case 'offline': return t('sync.offline');
  }
}
