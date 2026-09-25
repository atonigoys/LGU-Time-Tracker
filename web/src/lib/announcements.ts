"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cachedCall, fetchAndCache } from "./cache";
import { DATA_CHANGED_EVENT } from "./events";

export interface Announcement {
  AnnouncementID: string;
  Title: string;
  Message: string;
  Priority: "Normal" | "Important";
  Status: "Active" | "Archived";
  CreatedBy: string;
  CreatedByName: string;
  /** "yyyy-MM-dd HH:mm:ss" Philippine time */
  CreatedAt: string;
  UpdatedAt: string;
}

// New announcements show up while the app is open without a manual refresh.
const POLL_MS = 5 * 60 * 1000;

const readKey = (userId: string) => `lgu_ann_read:${userId}`;
const toastedKey = (userId: string) => `lgu_ann_toasted:${userId}`;

function loadSet(storage: Storage | undefined, key: string): Set<string> {
  try {
    const raw = storage?.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSet(storage: Storage | undefined, key: string, set: Set<string>) {
  try {
    // Keep the list bounded; old IDs no longer matter once announcements are gone.
    storage?.setItem(key, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // non-essential
  }
}

// Keeps every mounted hook (header bell, announcements page) in sync when
// one of them marks something read.
const READ_EVENT = "lgu:announcements-read";

const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const tab = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

/**
 * Active announcements for the signed-in user, with read/unread state kept
 * in this browser. onNew fires once per announcement per tab session for
 * ones the user hasn't read, so they get a visible notice.
 */
export function useAnnouncements(userId: string | undefined, onNew?: (items: Announcement[]) => void) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  const apply = useCallback(
    (list: Announcement[]) => {
      if (!userId) return;
      setItems(list);
      const readSet = loadSet(local(), readKey(userId));
      // Your own announcements count as read - no notice for what you just posted.
      let added = false;
      list.forEach((a) => {
        if (a.CreatedBy === userId && !readSet.has(a.AnnouncementID)) {
          readSet.add(a.AnnouncementID);
          added = true;
        }
      });
      if (added) saveSet(local(), readKey(userId), readSet);
      setRead(readSet);
      // Only the hook that shows notices (the header) records what it announced.
      if (!onNewRef.current) return;
      const toasted = loadSet(tab(), toastedKey(userId));
      const fresh = list.filter((a) => !readSet.has(a.AnnouncementID) && !toasted.has(a.AnnouncementID));
      if (fresh.length) {
        fresh.forEach((a) => toasted.add(a.AnnouncementID));
        saveSet(tab(), toastedKey(userId), toasted);
        onNewRef.current?.(fresh);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const handle = (res: { announcements: Announcement[] }) => {
      if (cancelled) return;
      apply(res.announcements);
      setLoaded(true);
    };
    cachedCall<{ announcements: Announcement[] }>("getAnnouncements", {}, handle).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    const poll = () => fetchAndCache<{ announcements: Announcement[] }>("getAnnouncements", {}).then(handle).catch(() => {});
    const id = setInterval(poll, POLL_MS);
    // After a change in this tab (e.g. an admin just posted), refresh soon.
    const onChange = () => setTimeout(poll, 400);
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    const onRead = () => setRead(loadSet(local(), readKey(userId)));
    window.addEventListener(READ_EVENT, onRead);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener(DATA_CHANGED_EVENT, onChange);
      window.removeEventListener(READ_EVENT, onRead);
    };
  }, [userId, apply]);

  const markRead = useCallback(
    (id: string) => {
      if (!userId) return;
      setRead((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveSet(local(), readKey(userId), next);
        setTimeout(() => window.dispatchEvent(new Event(READ_EVENT)), 0);
        return next;
      });
    },
    [userId]
  );

  const markAllRead = useCallback(() => {
    if (!userId) return;
    setRead((prev) => {
      const next = new Set(prev);
      items.forEach((a) => next.add(a.AnnouncementID));
      saveSet(local(), readKey(userId), next);
      setTimeout(() => window.dispatchEvent(new Event(READ_EVENT)), 0);
      return next;
    });
  }, [userId, items]);

  const unreadCount = items.filter((a) => !read.has(a.AnnouncementID)).length;
  return { announcements: items, loaded, isUnread: (id: string) => !read.has(id), unreadCount, markRead, markAllRead };
}
