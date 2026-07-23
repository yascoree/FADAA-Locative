"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const NAV_SECTIONS = [
  {
    label: "Administration",
    items: [
      { href: "/backoffice/admin", label: "Dashboard", icon: "bi-grid", exact: true },
      { href: "/backoffice/admin/utilisateurs", label: "Utilisateurs", icon: "bi-people" },
      { href: "/backoffice/admin/messagerie", label: "Messagerie", icon: "bi-chat-dots" },
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
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className={styles.sidebarFooter}>
        <span className={styles.avatar}>{initial || "?"}</span>
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
