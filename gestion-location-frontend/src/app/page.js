"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DASHBOARD_PATH } from "@/lib/roles";

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? ROLE_DASHBOARD_PATH[user.role] || "/front/login" : "/front/login");
  }, [isLoading, user, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p>Chargement...</p>
    </div>
  );
}
