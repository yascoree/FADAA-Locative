"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { fetchNotifications, NOTIFICATION_STATUS, NOTIFICATION_TYPE } from "@/lib/notifications";
import styles from "./admin.module.css";

const NAV_SECTIONS = [
  {
    label: "Administration",
    items: [
      { href: "/backoffice/admin", label: "Dashboard", icon: "bi-grid", exact: true },
      { href: "/backoffice/admin/utilisateurs", label: "Utilisateurs", icon: "bi-people" },
      { href: "/backoffice/admin/messagerie", label: "Messagerie", icon: "bi-chat-dots", badgeKey: "discussions" },
    ],
  },
  {
    label: "Plateforme",
    items: [
      { href: "/backoffice/admin/abonnements", label: "Abonnements", icon: "bi-credit-card" },
      { href: "/backoffice/admin/architecture", label: "Catégories", icon: "bi-diagram-3" },
      { href: "/backoffice/admin/avis", label: "Avis", icon: "bi-chat-square-quote" },
      { href: "/backoffice/admin/partenaires", label: "Partenaires", icon: "bi-handshake" },
    ],
  },
  {
    label: "Système",
    items: [{ href: "/backoffice/admin/parametres", label: "Paramètres", icon: "bi-gear" }],
  },
];

export default function AdminSidebar({ user, onLogout }) {
  const pathname = usePathname();
  const initial = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase();
  const itemRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  const [badges, setBadges] = useState({ discussions: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await fetchNotifications();
        if (cancelled) return;
        const unread = list.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE);
        setBadges({ discussions: unread.filter((n) => n.type === NOTIFICATION_TYPE.DISCUSSION).length });
      } catch {
        // Les badges sont un simple confort d'UX : une erreur ne doit jamais casser la sidebar.
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeHref = useMemo(() => {
    let found = null;
    NAV_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        if (isActive) found = item.href;
      });
    });
    return found;
  }, [pathname]);

  useEffect(() => {
    const el = activeHref ? itemRefs.current[activeHref] : null;
    setBubble(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [activeHref]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logoMark}>F</span>
        <span>FADAA Locative</span>
      </div>

      <div className={styles.navSections}>
        {bubble && (
          <span className={styles.navBubble} style={{ top: `${bubble.top}px`, height: `${bubble.height}px` }} />
        )}
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className={styles.sectionLabel}>{section.label}</div>
            <nav className={styles.navList}>
              {section.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={(el) => {
                      itemRefs.current[item.href] = el;
                    }}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                  >
                    <i className={`bi ${item.icon} ${styles.navIcon}`} />
                    {item.label}
                    {item.badgeKey && badges[item.badgeKey] > 0 && (
                      <span className={styles.navBadge}>{badges[item.badgeKey] > 9 ? "9+" : badges[item.badgeKey]}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className={styles.sidebarFooter}>
        {user?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_BASE_URL}${user.photo}`} alt="" className={styles.avatar} style={{ objectFit: "cover" }} />
        ) : (
          <span className={styles.avatar}>{initial || "?"}</span>
        )}
        <div className={styles.userInfo}>
          <span className={styles.userName}>
            {user?.prenom} {user?.nom}
          </span>
          <span className={styles.userRole}>Administrateur</span>
        </div>
        <button type="button" className={styles.logoutButton} onClick={onLogout} title="Se déconnecter">
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </aside>
  );
}
