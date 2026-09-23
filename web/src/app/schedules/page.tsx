"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/Badge";
import { Select } from "@/components/Select";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import type { Schedule } from "@/lib/types";

const emptyForm = {
  ScheduleID: "",
  ScheduleName: "Regular (8AM-5PM)",
  StartTime: "08:00",
  EndTime: "17:00",
  LunchStart: "12:00",
  LunchEnd: "13:00",
  GraceMinutes: 15,
  Status: "Active" as "Active" | "Inactive",
};

export default function SchedulesPage() {
  const session = useRequireAuth(["Admin"]);
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      await cachedCall<{ schedules: Schedule[] }>("getSchedules", {}, (res) => setSchedules(res.schedules));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load schedules.", true);
    }
  }, [toast]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  function edit(s: Schedule) {
    setForm({
      ScheduleID: s.ScheduleID,
      ScheduleName: s.ScheduleName,
      StartTime: s.StartTime,
      EndTime: s.EndTime,
      LunchStart: s.LunchStart,
      LunchEnd: s.LunchEnd,
      GraceMinutes: s.GraceMinutes,
      Status: s.Status,
    });
    window.scrollTo(0, 0);
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      await call("saveSchedule", {
        data: {
          ...form,
          ScheduleID: form.ScheduleID || undefined,
          GraceMinutes: Number(form.GraceMinutes),
        },
      });
      toast("Schedule saved.");
      setForm(emptyForm);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  return (
    <AppShell title="Work Schedules">
      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Add / Update Schedule</div>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={cls.label}>Schedule Name</label>
              <input required value={form.ScheduleName} onChange={(e) => setForm({ ...form, ScheduleName: e.target.value })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Start Time</label>
              <input required type="time" value={form.StartTime} onChange={(e) => setForm({ ...form, StartTime: e.target.value })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>End Time</label>
              <input required type="time" value={form.EndTime} onChange={(e) => setForm({ ...form, EndTime: e.target.value })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Lunch Start</label>
              <input type="time" value={form.LunchStart} onChange={(e) => setForm({ ...form, LunchStart: e.target.value })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Lunch End</label>
              <input type="time" value={form.LunchEnd} onChange={(e) => setForm({ ...form, LunchEnd: e.target.value })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Grace Period (minutes)</label>
              <input type="number" min={0} value={form.GraceMinutes} onChange={(e) => setForm({ ...form, GraceMinutes: Number(e.target.value) })} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Status</label>
              <Select
                value={form.Status}
                onChange={(v) => setForm({ ...form, Status: v as "Active" | "Inactive" })}
                className="w-full"
                aria-label="Schedule status"
                options={[
                  { value: "Active", label: "Active" },
                  { value: "Inactive", label: "Inactive" },
                ]}
              />
            </div>
          </div>
          <div className="flex gap-2.5">
            <button type="submit" disabled={saving} className={cls.btn}>
              {saving ? "Saving…" : "Save Schedule"}
            </button>
            <button type="button" onClick={() => setForm(emptyForm)} className={cls.btnGhost}>
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className={cls.panel}>
        <div className={cls.panelTitle}>All Schedules</div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Start</th>
                <th className={cls.th}>End</th>
                <th className={cls.th}>Lunch</th>
                <th className={cls.th}>Grace (min)</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}></th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className={cls.emptyState}>
                    No schedules yet.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.ScheduleID}>
                    <td className={cls.td}>
                      <span className="font-semibold">{s.ScheduleName}</span>
                    </td>
                    <td className={cls.td}>{s.StartTime}</td>
                    <td className={cls.td}>{s.EndTime}</td>
                    <td className={cls.td}>
                      {s.LunchStart} - {s.LunchEnd}
                    </td>
                    <td className={cls.td}>{s.GraceMinutes}</td>
                    <td className={cls.td}>
                      <StatusPill status={s.Status} />
                    </td>
                    <td className={cls.td}>
                      <button onClick={() => edit(s)} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
