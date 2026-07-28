"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import ProprietaireSidebar from "./ProprietaireSidebar";
import styles from "./proprietaire.module.css";

const PAGE_TITLES = {
  "/backoffice/proprietaire": "Dashboard",
  "/backoffice/proprietaire/biens": "Biens",
  "/backoffice/proprietaire/lots": "Lots",
  "/backoffice/proprietaire/baux": "Baux",
  "/backoffice/proprietaire/echeances": "Échéances",
  "/backoffice/proprietaire/paiements": "Paiements",
  "/backoffice/proprietaire/revenus": "Revenus",
  "/backoffice/proprietaire/permissions": "Gestionnaires",
  "/backoffice/proprietaire/locataires": "Locataires",
  "/backoffice/proprietaire/messagerie": "Discussions",
  "/backoffice/proprietaire/notifications": "Notifications",
  "/backoffice/proprietaire/parametres": "Paramètres",
};

export default function ProprietaireLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.PROPRIETAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  function handleContentScroll(e) {
    setIsScrolled(e.currentTarget.scrollTop > 4);
  }

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
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
          <NotificationBell href="/backoffice/proprietaire/notifications" />
        </header>
        <main className={styles.content} onScroll={handleContentScroll}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
