"use client";

import { AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { cls } from "./ui";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
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

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5.5">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  options.tone === "danger" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                }`}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{options.title}</h3>
                {options.message && <p className="mt-1 text-[13.5px] text-gray-600">{options.message}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={() => settle(false)} className={cls.btnSecondary}>
                Cancel
              </button>
              <button
                onClick={() => settle(true)}
                className={options.tone === "danger" ? cls.btnDanger : cls.btn}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
