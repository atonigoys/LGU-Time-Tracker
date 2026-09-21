"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/Badge";
import { SkeletonTableRows } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import type { Holiday } from "@/lib/types";

export default function HolidaysPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"Regular" | "Special">("Regular");

  const load = useCallback(async () => {
    try {
      const res = await call<{ holidays: Holiday[] }>("getHolidays");
      setHolidays([...res.holidays].sort((a, b) => a.Date.localeCompare(b.Date)));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load holidays.", true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("saveHoliday", { data: { Date: date, HolidayName: name.trim(), Type: type } });
      toast("Holiday added.");
      setDate("");
      setName("");
      setType("Regular");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    }
  }

  async function remove(id: string, name: string) {
    const ok = await confirmDialog({
      title: "Delete holiday?",
      message: `"${name}" will be removed from the holiday calendar.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await call("deleteHoliday", { holidayId: id });
      toast("Holiday deleted.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed.", true);
    }
  }

  if (!session) return null;

  return (
    <AppShell title="Holidays">
      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Add Holiday</div>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={cls.label}>Date</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Holiday Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Type</label>
              <Select
                value={type}
                onChange={(v) => setType(v as "Regular" | "Special")}
                className="w-full"
                aria-label="Holiday type"
                options={[
                  { value: "Regular", label: "Regular Holiday" },
                  { value: "Special", label: "Special Non-Working" },
                ]}
              />
            </div>
          </div>
          <button type="submit" className={cls.btn}>
            Add Holiday
          </button>
        </form>
      </div>

      <div className={cls.panel}>
        <div className={cls.panelTitle}>Holiday Calendar</div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Date</th>
                <th className={cls.th}>Holiday</th>
                <th className={cls.th}>Type</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows cols={5} />
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cls.emptyState}>
                    No holidays configured.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.HolidayID} className="hover:bg-green-50/60">
                    <td className={cls.td}>{h.Date}</td>
                    <td className={cls.td}>{h.HolidayName}</td>
                    <td className={cls.td}>{h.Type}</td>
                    <td className={cls.td}>
                      <StatusPill status={h.Status} />
                    </td>
                    <td className={cls.td}>
                      <button onClick={() => remove(h.HolidayID, h.HolidayName)} className={`${cls.btnDanger} ${cls.btnSmall}`}>
                        Delete
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
