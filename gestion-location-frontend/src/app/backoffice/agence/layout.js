"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import AgenceSidebar from "./AgenceSidebar";
import styles from "./agence.module.css";

const PAGE_TITLES = {
  "/backoffice/agence": "Dashboard",
  "/backoffice/agence/biens": "Biens",
  "/backoffice/agence/lots": "Lots",
  "/backoffice/agence/baux": "Baux",
  "/backoffice/agence/locataires": "Locataires",
  "/backoffice/agence/echeances": "Échéances",
  "/backoffice/agence/paiements": "Paiements",
  "/backoffice/agence/quittances": "Quittances",
  "/backoffice/agence/discussions": "Discussions",
  "/backoffice/agence/notifications": "Notifications",
  "/backoffice/agence/parametres": "Paramètres",
};

export default function AgenceLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.GESTIONNAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  function handleContentScroll(e) {
    setIsScrolled(e.currentTarget.scrollTop > 4);
  }

  useEffect(() => {
    if (!isLoading && (!user || user.role !== ROLES.GESTIONNAIRE)) {
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
      <AgenceSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
          <NotificationBell href="/backoffice/agence/notifications" />
        </header>
        <main className={styles.content} onScroll={handleContentScroll}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
