"use client";

import { FormEvent, useId, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { call } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cls } from "@/lib/ui";

const MIN_LENGTH = 8;

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={cls.label}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          className={`${cls.input} pr-10 ${invalid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11.5px] text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * Change-password form shared by Settings and Profile. Shows progress and a
 * result that stays on screen - the request takes seconds on Apps Script, and
 * a disappearing toast alone was easy to miss.
 */
export function ChangePasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setResult(null);
    if (!current) return setResult({ ok: false, message: "Please enter your current password." });
    if (next.length < MIN_LENGTH) {
      return setResult({ ok: false, message: `New password must be at least ${MIN_LENGTH} characters.` });
    }
    if (next !== confirm) return setResult({ ok: false, message: "The new passwords don't match." });
    if (next === current) return setResult({ ok: false, message: "The new password must be different from the current one." });

    setBusy(true);
    try {
      await call("changePassword", { oldPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setResult({ ok: true, message: "Your password has been updated. Use the new password next time you sign in." });
      toast("Password updated.");
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Unable to update your password. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      {result && (
        <div
          role={result.ok ? "status" : "alert"}
          className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] ${
            result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {result.ok ? <CheckCircle2 size={16} className="mt-px shrink-0" /> : <AlertCircle size={16} className="mt-px shrink-0" />}
          {result.message}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PasswordField label="Current Password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField
          label="New Password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={`At least ${MIN_LENGTH} characters.`}
        />
        <PasswordField
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={mismatch}
          hint={mismatch ? "Doesn't match the new password." : undefined}
        />
      </div>
      <button type="submit" disabled={busy} className={cls.btn}>
        {busy ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Updating…
          </>
        ) : (
          "Update Password"
        )}
      </button>
    </form>
  );
}
