"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLES } from "@/lib/roles";
import AdminSidebar from "./AdminSidebar";
import NotificationBell from "@/components/NotificationBell";
import TopbarLanguageMenu from "@/components/TopbarLanguageMenu";
import PageTransition from "@/components/PageTransition";
import RouteProgressBar from "@/components/RouteProgressBar";
import styles from "./admin.module.css";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.ADMINISTRATEUR;
  const [isScrolled, setIsScrolled] = useState(false);

  const PAGE_TITLES = {
    "/backoffice/admin": t("bo.adminSidebar.dashboard"),
    "/backoffice/admin/utilisateurs": t("bo.adminSidebar.users"),
    "/backoffice/admin/messagerie": t("bo.adminSidebar.messaging"),
    "/backoffice/admin/demandes-demo": t("bo.adminSidebar.demoRequests"),
    "/backoffice/admin/notifications": t("bo.adminSidebar.notifications"),
    "/backoffice/admin/abonnements": t("bo.adminSidebar.subscriptions"),
    "/backoffice/admin/abonnements/demandes": t("bo.adminSidebar.planChangeRequests"),
    "/backoffice/admin/architecture": t("bo.adminSidebar.categories"),
    "/backoffice/admin/avis": t("bo.adminSidebar.reviews"),
    "/backoffice/admin/partenaires": t("bo.adminSidebar.partners"),
    "/backoffice/admin/historique": t("bo.adminSidebar.activityLog"),
    "/backoffice/admin/parametres": t("bo.adminSidebar.settings"),
  };

  function handleContentScroll(e) {
    setIsScrolled(e.currentTarget.scrollTop > 4);
  }

  useEffect(() => {
    if (!isLoading && (!user || user.role !== ROLES.ADMINISTRATEUR)) {
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
      <AdminSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || t("bo.common.brand")}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <TopbarLanguageMenu />
            <NotificationBell href="/backoffice/admin/notifications" />
          </div>
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
