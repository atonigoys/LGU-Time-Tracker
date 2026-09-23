"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { useRequireAuth, useSession } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import { resizeImageFile } from "@/lib/image";
import type { Employee } from "@/lib/types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // pre-resize guard, generous - the real cap is post-resize

export default function ProfilePage() {
  const session = useRequireAuth();
  const { updateUser } = useSession();
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    call<{ employee: Employee }>("getMyQR")
      .then((res) => setEmployee(res.employee))
      .catch((err) => toast(err instanceof Error ? err.message : "Failed to load profile.", true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select an image file.", true);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast("That image is too large. Please choose a smaller photo.", true);
      return;
    }

    setUploading(true);
    try {
      const { base64, mimeType } = await resizeImageFile(file);
      const res = await call<{ photoUrl: string }>("uploadProfilePhoto", { imageBase64: base64, mimeType });
      setEmployee((prev) => (prev ? { ...prev, PhotoURL: res.photoUrl } : prev));
      updateUser({ photoUrl: res.photoUrl });
      toast("Profile photo updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Photo upload failed.", true);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("changePassword", { oldPassword, newPassword });
      toast("Password updated.");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed.", true);
    }
  }

  if (!session) return null;

  return (
    <AppShell title="My Profile">
      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Profile Information</div>

        <div className="mb-5 flex items-center gap-4">
          <div className="relative">
            {employee ? (
              <Avatar name={employee.FullName} photoUrl={employee.PhotoURL} size={72} />
            ) : (
              <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-gray-200" />
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 size={20} className="animate-spin text-white" />
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !employee}
              className={`${cls.btnSecondary} ${cls.btnSmall}`}
            >
              <Camera size={14} className="mr-1.5 inline" />
              {employee?.PhotoURL ? "Change Photo" : "Add Photo"}
            </button>
            <p className="mt-1.5 text-[11.5px] text-gray-500">JPEG, PNG, or WEBP. Resized automatically.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoSelected}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className={cls.label}>Full Name</div>
            <div>{employee?.FullName ?? "–"}</div>
          </div>
          <div>
            <div className={cls.label}>Employee ID</div>
            <div>{employee?.EmployeeID ?? "–"}</div>
          </div>
          <div>
            <div className={cls.label}>Email</div>
            <div>{employee?.Email ?? "–"}</div>
          </div>
          <div>
            <div className={cls.label}>Position</div>
            <div>{employee?.Position || "-"}</div>
          </div>
          <div>
            <div className={cls.label}>Department</div>
            <div>{employee?.Department ?? "–"}</div>
          </div>
          <div>
            <div className={cls.label}>Status</div>
            <div>{employee ? <StatusPill status={employee.Status} /> : "–"}</div>
          </div>
        </div>
        <p className="mt-3.5 text-[12px] text-gray-500">
          To update your name, position, or department, contact your HR administrator.
        </p>
      </div>

      <div id="password" className={`${cls.panel} scroll-mt-20`}>
        <div className={cls.panelTitle}>Change Password</div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={cls.label}>Current Password</label>
              <input required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>New Password</label>
              <input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={cls.input} />
            </div>
          </div>
          <button type="submit" className={cls.btn}>
            Update Password
          </button>
        </form>
      </div>
    </AppShell>
  );
}
