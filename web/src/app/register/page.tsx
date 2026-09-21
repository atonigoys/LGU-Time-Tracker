"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Select } from "@/components/Select";
import { call } from "@/lib/api";

interface PublicDepartment {
  DepartmentID: string;
  DepartmentName: string;
}

export default function RegisterPage() {
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    call<{ departments: PublicDepartment[] }>("getActiveDepartments")
      .then((res) => {
        setDepartments(res.departments);
        setDepartment(res.departments[0]?.DepartmentName ?? "");
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await call("registerAccount", {
        data: { FullName: fullName.trim(), Email: email.trim(), Department: department, Position: position.trim(), Password: password },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 to-green-700 p-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-9 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto mb-3 text-green-600" size={44} strokeWidth={1.75} />
          <h1 className="text-lg font-bold text-green-800">Account Created</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account is now waiting for an administrator to approve it. You&apos;ll be able to log in once it&apos;s
            approved.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block w-full rounded-lg bg-green-700 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 to-green-700 p-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-9 shadow-2xl">
        <Image src="/logo.png" alt="LGU Time Tracker" width={64} height={64} className="mx-auto mb-3.5" />
        <h1 className="text-center text-lg font-bold text-green-800">Create Account</h1>
        <p className="mb-6 text-center text-xs text-gray-500">
          New employees register here — an administrator must approve your account before you can log in.
        </p>

        {error && <div className="mb-3.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Full Name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Department</label>
            <Select
              value={department}
              onChange={setDepartment}
              className="w-full"
              aria-label="Department"
              options={departments.map((d) => ({ value: d.DepartmentName, label: d.DepartmentName }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Position (optional)</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Confirm Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-green-700 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-green-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
