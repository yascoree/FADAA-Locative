"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLES } from "@/lib/roles";
import NotificationBell from "@/components/NotificationBell";
import TopbarLanguageMenu from "@/components/TopbarLanguageMenu";
import PageTransition from "@/components/PageTransition";
import RouteProgressBar from "@/components/RouteProgressBar";
import AgenceSidebar from "./AgenceSidebar";
import PortfolioSelector from "@/components/PortfolioSelector";
import { AgencyPortfolioProvider } from "@/context/AgencyPortfolioContext";
import styles from "./agence.module.css";

export default function AgenceLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.GESTIONNAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  const PAGE_TITLES = {
    "/backoffice/agence": t("bo.agenceSidebar.dashboard"),
    "/backoffice/agence/clients": t("bo.agenceSidebar.clients"),
    "/backoffice/agence/biens": t("bo.agenceSidebar.biens"),
    "/backoffice/agence/lots": t("bo.agenceSidebar.lots"),
    "/backoffice/agence/baux": t("bo.agenceSidebar.baux"),
    "/backoffice/agence/locataires": t("bo.agenceSidebar.locataires"),
    "/backoffice/agence/maintenance": t("bo.agenceSidebar.maintenance"),
    "/backoffice/agence/echeances": t("bo.agenceSidebar.echeances"),
    "/backoffice/agence/paiements": t("bo.agenceSidebar.paiements"),
    "/backoffice/agence/discussions": t("bo.agenceSidebar.discussions"),
    "/backoffice/agence/notifications": t("bo.agenceSidebar.notifications"),
    "/backoffice/agence/collaborateurs": t("bo.agenceSidebar.collaborateurs"),
    "/backoffice/agence/parametres": t("bo.agenceSidebar.settings"),
  };

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
        <p>{t("bo.common.loading")}</p>
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push("/front/login");
  }

  return (
    <AgencyPortfolioProvider>
      <div className={styles.shell}>
        <RouteProgressBar />
      <AgenceSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || t("bo.common.brand")}</h1>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <PortfolioSelector />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.6rem" }}>
            <TopbarLanguageMenu />
            <NotificationBell href="/backoffice/agence/notifications" />
          </div>
        </header>
        <main className={styles.content} onScroll={handleContentScroll}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      {/* Ancre pour les portails (Modal, Drawer) : voir proprietaire/layout.js. */}
      <div id="portal-root" />
    </div>
    </AgencyPortfolioProvider>
  );
}
