"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Info, Loader2, LogOut, X } from "lucide-react";

/**
 * Logout confirmation. Radix Dialog supplies role="dialog", aria-modal,
 * the focus trap, Esc to close, background scroll lock, and returning focus
 * to whatever opened it.
 */
export function LogoutDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function handleOpenChange(next: boolean) {
    if (busy) return; // don't allow closing mid-logout
    if (!next) setError("");
    onOpenChange(next);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      // On success the session is cleared and the app redirects to /login,
      // which unmounts this dialog.
    } catch (err) {
      console.error("logout failed", err);
      setError("Unable to log out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[260] bg-[rgba(15,23,42,0.45)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby="logout-desc"
          aria-modal="true"
          onOpenAutoFocus={(e) => {
            // Remember what opened the dialog (there's no Dialog.Trigger, so
            // Radix can't), then start on the safe choice, not the close icon.
            openerRef.current = document.activeElement as HTMLElement | null;
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            if (openerRef.current?.isConnected) {
              e.preventDefault();
              openerRef.current.focus();
            }
          }}
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
          onPointerDownOutside={(e) => busy && e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-[270] w-[calc(100vw-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] focus:outline-none data-[state=open]:animate-[fade-in_150ms_ease-out]"
        >
          <Dialog.Close
            aria-label="Close"
            disabled={busy}
            className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={18} />
          </Dialog.Close>

          <div className="flex items-start gap-4 pr-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <LogOut size={20} strokeWidth={2.2} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <Dialog.Title className="text-[20px] leading-tight font-bold text-green-950">Log out?</Dialog.Title>
              <Dialog.Description id="logout-desc" className="mt-1.5 text-[14px] leading-normal text-gray-600">
                You&apos;ll need to sign in again to use LGU Time Tracker.
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-5 flex gap-2.5 rounded-xl border border-green-200/70 bg-green-50/70 px-3.5 py-3">
            <Info size={17} className="mt-px shrink-0 text-green-700" aria-hidden />
            <div className="text-[13.5px] leading-normal">
              <div className="font-semibold text-green-900">Your current session will be ended.</div>
              <div className="text-gray-600">Make sure to save any unsaved changes.</div>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-3 flex items-center gap-2 text-[13px] text-red-700">
              <AlertCircle size={15} className="shrink-0" aria-hidden />
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2.5 min-[400px]:flex-row min-[400px]:justify-end">
            <Dialog.Close
              ref={cancelRef}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-[10px] border border-gray-300 bg-white px-5 text-[14px] font-medium text-green-800 transition-colors duration-150 hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              aria-busy={busy}
              className="inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-[10px] bg-green-700 px-5 text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-green-800 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 disabled:active:scale-100"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden /> Logging out...
                </>
              ) : (
                <>
                  <LogOut size={16} aria-hidden /> Yes, log out
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
