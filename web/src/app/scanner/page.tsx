"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/session";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import type { ScanResult } from "@/lib/types";

const REPEAT_SCAN_COOLDOWN_MS = 10000;

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
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<
    { ok: true; data: ScanResult } | { ok: false; message: string } | { pending: true } | null
  >(null);
  const [cameraError, setCameraError] = useState("");

  async function handleToken(token: string) {
    if (busyRef.current || !token) return;
    // With fast scanning, a badge still held in front of the camera after the
    // result screen closes would be read again and record a TIME OUT right
    // after the TIME IN. Ignore the same code for a short cooldown.
    const last = lastScanRef.current;
    if (last && last.token === token && Date.now() - last.at < REPEAT_SCAN_COOLDOWN_MS) return;
    lastScanRef.current = { token, at: Date.now() };
    busyRef.current = true;
    // The server round trip takes a few seconds; confirm the read right away
    // so people don't keep waving the badge at the camera.
    setResult({ pending: true });
    navigator.vibrate?.(80);
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

    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled || !readerRef.current) return;
      const scanner = new Html5Qrcode(readerRef.current.id, {
        verbose: false,
        // Only look for QR codes (the default tries every barcode format on
        // every frame), and use the browser's native detector when available
        // (Chrome/Android), which is much faster than the JS decoder.
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          {
            fps: 25,
            // Scan box scales with the view (~75% of the shorter side) so a
            // badge is picked up from farther away than a fixed 240px box.
            qrbox: (w: number, h: number) => {
              const size = Math.max(160, Math.floor(Math.min(w, h) * 0.75));
              return { width: size, height: size };
            },
            // Ask for a sharper feed so small or distant codes decode on the
            // first frames. When videoConstraints is set, it replaces the
            // first argument, so facingMode must be repeated here.
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
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
            {"pending" in result ? (
              <>
                <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                <h2 className="text-2xl font-bold">QR Code Detected</h2>
                <div className="opacity-85">Recording attendance…</div>
              </>
            ) : result.ok ? (
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
