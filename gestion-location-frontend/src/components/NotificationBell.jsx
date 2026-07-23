"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchNotifications, NOTIFICATION_STATUS } from "@/lib/notifications";
import styles from "./ui.module.css";

/** Accès notifications du topbar : compteur réel de non-lues (GET /notifications/),
    lien vers la page Notifications de l'espace courant. */
export default function NotificationBell({ href }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await fetchNotifications();
        if (!cancelled) {
          setUnreadCount(list.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE).length);
        }
      } catch {
        // Le compteur est un simple confort d'UX : une erreur ne doit jamais casser le topbar.
      }
    }
    load();
    // Poll périodiquement pour que le badge (nouveaux messages, échéances...) se
    // mette à jour sans que l'utilisateur ait à recharger la page.
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Link href={href} className={styles.bellButton} title="Notifications">
      <i className="bi bi-bell" />
      {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </Link>
  );
}
