"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import AdminSidebar from "./AdminSidebar";
import PageTransition from "@/components/PageTransition";
import styles from "./admin.module.css";

const PAGE_TITLES = {
  "/backoffice/admin": "Dashboard",
  "/backoffice/admin/utilisateurs": "Utilisateurs",
  "/backoffice/admin/messagerie": "Messagerie",
  "/backoffice/admin/abonnements": "Gestion des abonnements",
  "/backoffice/admin/architecture": "Architecture",
  "/backoffice/admin/parametres": "Paramètres",
};

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.ADMINISTRATEUR;

  useEffect(() => {
    if (!isLoading && (!user || user.role !== ROLES.ADMINISTRATEUR)) {
      router.replace("/front/login");
    }
  }, [isLoading, user, router]);

  if (!isAuthorized) {
    return (
      <div className={styles.loadingScreen}>
        <p>Chargement...</p>
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push("/front/login");
  }

  return (
    <div className={styles.shell}>
      <AdminSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
        </header>
        <main className={styles.content}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
