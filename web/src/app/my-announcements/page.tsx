"use client";

import { useState } from "react";
import { CheckCheck, Megaphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { AnnouncementDialog, PriorityBadge, postedAt } from "@/components/AnnouncementDialog";
import { useRequireAuth } from "@/lib/session";
import { useAnnouncements, type Announcement } from "@/lib/announcements";
import { cls } from "@/lib/ui";

const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";

export default function MyAnnouncementsPage() {
  const session = useRequireAuth(["Employee"]);
  const ann = useAnnouncements(session?.user.employeeId);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState<Announcement | null>(null);

  if (!session) return null;

  const list = filter === "unread" ? ann.announcements.filter((a) => ann.isUnread(a.AnnouncementID)) : ann.announcements;

  function view(a: Announcement) {
    ann.markRead(a.AnnouncementID);
    setOpen(a);
  }

  return (
    <AppShell title="Announcements">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Announcements</h2>
          <p className="mt-1 text-[14px] text-gray-500">Updates and reminders from your HR office.</p>
        </div>
        {ann.unreadCount > 0 && (
          <button onClick={ann.markAllRead} className={`${cls.btnSecondary} w-fit`}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      <section aria-label="Announcements" className={card}>
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 pt-3" role="tablist" aria-label="Filter announcements">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none ${
                filter === f ? "border-green-700 text-green-900" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {f === "all" ? "All" : "Unread"}
              {f === "unread" && ann.unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-px text-[10.5px] font-bold text-white tabular-nums">{ann.unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {!ann.loaded ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Megaphone size={22} />
            </div>
            <div className="font-semibold text-gray-900">{filter === "unread" ? "You're all caught up" : "No announcements yet"}</div>
            <p className="mt-1 text-[13.5px] text-gray-500">
              {filter === "unread" ? "You've read every announcement." : "Announcements from HR will appear here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((a) => {
              const unread = ann.isUnread(a.AnnouncementID);
              return (
                <li key={a.AnnouncementID}>
                  <button
                    onClick={() => view(a)}
                    className={`flex w-full gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-green-50/50 focus-visible:bg-green-50/70 focus-visible:outline-none ${
                      unread ? "bg-green-50/30" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        unread ? (a.Priority === "Important" ? "bg-amber-500" : "bg-green-600") : "bg-gray-200"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-[14.5px] break-words ${unread ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>{a.Title}</span>
                        <PriorityBadge priority={a.Priority} />
                        {unread && <span className="text-[11px] font-semibold text-green-700">New</span>}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13.5px] break-words text-gray-600">{a.Message}</span>
                      <span className="mt-1.5 block text-[12px] text-gray-400">
                        {[a.CreatedByName && `Posted by ${a.CreatedByName}`, postedAt(a.CreatedAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnnouncementDialog announcement={open} onClose={() => setOpen(null)} />
    </AppShell>
  );
}
