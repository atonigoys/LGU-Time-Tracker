"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";

export default function SettingsPage() {
  const session = useRequireAuth(["Admin"]);
  const toast = useToast();
  const [orgName, setOrgName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!session) return;
    call<{ settings: Record<string, string> }>("getSettings")
      .then((res) => setOrgName(res.settings.ORG_NAME ?? ""))
      .catch(() => {});
  }, [session]);

  async function saveOrg(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("saveSetting", { key: "ORG_NAME", value: orgName.trim() });
      toast("Saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    }
  }

  async function changePassword(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("changePassword", { oldPassword, newPassword });
      toast("Password updated.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed.", true);
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

      <div className={cls.panel}>
        <div className={cls.panelTitle}>Change My Password</div>
        <form onSubmit={changePassword} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={cls.label}>Current Password</label>
              <input required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>New Password</label>
              <input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={cls.input} />
            </div>
          </div>
          <button type="submit" className={cls.btn}>
            Update Password
          </button>
        </form>
      </div>
    </AppShell>
  );
}
