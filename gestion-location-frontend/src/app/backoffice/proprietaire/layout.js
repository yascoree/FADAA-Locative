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
import SubscriptionStatusBanner from "@/components/SubscriptionStatusBanner";
import ProprietaireSidebar from "./ProprietaireSidebar";
import styles from "./proprietaire.module.css";

export default function ProprietaireLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.PROPRIETAIRE;
  const [isScrolled, setIsScrolled] = useState(false);

  const PAGE_TITLES = {
    "/backoffice/proprietaire": t("bo.proprietaireSidebar.dashboard"),
    "/backoffice/proprietaire/biens": t("bo.proprietaireSidebar.biens"),
    "/backoffice/proprietaire/lots": t("bo.proprietaireSidebar.lots"),
    "/backoffice/proprietaire/baux": t("bo.proprietaireSidebar.baux"),
    "/backoffice/proprietaire/echeances": t("bo.proprietaireSidebar.echeances"),
    "/backoffice/proprietaire/paiements": t("bo.proprietaireSidebar.paiements"),
    "/backoffice/proprietaire/revenus": t("bo.proprietaireSidebar.revenus"),
    "/backoffice/proprietaire/permissions": t("bo.proprietaireSidebar.managers"),
    "/backoffice/proprietaire/locataires": t("bo.proprietaireSidebar.locataires"),
    "/backoffice/proprietaire/maintenance": t("bo.proprietaireSidebar.maintenance"),
    "/backoffice/proprietaire/messagerie": t("bo.proprietaireSidebar.discussions"),
    "/backoffice/proprietaire/notifications": t("bo.proprietaireSidebar.notifications"),
    "/backoffice/proprietaire/abonnement": t("bo.proprietaireSidebar.subscription"),
    "/backoffice/proprietaire/parametres": t("bo.proprietaireSidebar.settings"),
  };

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
      <ProprietaireSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || t("bo.common.brand")}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <TopbarLanguageMenu />
            <NotificationBell href="/backoffice/proprietaire/notifications" />
          </div>
        </header>
        <SubscriptionStatusBanner />
        <main className={styles.content} onScroll={handleContentScroll}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      {/* Ancre pour les portails (Modal, Drawer) : à l'intérieur de .shell pour
          hériter les variables CSS --primary/--text/... propres à cet espace,
          mais hors de PageTransition/.content pour éviter tout contexte
          d'empilement qui piégerait un position:fixed sous le header. */}
      <div id="portal-root" />
    </div>
  );
}
