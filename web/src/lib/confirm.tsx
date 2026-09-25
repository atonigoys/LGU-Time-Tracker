"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CircleHelp, Trash2, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  /** Extra content under the message, e.g. a preview of what's being confirmed. */
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** default = neutral action, danger = destructive (red), warning = reversible but notable (amber) */
  tone?: "default" | "danger" | "warning";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const TONES = {
  default: { icon: CircleHelp, iconBox: "bg-green-50 text-green-700 ring-green-600/15", button: "bg-green-700 hover:bg-green-800 focus-visible:ring-green-600" },
  warning: { icon: AlertTriangle, iconBox: "bg-amber-50 text-amber-600 ring-amber-500/20", button: "bg-green-700 hover:bg-green-800 focus-visible:ring-green-600" },
  danger: { icon: Trash2, iconBox: "bg-red-50 text-red-600 ring-red-500/20", button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" },
};

/**
 * App-wide Yes/No dialog: `const ok = await confirm({ title, message })`.
 * Radix Dialog handles the focus trap, Esc, scroll lock and returning focus.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // A second request replaces the first; treat the first as cancelled.
    resolver.current?.(false);
    setOptions(opts);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    setOptions(null);
    resolver.current?.(value);
    resolver.current = null;
  }

  const tone = TONES[options?.tone ?? "default"];
  const Icon = tone.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[280] bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
          <Dialog.Content
            aria-describedby={options?.message ? "confirm-message" : undefined}
            className="fixed top-1/2 left-1/2 z-[290] w-[calc(100vw-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] focus:outline-none data-[state=open]:animate-[modal-in_180ms_ease-out]"
          >
            {options && (
              <>
                <div className="px-6 pt-5 pb-5">
                  <Dialog.Close
                    aria-label="Close"
                    className="absolute top-4 right-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
                  >
                    <X size={18} />
                  </Dialog.Close>
                  <div className="flex items-start gap-4 pr-6">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${tone.iconBox}`}>
                      <Icon size={20} strokeWidth={2.2} aria-hidden />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <Dialog.Title className="text-[19px] leading-tight font-bold text-green-950">{options.title}</Dialog.Title>
                      {options.message && (
                        <Dialog.Description id="confirm-message" className="mt-1.5 text-[14px] leading-normal text-balance text-gray-600">
                          {options.message}
                        </Dialog.Description>
                      )}
                    </div>
                  </div>
                  {options.details && <div className="mt-4">{options.details}</div>}
                </div>
                <div className="flex flex-col-reverse gap-2.5 border-t border-gray-100 bg-gray-50/60 px-6 py-4 min-[400px]:flex-row min-[400px]:justify-end">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => settle(false)}
                    className="inline-flex h-11 items-center justify-center rounded-[10px] border border-gray-300 bg-white px-5 text-[14px] font-medium text-green-800 transition-colors duration-150 hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {options.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(true)}
                    className={`inline-flex h-11 min-w-[120px] items-center justify-center rounded-[10px] px-5 text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] ${tone.button}`}
                  >
                    {options.confirmLabel ?? "Confirm"}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
