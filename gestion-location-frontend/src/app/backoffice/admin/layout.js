"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import AdminSidebar from "./AdminSidebar";
import NotificationBell from "@/components/NotificationBell";
import PageTransition from "@/components/PageTransition";
import RouteProgressBar from "@/components/RouteProgressBar";
import styles from "./admin.module.css";

const PAGE_TITLES = {
  "/backoffice/admin": "Dashboard",
  "/backoffice/admin/utilisateurs": "Utilisateurs",
  "/backoffice/admin/messagerie": "Messagerie",
  "/backoffice/admin/demandes-demo": "Demandes de démo",
  "/backoffice/admin/notifications": "Notifications",
  "/backoffice/admin/abonnements": "Gestion des abonnements",
  "/backoffice/admin/architecture": "Catégories",
  "/backoffice/admin/avis": "Avis",
  "/backoffice/admin/partenaires": "Partenaires",
  "/backoffice/admin/historique": "Journal d'activité",
  "/backoffice/admin/parametres": "Paramètres",
};

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.ADMINISTRATEUR;
  const [isScrolled, setIsScrolled] = useState(false);

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
      <AdminSidebar user={user} onLogout={handleLogout} />
      <div className={styles.main}>
        <header className={`${styles.topbar} ${isScrolled ? styles.topbarScrolled : ""}`}>
          <h1 className={styles.pageTitle}>{PAGE_TITLES[pathname] || "FADAA Locative"}</h1>
          <NotificationBell href="/backoffice/admin/notifications" />
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
