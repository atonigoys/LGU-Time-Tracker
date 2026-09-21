"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import { buildScanUrl, downloadDataUrl, printQrCard } from "@/lib/qr";
import type { Employee } from "@/lib/types";

export default function MyQrPage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!session) return;
    call<{ employee: Employee }>("getMyQR")
      .then(async (res) => {
        setEmployee(res.employee);
        const url = buildScanUrl(res.employee.QRToken);
        const dUrl = await QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: "#0d3b1f", light: "#ffffff" } });
        setDataUrl(dUrl);
      })
      .catch((err) => toast(err instanceof Error ? err.message : "Failed to load QR code.", true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) return null;

  return (
    <AppShell title="My QR Code">
      <div className={cls.panel}>
        <div className="mx-auto max-w-[360px] rounded-xl border border-gray-200 p-7 text-center">
          <div className="text-[12px] tracking-wide text-gray-500 uppercase">LGU Time Tracker</div>
          {employee?.PhotoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.PhotoURL} alt="" className="mx-auto my-2 h-16 w-16 rounded-full object-cover" />
          )}
          <div className="mt-2.5 text-[19px] font-bold text-green-800">{employee?.FullName ?? "…"}</div>
          <div className="mb-4 text-[13px] text-gray-500">
            {employee ? `${employee.EmployeeID} · ${employee.Department}` : ""}
          </div>
          <div className="my-3 flex justify-center">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} width={240} height={240} alt="QR code" />
            ) : (
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />
            )}
          </div>
          <div className="text-[12px] text-gray-500">Scan to record attendance</div>
        </div>
        <div className="no-print mt-4 flex justify-center gap-2.5">
          <button
            onClick={() => employee && dataUrl && downloadDataUrl(dataUrl, `${employee.EmployeeID}-qr.png`)}
            className={cls.btnSecondary}
          >
            Download
          </button>
          <button
            onClick={() => {
              if (!employee || !dataUrl) return;
              const ok = printQrCard(dataUrl, {
                fullName: employee.FullName,
                employeeId: employee.EmployeeID,
                department: employee.Department,
              });
              if (!ok) toast("Please allow pop-ups to print the QR code.", true);
            }}
            className={cls.btn}
          >
            Print
          </button>
        </div>
      </div>
    </AppShell>
  );
}
