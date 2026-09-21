"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  isError: boolean;
}

interface ToastContextValue {
  toast: (message: string, isError?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, isError = false) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, isError }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in min-w-[220px] rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${
              t.isError ? "bg-red-600" : "bg-green-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx.toast;
}
