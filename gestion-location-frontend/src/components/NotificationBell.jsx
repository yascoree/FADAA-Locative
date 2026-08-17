"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchNotifications, NOTIFICATION_STATUS, NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications";
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
    const interval = setInterval(load, 8000);
    // Resynchronisation immédiate quand l'utilisateur lit/masque/restaure une
    // notification sur la page Notifications elle-même (voir lib/notifications.js)
    // — sans ça le badge restait visiblement en retard jusqu'au prochain poll.
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    };
  }, []);

  return (
    <Link href={href} className={styles.bellButton} title="Notifications">
      <i className="bi bi-bell" />
      {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </Link>
  );
}
