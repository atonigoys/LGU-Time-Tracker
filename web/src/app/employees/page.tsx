"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { UserCheck2, UserX2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/Badge";
import { SkeletonTableRows } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import { buildScanUrl, downloadDataUrl, printQrCard } from "@/lib/qr";
import type { Department, Employee, Role } from "@/lib/types";

const emptyForm = { FullName: "", Email: "", Position: "", Department: "", Role: "Employee" as Role, EmployeeID: "" };

export default function EmployeesPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        call<{ employees: Employee[] }>("getEmployees"),
        call<{ departments: Department[] }>("getDepartments"),
      ]);
      setEmployees(empRes.employees);
      setDepartments(deptRes.departments);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load employees.", true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      if (deptFilter && e.Department !== deptFilter) return false;
      if (statusFilter && e.Status !== statusFilter) return false;
      if (q && !e.FullName.toLowerCase().includes(q) && !e.EmployeeID.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const pendingCount = useMemo(() => employees.filter((e) => e.Status === "Pending").length, [employees]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, Department: departments[0]?.DepartmentName ?? "" });
    setShowForm(true);
  }

  function openEdit(e: Employee) {
    setEditingId(e.EmployeeID);
    setForm({
      FullName: e.FullName,
      Email: e.Email,
      Position: e.Position,
      Department: e.Department,
      Role: e.Role,
      EmployeeID: e.EmployeeID,
    });
    setShowForm(true);
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      const data = {
        FullName: form.FullName.trim(),
        Email: form.Email.trim(),
        Position: form.Position.trim(),
        Department: form.Department,
        Role: form.Role,
      };
      if (editingId) {
        await call("updateEmployee", { employeeId: editingId, data });
        toast("Employee updated.");
      } else {
        const res = await call<{ tempPassword?: string }>("createEmployee", {
          data: { ...data, EmployeeID: form.EmployeeID.trim() },
        });
        toast("Employee created.");
        if (res.tempPassword) setTempPassword(res.tempPassword);
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(e: Employee) {
    const deactivating = e.Status === "Active";
    if (deactivating) {
      const ok = await confirmDialog({
        title: "Deactivate employee?",
        message: `${e.FullName} will no longer be able to log in or clock attendance.`,
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }
    const action = deactivating ? "deactivateEmployee" : "activateEmployee";
    try {
      await call(action, { employeeId: e.EmployeeID });
      toast("Status updated.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed.", true);
    }
  }

  async function approve(e: Employee) {
    const ok = await confirmDialog({
      title: "Approve this account?",
      message: `${e.FullName} (${e.Email}) will be able to log in and clock attendance immediately.`,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    try {
      await call("approveEmployee", { employeeId: e.EmployeeID });
      toast("Account approved.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Approve failed.", true);
    }
  }

  async function reject(e: Employee) {
    const ok = await confirmDialog({
      title: "Reject this account?",
      message: `${e.FullName} (${e.Email}) will not be able to log in. You can reactivate them later if this was a mistake.`,
      confirmLabel: "Reject",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await call("rejectEmployee", { employeeId: e.EmployeeID });
      toast("Account rejected.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reject failed.", true);
    }
  }

  async function resetPassword(e: Employee) {
    const ok = await confirmDialog({
      title: "Reset password?",
      message: `A new temporary password will be generated for ${e.FullName}.`,
      confirmLabel: "Reset Password",
    });
    if (!ok) return;
    try {
      const res = await call<{ tempPassword: string }>("resetPassword", { employeeId: e.EmployeeID });
      setTempPassword(res.tempPassword);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reset failed.", true);
    }
  }

  async function openQr(e: Employee) {
    setQrEmployee(e);
    setQrDataUrl("");
    const url = buildScanUrl(e.QRToken);
    const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#0d3b1f", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
  }

  async function regenerateQr() {
    if (!qrEmployee) return;
    const ok = await confirmDialog({
      title: "Regenerate QR code?",
      message: "This invalidates the employee's current QR badge — they'll need a newly printed one.",
      confirmLabel: "Regenerate",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await call<{ qrToken: string }>("generateQR", { employeeId: qrEmployee.EmployeeID });
      const updated = { ...qrEmployee, QRToken: res.qrToken };
      setQrEmployee(updated);
      setEmployees((prev) => prev.map((e) => (e.EmployeeID === updated.EmployeeID ? updated : e)));
      const url = buildScanUrl(res.qrToken);
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#0d3b1f", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
      toast("QR code regenerated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Regenerate failed.", true);
    }
  }

  if (!session) return null;

  return (
    <AppShell title="Employee Management">
      {pendingCount > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            <strong>{pendingCount}</strong> {pendingCount === 1 ? "account is" : "accounts are"} waiting for approval.
          </span>
          <button
            onClick={() => setStatusFilter("Pending")}
            className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Review now
          </button>
        </div>
      )}

      <div className={cls.panel}>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className={`${cls.panelTitle} mb-0`}>All Employees</div>
          <button onClick={openAdd} className={cls.btn}>
            + Add Employee
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2.5">
          <input
            placeholder="Search name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${cls.input} min-w-[160px] flex-1`}
          />
          <Select
            value={deptFilter}
            onChange={setDeptFilter}
            className="min-w-[160px] flex-1"
            aria-label="Filter by department"
            options={[
              { value: "", label: "All Departments" },
              ...departments.map((d) => ({ value: d.DepartmentName, label: d.DepartmentName })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="min-w-[160px] flex-1"
            aria-label="Filter by status"
            options={[
              { value: "", label: "All Statuses" },
              { value: "Pending", label: "Pending Approval" },
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Employee</th>
                <th className={cls.th}>Department</th>
                <th className={cls.th}>Position</th>
                <th className={cls.th}>Role</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows cols={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={cls.emptyState}>
                    No employees match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.EmployeeID} className="hover:bg-green-50/60">
                    <td className={cls.td}>
                      <div className="font-semibold">{e.FullName}</div>
                      <div className="text-[11.5px] text-gray-500">
                        {e.EmployeeID} &middot; {e.Email}
                      </div>
                    </td>
                    <td className={cls.td}>{e.Department}</td>
                    <td className={cls.td}>{e.Position || "-"}</td>
                    <td className={cls.td}>{e.Role}</td>
                    <td className={cls.td}>
                      <StatusPill status={e.Status} />
                    </td>
                    <td className={cls.td}>
                      {e.Status === "Pending" ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => approve(e)} className={`${cls.btn} ${cls.btnSmall}`}>
                            <UserCheck2 size={13} className="mr-1 inline" /> Approve
                          </button>
                          <button onClick={() => reject(e)} className={`${cls.btnDanger} ${cls.btnSmall}`}>
                            <UserX2 size={13} className="mr-1 inline" /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => openEdit(e)} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                            Edit
                          </button>
                          <button onClick={() => openQr(e)} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                            QR
                          </button>
                          <button onClick={() => resetPassword(e)} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                            Reset PW
                          </button>
                          <button
                            onClick={() => toggleStatus(e)}
                            className={`${e.Status === "Active" ? cls.btnDanger : cls.btn} ${cls.btnSmall}`}
                          >
                            {e.Status === "Active" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5.5">
            <h3 className="mb-4 text-lg font-bold text-green-800">
              {editingId ? "Edit Employee" : "Add Employee"}
            </h3>
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className={cls.label}>Full Name</label>
                <input required value={form.FullName} onChange={(e) => setForm({ ...form, FullName: e.target.value })} className={cls.input} />
              </div>
              <div>
                <label className={cls.label}>Email</label>
                <input required type="email" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} className={cls.input} />
              </div>
              <div>
                <label className={cls.label}>Position</label>
                <input value={form.Position} onChange={(e) => setForm({ ...form, Position: e.target.value })} className={cls.input} />
              </div>
              <div>
                <label className={cls.label}>Department</label>
                <Select
                  value={form.Department}
                  onChange={(v) => setForm({ ...form, Department: v })}
                  className="w-full"
                  aria-label="Department"
                  options={departments.map((d) => ({ value: d.DepartmentName, label: d.DepartmentName }))}
                />
              </div>
              <div>
                <label className={cls.label}>Role</label>
                <Select
                  value={form.Role}
                  onChange={(v) => setForm({ ...form, Role: v as Role })}
                  className="w-full"
                  aria-label="Role"
                  options={[
                    { value: "Employee", label: "Employee" },
                    { value: "HR", label: "HR" },
                    { value: "Admin", label: "Admin" },
                  ]}
                />
              </div>
              {!editingId && (
                <div>
                  <label className={cls.label}>Employee ID (optional)</label>
                  <input
                    placeholder="Auto-generated if blank"
                    value={form.EmployeeID}
                    onChange={(e) => setForm({ ...form, EmployeeID: e.target.value })}
                    className={cls.input}
                  />
                </div>
              )}
              <div className="mt-4.5 flex justify-end gap-2.5">
                <button type="button" onClick={() => setShowForm(false)} className={cls.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={cls.btn}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrEmployee && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5.5 text-center">
            <h3 className="mb-4 text-lg font-bold text-green-800">Employee QR Code</h3>
            <div className="mx-auto max-w-[320px] rounded-xl border border-gray-200 p-6">
              <div className="text-[12px] tracking-wide text-gray-500 uppercase">LGU Time Tracker</div>
              <div className="mt-2 text-[19px] font-bold text-green-800">{qrEmployee.FullName}</div>
              <div className="mb-4 text-[13px] text-gray-500">
                {qrEmployee.EmployeeID} &middot; {qrEmployee.Department}
              </div>
              <div className="my-3 flex justify-center">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} width={220} height={220} alt="QR code" />
                ) : (
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />
                )}
              </div>
              <div className="text-[12px] text-gray-500">Scan to record attendance</div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <button onClick={regenerateQr} className={cls.btnSecondary}>
                Regenerate
              </button>
              <button
                onClick={() => qrDataUrl && downloadDataUrl(qrDataUrl, `${qrEmployee.EmployeeID}-qr.png`)}
                className={cls.btnSecondary}
              >
                Download
              </button>
              <button
                onClick={() => {
                  if (!qrDataUrl) return;
                  const ok = printQrCard(qrDataUrl, {
                    fullName: qrEmployee.FullName,
                    employeeId: qrEmployee.EmployeeID,
                    department: qrEmployee.Department,
                  });
                  if (!ok) toast("Please allow pop-ups to print the QR code.", true);
                }}
                className={cls.btn}
              >
                Print
              </button>
            </div>
            <button onClick={() => setQrEmployee(null)} className={`${cls.btnGhost} mt-2.5`}>
              Close
            </button>
          </div>
        </div>
      )}

      {tempPassword && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5.5 text-center">
            <h3 className="mb-3 text-lg font-bold text-green-800">Temporary Password</h3>
            <p className="mb-3 text-[13px] text-gray-500">
              Share this password securely with the employee. They should change it after logging in.
            </p>
            <div className="rounded-lg bg-green-50 py-3.5 text-xl font-extrabold tracking-wide text-green-800">
              {tempPassword}
            </div>
            <button onClick={() => setTempPassword(null)} className={`${cls.btn} mt-4`}>
              Done
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
