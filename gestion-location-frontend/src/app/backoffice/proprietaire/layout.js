"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import ProprietaireSidebar from "./ProprietaireSidebar";
import styles from "./proprietaire.module.css";

const PAGE_TITLES = {
  "/backoffice/proprietaire": "Dashboard",
  "/backoffice/proprietaire/biens": "Mes biens",
  "/backoffice/proprietaire/baux": "Baux",
  "/backoffice/proprietaire/messagerie": "Messagerie",
  "/backoffice/proprietaire/revenus": "Revenus",
  "/backoffice/proprietaire/quittances": "Quittances",
  "/backoffice/proprietaire/permissions": "Gestion Permission",
  "/backoffice/proprietaire/parametres": "Paramètres",
};

export default function ProprietaireLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.PROPRIETAIRE;

  useEffect(() => {
    if (!isLoading && (!user || user.role !== ROLES.PROPRIETAIRE)) {
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
      <ProprietaireSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
          <button type="button" className={styles.topbarAction} title="Notifications">
            <i className="bi bi-bell" />
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
