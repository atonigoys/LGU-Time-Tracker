"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { AlertTriangle, Download, Loader2, Printer, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, drivePhotoUrl } from "@/components/Avatar";
import { Skeleton } from "@/components/Skeleton";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import { addDays, formatDate, formatTime } from "@/lib/format";
import { buildScanUrl, downloadDataUrl, printQrCard } from "@/lib/qr";
import type { AttendanceRecord, DutyInfo, Employee } from "@/lib/types";

// Same encoded data as before (buildScanUrl(token)); only the rendering is
// sharper: drawn at 2x for crisp display, with a 2-module quiet zone.
const QR_COLORS = { dark: "#0d3b1f", light: "#ffffff" };
const renderQr = (token: string, width: number) =>
  QRCode.toDataURL(buildScanUrl(token), { width, margin: 2, errorCorrectionLevel: "M", color: QR_COLORS });

const STEPS = [
  { title: "Open your QR code", detail: "Show this page, or use your printed card." },
  { title: "Present it to the scanner", detail: "Hold it steady in front of the attendance camera." },
  { title: "Wait for confirmation", detail: "The scanner shows TIME IN or TIME OUT." },
  { title: "Verify your record", detail: "Check My Attendance to confirm it was saved." },
];

function InfoRow({ label, value }: { label: string; value?: string }) {
  const v = value?.trim();
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</dt>
      <dd className={`min-w-0 text-right text-[13.5px] font-medium break-words ${v ? "text-gray-900" : "text-gray-400"}`}>
        {v || "Not assigned"}
      </dd>
    </div>
  );
}

function lastUsedText(records: AttendanceRecord[] | null): string {
  if (records === null) return "Not available";
  const latest = records.find((r) => r.TimeIn || r.TimeOut);
  if (!latest) return "Not yet used";
  const time = latest.TimeOut || latest.TimeIn;
  return `${formatDate(latest.Date, "long")}, ${formatTime(time)} (${latest.TimeOut ? "Time Out" : "Time In"})`;
}

export default function MyQrPage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [issuedAt, setIssuedAt] = useState("");
  const [duty, setDuty] = useState<DutyInfo | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[] | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      await cachedCall<{ employee: Employee; qrIssuedAt?: string; duty?: DutyInfo }>("getMyQR", {}, async (res) => {
        const qr = await renderQr(res.employee.QRToken, 560);
        setEmployee(res.employee);
        setIssuedAt(res.qrIssuedAt ?? "");
        setDuty(res.duty ?? null);
        setDataUrl(qr);
      });
    } catch (err) {
      console.error("Unable to load QR code", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
    cachedCall<{ attendance: AttendanceRecord[] }>("getMyAttendance", {}, (res) => setRecords(res.attendance)).catch(() =>
      setRecords(null)
    );
  }, [session, load]);

  async function handleDownload() {
    if (!employee || downloading) return;
    setDownloading(true);
    try {
      // A larger render for printing elsewhere; same QR content.
      const big = await renderQr(employee.QRToken, 1024);
      downloadDataUrl(big, `${employee.FullName.replace(/[\\/:*?"<>|]+/g, " ").trim() || employee.EmployeeID} - Attendance QR.png`);
      toast("QR code downloaded successfully.");
    } catch (err) {
      console.error("QR download failed", err);
      toast("Unable to download the QR code. Please try again.", true);
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    if (!employee || !dataUrl) return;
    const ok = printQrCard(dataUrl, {
      fullName: employee.FullName,
      employeeId: employee.EmployeeID,
      department: employee.Department,
      position: employee.Position,
      roleLabel: "Employee",
      photoUrl: drivePhotoUrl(employee.PhotoURL),
      status: employee.Status === "Active" ? "Active" : employee.Status,
    });
    if (!ok) toast("Please allow pop-ups for this site to print your QR card.", true);
  }

  if (!session) return null;

  const active = !employee || employee.Status === "Active";
  const ready = !!employee && !!dataUrl;
  const onLeave = duty?.status === "On Leave";

  return (
    <AppShell title="My Attendance QR Code">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">My Attendance QR Code</h2>
          <p className="mt-1 text-[14px] text-gray-500">Use this QR code to record your daily time-in and time-out.</p>
        </div>
        {ready && (
          <span
            role="status"
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-inset ${
              onLeave ? "bg-amber-50 text-amber-800 ring-amber-600/25" : active ? "bg-green-50 text-green-800 ring-green-600/20" : "bg-gray-100 text-gray-600 ring-gray-400/30"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${onLeave ? "bg-amber-500" : active ? "bg-green-600" : "bg-gray-400"}`} aria-hidden />
            {onLeave ? "Paused while on leave" : active ? "QR Code Active" : "QR Code Inactive"}
          </span>
        )}
      </div>

      {ready && onLeave && duty && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[13.5px] text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">
              You&apos;re on {duty.type ? `${duty.type} leave` : "leave"} until {formatDate(duty.to, "long")}.
            </div>
            <div className="mt-0.5 text-amber-800">
              Your QR code won&apos;t record attendance during your leave. You can scan again starting {formatDate(addDays(duty.to, 1), "long")}.
            </div>
          </div>
        </div>
      )}

      {error && !ready ? (
        <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={22} />
          </div>
          <div className="font-semibold text-gray-900">Unable to load your QR code.</div>
          <p className="mt-1 text-[13.5px] text-gray-500">Please refresh the page or contact your administrator.</p>
          <button onClick={() => load()} className={`${cls.btn} mt-4`}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,410px)_minmax(0,1fr)]">
          {/* QR card */}
          <section
            aria-label="Attendance QR card"
            className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(16,24,16,0.06)]"
          >
            <div className="flex items-center justify-center gap-2 bg-green-900 px-4 py-2.5 text-white">
              <Image src="/logo.png" alt="" width={24} height={24} className="rounded-full bg-white" />
              <span className="text-[12.5px] font-bold tracking-[0.16em]">TIME TRACKER</span>
            </div>

            <div className="px-5 pt-5 pb-5 sm:px-6">
              {employee ? (
                <div className="text-center">
                  <Avatar
                    name={employee.FullName}
                    photoUrl={employee.PhotoURL}
                    size={76}
                    className="mx-auto ring-4 ring-green-50"
                  />
                  <div className="mt-2.5 text-[18px] leading-tight font-bold text-green-950">{employee.FullName}</div>
                  <div className="text-[12.5px] text-gray-500">Employee</div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Skeleton className="h-[76px] w-[76px] rounded-full" />
                  <Skeleton className="mt-3 h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
              )}

              <dl className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
                {employee ? (
                  <>
                    <InfoRow label="Employee ID" value={employee.EmployeeID} />
                    <InfoRow label="Department" value={employee.Department} />
                    <InfoRow label="Position" value={employee.Position} />
                  </>
                ) : (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between py-2.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))
                )}
              </dl>

              <div className="mt-5 flex justify-center">
                <div className="rounded-xl border border-gray-200 bg-white p-2.5">
                  {dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dataUrl}
                      width={260}
                      height={260}
                      alt={employee ? `Attendance QR code for ${employee.FullName}` : "Attendance QR code"}
                      className="block h-auto w-[min(260px,62vw)] [image-rendering:pixelated]"
                    />
                  ) : (
                    <Skeleton className="h-[min(260px,62vw)] w-[min(260px,62vw)]" />
                  )}
                </div>
              </div>
              <div className="mt-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-gray-800">
                  <ScanLine size={15} className="text-green-700" aria-hidden /> Scan to record attendance
                </div>
                <p className="mt-0.5 text-[12px] text-gray-500">Use your assigned QR code for Time In / Time Out.</p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
                <button onClick={handleDownload} disabled={!ready || downloading} className={`${cls.btn} h-11`}>
                  {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {downloading ? "Downloading…" : "Download QR"}
                </button>
                <button onClick={handlePrint} disabled={!ready} className={`${cls.btnSecondary} h-11`}>
                  <Printer size={16} /> Print
                </button>
              </div>
            </div>
          </section>

          {/* Information column */}
          <div className="flex flex-col gap-5">
            <section aria-labelledby="qr-status-title" className="rounded-xl border border-gray-200/80 bg-white p-5">
              <h3 id="qr-status-title" className="text-[11.5px] font-bold tracking-wide text-gray-500 uppercase">
                QR Status
              </h3>
              <div className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-gray-900">
                <span className={`h-2.5 w-2.5 rounded-full ${active && onLeave ? "bg-amber-500" : active ? "bg-green-600" : "bg-gray-400"}`} aria-hidden />
                {employee ? (active ? (onLeave ? "Paused (on leave)" : "Active") : employee.Status) : <Skeleton className="h-4 w-16" />}
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Generated</dt>
                  <dd className="mt-0.5 text-[13.5px] text-gray-900">
                    {employee ? (issuedAt ? formatDate(issuedAt, "long") : "Not available") : <Skeleton className="mt-1 h-3.5 w-32" />}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Last Used</dt>
                  <dd className="mt-0.5 text-[13.5px] text-gray-900">
                    {records === undefined ? <Skeleton className="mt-1 h-3.5 w-40" /> : lastUsedText(records)}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="how-title" className="rounded-xl border border-gray-200/80 bg-white p-5">
              <h3 id="how-title" className="text-[15px] font-bold text-green-900">
                How to use your QR code
              </h3>
              <ol className="mt-3 space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-[12px] font-bold text-green-800 ring-1 ring-green-600/15"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="pt-0.5">
                      <div className="text-[14px] font-semibold text-gray-900">{s.title}</div>
                      <div className="text-[12.5px] text-gray-500">{s.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section
              aria-labelledby="safe-title"
              className="flex gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4"
            >
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <h3 id="safe-title" className="text-[13.5px] font-semibold text-amber-900">
                  Keep your QR code private
                </h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-900/80">
                  Anyone with your code can record attendance as you. If your printed card is lost, ask HR to issue a new
                  QR code — the old one will stop working.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
