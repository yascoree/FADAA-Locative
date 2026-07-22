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
    async function init() {
      try {
        const list = await fetchNotifications();
        if (!cancelled) {
          setUnreadCount(list.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE).length);
        }
      } catch {
        // Le compteur est un simple confort d'UX : une erreur ne doit jamais casser le topbar.
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link href={href} className={styles.bellButton} title="Notifications">
      <i className="bi bi-bell" />
      {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </Link>
  );
}
