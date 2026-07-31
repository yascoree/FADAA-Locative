"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLES } from "@/lib/roles";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import RouteProgressBar from "@/components/RouteProgressBar";
import LocataireSidebar from "./LocataireSidebar";
import styles from "./locataire.module.css";

export default function LocataireLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.LOCATAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  const PAGE_TITLES = {
    "/backoffice/locataire": t("bo.locataireLayout.titles.dashboard"),
    "/backoffice/locataire/bail": t("bo.locataireLayout.titles.bail"),
    "/backoffice/locataire/echeances": t("bo.locataireLayout.titles.echeances"),
    "/backoffice/locataire/paiements": t("bo.locataireLayout.titles.paiements"),
    "/backoffice/locataire/discussions": t("bo.locataireLayout.titles.discussions"),
    "/backoffice/locataire/notifications": t("bo.locataireLayout.titles.notifications"),
    "/backoffice/locataire/parametres": t("bo.locataireLayout.titles.parametres"),
  };

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
        <p>{t("bo.common.loading")}</p>
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
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || t("bo.common.brand")}</h1>
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
