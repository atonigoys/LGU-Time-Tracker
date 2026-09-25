"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Megaphone, X } from "lucide-react";
import { cls } from "@/lib/ui";
import { formatDate, formatTime } from "@/lib/format";
import type { Announcement } from "@/lib/announcements";

/** "2026-09-24 11:24:56" -> "Sep 24, 2026, 11:24 AM" */
export function postedAt(ts: string) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(ts);
  return m ? `${formatDate(m[1])}, ${formatTime(m[2])}` : "";
}

export function PriorityBadge({ priority }: { priority: Announcement["Priority"] }) {
  if (priority !== "Important") return null;
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-amber-800 uppercase ring-1 ring-amber-600/25 ring-inset">
      Important
    </span>
  );
}

export function AnnouncementDialog({ announcement, onClose }: { announcement: Announcement | null; onClose: () => void }) {
  const a = announcement;
  return (
    <Dialog.Root open={!!a} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[260] bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby="announcement-body"
          className="fixed top-1/2 left-1/2 z-[270] flex max-h-[85vh] w-[calc(100vw-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] focus:outline-none data-[state=open]:animate-[modal-in_180ms_ease-out]"
        >
          {a && (
            <>
              <div aria-hidden className="h-1 shrink-0 bg-gradient-to-r from-green-800 via-green-600 to-green-700" />
              <div className="flex items-start gap-3 px-6 pt-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-600/15">
                  <Megaphone size={18} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="mb-1">
                    <PriorityBadge priority={a.Priority} />
                  </div>
                  <Dialog.Title className="text-[18px] leading-snug font-bold break-words text-green-950">{a.Title}</Dialog.Title>
                  <div className="mt-0.5 text-[12.5px] text-gray-500">
                    {[a.CreatedByName && `Posted by ${a.CreatedByName}`, postedAt(a.CreatedAt)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="absolute top-4 right-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
                >
                  <X size={18} />
                </Dialog.Close>
              </div>
              <div id="announcement-body" className="overflow-y-auto px-6 pt-4 pb-5 text-[14px] leading-relaxed break-words whitespace-pre-wrap text-gray-800">
                {a.Message}
              </div>
              <div className="flex justify-end border-t border-gray-100 bg-gray-50/60 px-6 py-3.5">
                <Dialog.Close className={`${cls.btn} h-10`}>Got it</Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
