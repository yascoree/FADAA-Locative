"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import styles from "./agence.module.css";

export default function AgenceLayout({ children }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const isAuthorized = !isLoading && user && user.role === ROLES.GESTIONNAIRE;

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
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>F</span>
          <span>FADAA Locative — Espace Gestionnaire</span>
        </div>
        <div className={styles.userMenu}>
          <span>
            {user.prenom} {user.nom}
          </span>
          <button type="button" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
