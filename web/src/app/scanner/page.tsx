"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/session";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import type { ScanResult } from "@/lib/types";

function extractToken(text: string): string {
  const match = text.match(/[?&]token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : text;
}

export default function ScannerPage() {
  const session = useRequireAuth(["Admin", "HR"]);

  const readerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const startedRef = useRef(false);
  const busyRef = useRef(false);

  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<{ ok: true; data: ScanResult } | { ok: false; message: string } | null>(null);
  const [cameraError, setCameraError] = useState("");

  async function handleToken(token: string) {
    if (busyRef.current || !token) return;
    busyRef.current = true;
    try {
      const data = await call<ScanResult>("scanQR", {
        qrToken: token,
        device: navigator.userAgent.substring(0, 60),
      });
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Scan failed." });
    }
    setTimeout(() => {
      busyRef.current = false;
      setResult(null);
      setManualToken("");
    }, 3000);
  }

  useEffect(() => {
    if (!session || !readerRef.current) return;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled || !readerRef.current) return;
      const scanner = new Html5Qrcode(readerRef.current.id);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => handleToken(extractToken(decodedText)),
          () => {}
        )
        .then(() => {
          startedRef.current = true;
          // The effect may already have been cleaned up (React dev-mode
          // double-invoke, or a fast route change) before start() resolved.
          if (cancelled) stopScanner();
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setCameraError(`Camera unavailable. Use the manual entry field below.\n${String(err)}`);
          }
        });
    });

    function stopScanner() {
      // html5-qrcode throws synchronously (not just a rejected promise) if
      // stop() is called while it isn't actually in a running/paused state,
      // so this must run inside a try/catch, not just a .catch().
      if (!startedRef.current || !scannerRef.current) return;
      startedRef.current = false;
      try {
        scannerRef.current.stop().catch(() => {});
      } catch {
        // already stopped/never started - nothing to do
      }
    }

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const presetToken = new URLSearchParams(window.location.search).get("token");
    if (presetToken) handleToken(extractToken(presetToken));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return null;

  return (
    <AppShell title="QR Scanner">
      <div className={`${cls.panel} mx-auto max-w-[420px]`}>
        <div className={cls.panelTitle}>Scan Employee QR Code</div>
        <div id="qr-reader" ref={readerRef} className="overflow-hidden rounded-xl border border-gray-200" />
        {cameraError && (
          <div className={`${cls.emptyState} whitespace-pre-line`}>{cameraError}</div>
        )}
        <div className="mt-3 text-center text-[13px] text-gray-500">
          Point the badge&apos;s QR code at the camera. Attendance is recorded automatically.
        </div>
        <div className="mt-4 flex gap-2">
          <input
            placeholder="Or paste/enter QR token manually…"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className={cls.input}
          />
          <button onClick={() => handleToken(extractToken(manualToken))} className={cls.btnSecondary}>
            Submit
          </button>
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-green-950/96 p-6 text-center text-white">
          <div className="max-w-[420px]">
            {result.ok ? (
              <>
                <div className="mb-1.5 text-[60px]">✓</div>
                <h2 className="text-2xl font-bold">
                  {result.data.action === "TIME_IN" ? "TIME IN RECORDED" : "TIME OUT RECORDED"}
                </h2>
                <div className="mt-1.5 text-xl font-bold">{result.data.employee.fullName}</div>
                <div className="opacity-85">Employee ID: {result.data.employee.employeeId}</div>
                <div className="opacity-85">{result.data.employee.department}</div>
                <div className="my-3 text-3xl font-extrabold">
                  {result.data.action === "TIME_IN" ? result.data.record.TimeIn : result.data.record.TimeOut}
                </div>
                {result.data.action === "TIME_IN" ? (
                  <span
                    className={`inline-block rounded-full px-5.5 py-2 text-[15px] font-extrabold tracking-wide ${
                      result.data.record.Status === "LATE" ? "bg-amber-600" : "bg-green-700"
                    }`}
                  >
                    {result.data.record.Status}
                    {result.data.record.LateMinutes ? ` · ${result.data.record.LateMinutes} min late` : ""}
                  </span>
                ) : (
                  <>
                    <div className="opacity-85">
                      Total Hours: {result.data.record.TotalHours}h
                      {Number(result.data.record.OvertimeHours) > 0 ? ` (+${result.data.record.OvertimeHours}h OT)` : ""}
                    </div>
                    <span className="mt-2 inline-block rounded-full bg-amber-400 px-5.5 py-2 text-[15px] font-extrabold tracking-wide text-green-950">
                      TIME OUT
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mb-1.5 text-[60px]">⚠️</div>
                <h2 className="text-2xl font-bold">Scan Not Recorded</h2>
                <div className="opacity-85">{result.message}</div>
                <span className="mt-3 inline-block rounded-full bg-red-600 px-5.5 py-2 text-[15px] font-extrabold tracking-wide">
                  TRY AGAIN
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
