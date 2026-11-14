import { useEffect, useRef, useState } from 'react';
import { LIVE_HIDDEN_GRACE_MS, readLiveUrl } from '../live/config';
import { openLiveChannel } from '../live/liveChannel';
import type { LiveChange, LiveChannel, LiveConnector } from '../live/liveChannel';
import { isNews, sameInstant } from '../live/liveNews';
import type { ProjectCore, State } from './projectState';

/**
 * Live channel: the API says when this account's projects change in another tab or device. Returns what
 * it last said about the open project, derived so it clears itself once this tab holds that version.
 */
export function useLiveProjects(core: ProjectCore, live: LiveConnector | null | undefined, current: State, wake: number, poke: () => void): 'changed' | 'removed' | null {
  const { user, token, enabled, client, gate, setState } = core;
  const [liveUrl] = useState(readLiveUrl);
  const connectLive = live === undefined ? liveUrl : live;
  const channel = useRef<LiveChannel | null>(null);
  const liveChanges = useRef<LiveChange[]>([]);
  // What the channel last said about a project: its newer version elsewhere, or null once it was deleted.
  const [remoteStamp, setRemoteStamp] = useState<{ id: string; updatedAt: string | null; against: string } | null>(null);
  useEffect(() => {
    if (!connectLive || !user || !enabled) return;
    const onChange = (change: LiveChange): void => { liveChanges.current.push(change); poke(); };
    const opened = typeof connectLive === 'string' ? openLiveChannel({ url: connectLive, token: null, onChange }) : connectLive({ token: null, onChange });
    channel.current = opened;
    // A hidden tab keeps its connection for a while, then lets it go and catches up when it is shown again.
    let hiding: number | undefined;
    const look = (): void => {
      window.clearTimeout(hiding);
      if (!navigator.onLine) opened.setActive(false);
      else if (document.visibilityState === 'visible') opened.setActive(true);
      else hiding = window.setTimeout(() => { opened.setActive(false); }, LIVE_HIDDEN_GRACE_MS);
    };
    look();
    window.addEventListener('online', look);
    window.addEventListener('offline', look);
    document.addEventListener('visibilitychange', look);
    return () => {
      window.clearTimeout(hiding);
      window.removeEventListener('online', look); window.removeEventListener('offline', look); document.removeEventListener('visibilitychange', look);
      channel.current = null; liveChanges.current = [];
      opened.close();
    };
    // poke is stable; the channel opens again only for another address, account or service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectLive, user, enabled]);
  // The channel follows the session: a refreshed token replaces the one it reads with.
  useEffect(() => { channel.current?.setToken(user && token ? token : null); }, [connectLive, user, enabled, token]);
  // Notices wait for the action in progress: its own result often already holds what they announce.
  useEffect(() => {
    if (!liveChanges.current.length || !user || !token || !client || gate.locked) return;
    const changes = liveChanges.current;
    liveChanges.current = [];
    const known = [...current.items, ...(current.active ? [current.active] : [])];
    const open = current.active;
    for (const change of changes) {
      if (!open) break;
      // Kept with the version this tab held then: any later version of its own makes the notice void.
      const stamp = change.changed?.find(item => item.id === open.id);
      if (stamp) setRemoteStamp({ ...stamp, against: open.updatedAt });
      else if (change.removed.includes(open.id)) setRemoteStamp({ id: open.id, updatedAt: null, against: open.updatedAt });
    }
    if (!changes.some(change => isNews(change, known))) return;
    const epoch = gate.epoch, owner = user, listing = current.listing;
    // Read only, so it takes no lock; an action that starts meanwhile wins and lists again itself.
    void client.list(token, '', undefined, listing).then((result) => {
      if (gate.epoch !== epoch || gate.locked) return;
      setState(value => value.owner === owner && value.listing === listing ? { ...value, items: result.items, nextPageToken: result.nextPageToken } : value);
    }, () => undefined);
    // Reads the latest list through this render; wake is the moment to look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wake, user, token, client]);

  return !current.active || remoteStamp?.id !== current.active.id || remoteStamp.against !== current.active.updatedAt ? null
    : remoteStamp.updatedAt === null ? 'removed'
      : sameInstant(remoteStamp.updatedAt, current.active.updatedAt) ? null : 'changed';
}
