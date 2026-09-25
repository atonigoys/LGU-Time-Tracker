"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, Megaphone, Pencil, RefreshCw, Send, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { PriorityBadge, postedAt } from "@/components/AnnouncementDialog";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import type { Announcement } from "@/lib/announcements";

const TITLE_MAX = 120;
const MESSAGE_MAX = 2000;
const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";
const emptyForm = { AnnouncementID: "", Title: "", Message: "", Priority: "Normal" as Announcement["Priority"] };

export default function AnnouncementsPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = useState<Announcement[] | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      await cachedCall<{ announcements: Announcement[] }>("getAnnouncements", { includeArchived: true }, (res) => setList(res.announcements));
    } catch (err) {
      console.error("getAnnouncements failed", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
  }, [session, load]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError("");
    if (!form.Title.trim()) return setFormError("Please enter a title.");
    if (!form.Message.trim()) return setFormError("Please enter a message.");
    setSaving(true);
    try {
      await call("saveAnnouncement", { data: form });
      toast(form.AnnouncementID ? "Announcement updated." : "Announcement posted. Users will be notified.");
      setForm(emptyForm);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save the announcement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(a: Announcement, status: Announcement["Status"]) {
    try {
      await call("saveAnnouncement", { data: { ...a, Status: status } });
      toast(status === "Archived" ? "Announcement archived. Users no longer see it." : "Announcement restored.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to update the announcement.", true);
    }
  }

  async function remove(a: Announcement) {
    const ok = await confirm({
      title: "Delete announcement?",
      message: `“${a.Title}” will be removed for everyone. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await call("deleteAnnouncement", { announcementId: a.AnnouncementID });
      toast("Announcement deleted.");
      if (form.AnnouncementID === a.AnnouncementID) setForm(emptyForm);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to delete the announcement.", true);
    }
  }

  function edit(a: Announcement) {
    setForm({ AnnouncementID: a.AnnouncementID, Title: a.Title, Message: a.Message, Priority: a.Priority });
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!session) return null;
  const editing = !!form.AnnouncementID;

  return (
    <AppShell title="Announcements">
      <div className="mb-5">
        <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Announcements</h2>
        <p className="mt-1 text-[14px] text-gray-500">
          Post updates for all staff. They appear in everyone&apos;s notification bell, and users get a notice the next time they open the app.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section aria-labelledby="ann-form-title" className={`${card} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 id="ann-form-title" className="text-[15px] font-bold text-green-900">
              {editing ? "Edit Announcement" : "New Announcement"}
            </h3>
            {editing && (
              <button onClick={() => setForm(emptyForm)} className={`${cls.btnGhost} ${cls.btnSmall}`}>
                <X size={14} /> Cancel edit
              </button>
            )}
          </div>
          <form onSubmit={submit} noValidate className="space-y-3.5">
            {formError && (
              <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="ann-title" className={cls.label}>
                Title
              </label>
              <input
                id="ann-title"
                maxLength={TITLE_MAX}
                value={form.Title}
                onChange={(e) => setForm({ ...form, Title: e.target.value })}
                placeholder="e.g. Flag ceremony on Monday"
                className={cls.input}
              />
            </div>
            <div>
              <label htmlFor="ann-message" className={cls.label}>
                Message
              </label>
              <textarea
                id="ann-message"
                rows={6}
                maxLength={MESSAGE_MAX}
                value={form.Message}
                onChange={(e) => setForm({ ...form, Message: e.target.value })}
                placeholder="Write the details employees need to know."
                className={`${cls.input} resize-y`}
              />
              <div className="mt-1 text-right text-[11.5px] text-gray-400 tabular-nums">
                {form.Message.length}/{MESSAGE_MAX}
              </div>
            </div>
            <div>
              <label className={cls.label}>Priority</label>
              <Select
                value={form.Priority}
                onChange={(v) => setForm({ ...form, Priority: v as Announcement["Priority"] })}
                aria-label="Priority"
                className="w-full"
                options={[
                  { value: "Normal", label: "Normal" },
                  { value: "Important", label: "Important (highlighted)" },
                ]}
              />
            </div>
            <button type="submit" disabled={saving} className={`${cls.btn} h-11 w-full`}>
              <Send size={15} /> {saving ? "Saving…" : editing ? "Save Changes" : "Post Announcement"}
            </button>
          </form>
        </section>

        <section aria-labelledby="ann-list-title" className={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 id="ann-list-title" className="text-[15px] font-bold text-green-900">
              Posted Announcements
            </h3>
            <button onClick={() => load()} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label="Refresh announcements">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {error && !list ? (
            <div className="px-5 pb-8 text-center text-[13.5px] text-gray-600">
              Unable to load announcements.{" "}
              <button onClick={() => load()} className="font-semibold text-green-700 hover:underline">
                Retry
              </button>
            </div>
          ) : !list ? (
            <div className="space-y-3 px-5 pb-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="px-5 pt-4 pb-10 text-center">
              <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Megaphone size={20} />
              </div>
              <div className="text-[14px] font-semibold text-gray-900">No announcements yet</div>
              <p className="mt-0.5 text-[12.5px] text-gray-500">Your first announcement will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {list.map((a) => (
                <li key={a.AnnouncementID} className={`px-5 py-4 ${a.Status === "Archived" ? "bg-gray-50/60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[14.5px] font-semibold break-words ${a.Status === "Archived" ? "text-gray-500" : "text-gray-900"}`}>{a.Title}</span>
                        <PriorityBadge priority={a.Priority} />
                        {a.Status === "Archived" && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-gray-500 uppercase ring-1 ring-gray-400/30 ring-inset">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-[13px] break-words whitespace-pre-wrap text-gray-600">{a.Message}</p>
                      <div className="mt-1.5 text-[11.5px] text-gray-400">
                        {[a.CreatedByName && `Posted by ${a.CreatedByName}`, postedAt(a.CreatedAt), a.UpdatedAt && a.UpdatedAt !== a.CreatedAt ? `edited ${postedAt(a.UpdatedAt)}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => edit(a)} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label={`Edit ${a.Title}`}>
                        <Pencil size={13} /> Edit
                      </button>
                      {a.Status === "Archived" ? (
                        <button onClick={() => setStatus(a, "Active")} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label={`Restore ${a.Title}`}>
                          <ArchiveRestore size={13} /> Restore
                        </button>
                      ) : (
                        <button onClick={() => setStatus(a, "Archived")} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label={`Archive ${a.Title}`}>
                          <Archive size={13} /> Archive
                        </button>
                      )}
                      <button
                        onClick={() => remove(a)}
                        className={`${cls.btnSecondary} ${cls.btnSmall} text-red-600 hover:bg-red-50`}
                        aria-label={`Delete ${a.Title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
