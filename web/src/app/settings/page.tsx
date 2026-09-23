"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";

export default function SettingsPage() {
  const session = useRequireAuth(["Admin"]);
  const toast = useToast();
  const [orgName, setOrgName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  useEffect(() => {
    if (!session) return;
    cachedCall<{ settings: Record<string, string> }>("getSettings", {}, (res) => {
      setOrgName(res.settings.ORG_NAME ?? "");
      setAnnouncement(res.settings.ANNOUNCEMENT ?? "");
    }).catch(() => {});
  }, [session]);

  async function saveAnnouncement(ev: FormEvent) {
    ev.preventDefault();
    setSavingAnnouncement(true);
    try {
      await call("saveSetting", { key: "ANNOUNCEMENT", value: announcement.trim() });
      toast(announcement.trim() ? "Announcement posted." : "Announcement cleared.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function saveOrg(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("saveSetting", { key: "ORG_NAME", value: orgName.trim() });
      toast("Saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    }
  }

  if (!session) return null;

  return (
    <AppShell title="Settings">
      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Organization</div>
        <form onSubmit={saveOrg} className="space-y-3.5">
          <div>
            <label className={cls.label}>Organization Name</label>
            <input
              placeholder="Local Government Unit of ..."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={cls.input}
            />
          </div>
          <button type="submit" className={cls.btn}>
            Save
          </button>
        </form>
      </div>

      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Employee Announcement</div>
        <form onSubmit={saveAnnouncement} className="space-y-3.5">
          <div>
            <label htmlFor="announcement" className={cls.label}>
              Shown on every employee&apos;s dashboard
            </label>
            <textarea
              id="announcement"
              rows={3}
              maxLength={600}
              placeholder="e.g. Flag ceremony on Monday at 7:30 AM. Please be on time."
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className={`${cls.input} resize-y`}
            />
            <p className="mt-1 text-[11.5px] text-gray-500">Leave empty and save to remove the announcement.</p>
          </div>
          <button type="submit" disabled={savingAnnouncement} className={cls.btn}>
            {savingAnnouncement ? "Saving…" : "Save Announcement"}
          </button>
        </form>
      </div>

      <div className={cls.panel}>
        <div className={cls.panelTitle}>Change My Password</div>
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
