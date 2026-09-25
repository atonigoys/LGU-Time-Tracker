"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Loader2, Megaphone, Pencil, RefreshCw, Send, Trash2, X } from "lucide-react";
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
type Busy = { id: string; action: "archive" | "restore" | "delete" } | null;

/** Preview shown inside the confirmation dialog. */
function Preview({ title, message, priority }: { title: string; message: string; priority: Announcement["Priority"] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-semibold break-words text-gray-900">{title}</span>
        <PriorityBadge priority={priority} />
      </div>
      <p className="mt-1 line-clamp-4 text-[13px] break-words whitespace-pre-wrap text-gray-600">{message}</p>
    </div>
  );
}

export default function AnnouncementsPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = useState<Announcement[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setError(false);
    setRefreshing(true);
    try {
      await cachedCall<{ announcements: Announcement[] }>("getAnnouncements", { includeArchived: true }, (res) => setList(res.announcements));
    } catch (err) {
      console.error("getAnnouncements failed", err);
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
  }, [session, load]);

  const editing = !!form.AnnouncementID;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    setFormError("");
    const title = form.Title.trim();
    const message = form.Message.trim();
    if (!title) {
      setFormError("Please enter a title.");
      titleRef.current?.focus();
      return;
    }
    if (!message) return setFormError("Please enter a message.");

    const ok = await confirm({
      title: editing ? "Save changes to this announcement?" : "Post this announcement?",
      message: editing
        ? "Everyone will see the updated announcement."
        : "It will be sent to all employees and appear in their notifications.",
      details: <Preview title={title} message={message} priority={form.Priority} />,
      confirmLabel: editing ? "Yes, save changes" : "Yes, post it",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await call("saveAnnouncement", { data: { ...form, Title: title, Message: message } });
      toast(editing ? "Announcement updated." : "Announcement posted. Employees will be notified.");
      setForm(emptyForm);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save the announcement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: Announcement, status: Announcement["Status"]) {
    const archiving = status === "Archived";
    const ok = await confirm({
      title: archiving ? "Archive this announcement?" : "Restore this announcement?",
      message: archiving
        ? "Employees will no longer see it. You can restore it later."
        : "It will be visible to all employees again.",
      details: <Preview title={a.Title} message={a.Message} priority={a.Priority} />,
      confirmLabel: archiving ? "Yes, archive" : "Yes, restore",
      tone: archiving ? "warning" : "default",
    });
    if (!ok) return;
    setBusy({ id: a.AnnouncementID, action: archiving ? "archive" : "restore" });
    const previous = list;
    // Update the list right away; roll back if the server refuses.
    setList((l) => l?.map((x) => (x.AnnouncementID === a.AnnouncementID ? { ...x, Status: status } : x)) ?? l);
    try {
      await call("saveAnnouncement", {
        data: { AnnouncementID: a.AnnouncementID, Title: a.Title, Message: a.Message, Priority: a.Priority, Status: status },
      });
      toast(archiving ? "Announcement archived." : "Announcement restored.");
      load();
    } catch (err) {
      setList(previous);
      toast(err instanceof Error ? err.message : "Unable to update the announcement.", true);
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Announcement) {
    const ok = await confirm({
      title: "Delete this announcement?",
      message: "It will be removed for everyone. This cannot be undone.",
      details: <Preview title={a.Title} message={a.Message} priority={a.Priority} />,
      confirmLabel: "Yes, delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy({ id: a.AnnouncementID, action: "delete" });
    const previous = list;
    setList((l) => l?.filter((x) => x.AnnouncementID !== a.AnnouncementID) ?? l);
    try {
      await call("deleteAnnouncement", { announcementId: a.AnnouncementID });
      toast("Announcement deleted.");
      if (form.AnnouncementID === a.AnnouncementID) setForm(emptyForm);
      load();
    } catch (err) {
      setList(previous);
      toast(err instanceof Error ? err.message : "Unable to delete the announcement.", true);
    } finally {
      setBusy(null);
    }
  }

  function startEdit(a: Announcement) {
    setForm({ AnnouncementID: a.AnnouncementID, Title: a.Title, Message: a.Message, Priority: a.Priority });
    setFormError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => titleRef.current?.focus(), 250);
  }

  async function cancelEdit() {
    const original = list?.find((x) => x.AnnouncementID === form.AnnouncementID);
    const changed = original && (original.Title !== form.Title || original.Message !== form.Message || original.Priority !== form.Priority);
    if (changed) {
      const ok = await confirm({
        title: "Discard your changes?",
        message: "Your edits to this announcement will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "warning",
      });
      if (!ok) return;
    }
    setForm(emptyForm);
    setFormError("");
  }

  if (!session) return null;

  return (
    <AppShell title="Announcements">
      <div className="mb-5">
        <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Announcements</h2>
        <p className="mt-1 text-[14px] text-gray-500">
          Post updates for all staff. They appear in everyone&apos;s notification bell, and users get a notice the next time they open the app.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section
          ref={formRef}
          aria-labelledby="ann-form-title"
          className={`${card} scroll-mt-20 p-5 transition-shadow duration-200 ${editing ? "ring-2 ring-amber-400/70" : ""}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id="ann-form-title" className="text-[15px] font-bold text-green-900">
              {editing ? "Edit Announcement" : "New Announcement"}
            </h3>
            {editing && (
              <button type="button" onClick={cancelEdit} className={`${cls.btnGhost} ${cls.btnSmall}`}>
                <X size={14} /> Cancel edit
              </button>
            )}
          </div>
          {editing && (
            <div className="mb-3.5 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
              You&apos;re editing a posted announcement. Changes are visible to everyone once saved.
            </div>
          )}
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
                ref={titleRef}
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
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              {saving ? (editing ? "Saving…" : "Posting…") : editing ? "Save Changes" : "Post Announcement"}
            </button>
          </form>
        </section>

        <section aria-labelledby="ann-list-title" className={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 id="ann-list-title" className="text-[15px] font-bold text-green-900">
              Posted Announcements
            </h3>
            <button onClick={() => load()} disabled={refreshing} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label="Refresh announcements">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
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
                <Skeleton key={i} className="h-24 w-full" />
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
              {list.map((a) => {
                const isBusy = busy?.id === a.AnnouncementID;
                const isEditing = form.AnnouncementID === a.AnnouncementID;
                const archived = a.Status === "Archived";
                return (
                  <li key={a.AnnouncementID} className={`px-5 py-4 ${archived ? "bg-gray-50/60" : ""} ${isEditing ? "bg-amber-50/40" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[14.5px] font-semibold break-words ${archived ? "text-gray-500" : "text-gray-900"}`}>{a.Title}</span>
                      <PriorityBadge priority={a.Priority} />
                      {archived && (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-gray-500 uppercase ring-1 ring-gray-400/30 ring-inset">
                          Archived
                        </span>
                      )}
                      {isEditing && <span className="text-[11.5px] font-semibold text-amber-700">Editing…</span>}
                    </div>
                    <p className="mt-1 line-clamp-3 text-[13px] break-words whitespace-pre-wrap text-gray-600">{a.Message}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11.5px] text-gray-400">
                        {[a.CreatedByName && `Posted by ${a.CreatedByName}`, postedAt(a.CreatedAt), a.UpdatedAt && a.UpdatedAt !== a.CreatedAt ? `edited ${postedAt(a.UpdatedAt)}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => startEdit(a)}
                          disabled={isBusy || isEditing}
                          className={`${cls.btnSecondary} ${cls.btnSmall}`}
                          aria-label={`Edit ${a.Title}`}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        {(() => {
                          // The list flips Archived/Active immediately, so key the spinner to the
                          // action in progress rather than to which button is showing.
                          const working = isBusy && busy?.action !== "delete";
                          const label = working ? (busy?.action === "archive" ? "Archiving…" : "Restoring…") : archived ? "Restore" : "Archive";
                          const Icon = working ? Loader2 : archived ? ArchiveRestore : Archive;
                          return (
                            <button
                              onClick={() => changeStatus(a, archived ? "Active" : "Archived")}
                              disabled={isBusy}
                              className={`${cls.btnSecondary} ${cls.btnSmall}`}
                              aria-label={`${archived ? "Restore" : "Archive"} ${a.Title}`}
                            >
                              <Icon size={13} className={working ? "animate-spin" : ""} /> {label}
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => remove(a)}
                          disabled={isBusy}
                          className={`${cls.btnSecondary} ${cls.btnSmall} text-red-600 hover:bg-red-50`}
                          aria-label={`Delete ${a.Title}`}
                        >
                          {isBusy && busy?.action === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
