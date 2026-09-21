"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, homeForRole } from "@/lib/session";

export default function RootPage() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? homeForRole(session.user.role) : "/login");
  }, [loading, session, router]);

  return null;
}
