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

  useEffect(() => {
    if (!session) return;
    cachedCall<{ settings: Record<string, string> }>("getSettings", {}, (res) => setOrgName(res.settings.ORG_NAME ?? "")).catch(() => {});
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
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
