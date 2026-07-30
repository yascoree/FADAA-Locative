"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import RouteProgressBar from "@/components/RouteProgressBar";
import LocataireSidebar from "./LocataireSidebar";
import styles from "./locataire.module.css";

const PAGE_TITLES = {
  "/backoffice/locataire": "Dashboard",
  "/backoffice/locataire/bail": "Mon bail",
  "/backoffice/locataire/echeances": "Mes échéances",
  "/backoffice/locataire/paiements": "Mes paiements",
  "/backoffice/locataire/discussions": "Discussions",
  "/backoffice/locataire/notifications": "Notifications",
  "/backoffice/locataire/parametres": "Paramètres",
};

export default function LocataireLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.LOCATAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  function handleContentScroll(e) {
    setIsScrolled(e.currentTarget.scrollTop > 4);
  }

  useEffect(() => {
    if (!isLoading && (!user || user.role !== ROLES.LOCATAIRE)) {
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
      <RouteProgressBar />
      <LocataireSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
          <NotificationBell href="/backoffice/locataire/notifications" />
        </header>
        <main className={styles.content} onScroll={handleContentScroll}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      {/* Ancre pour les portails (Modal, Drawer) : voir proprietaire/layout.js. */}
      <div id="portal-root" />
    </div>
  );
}
