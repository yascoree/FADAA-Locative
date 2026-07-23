"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./agence.module.css";

const NAV_SECTIONS = [
  {
    label: "Général",
    items: [
      { href: "/backoffice/agence", label: "Dashboard", icon: "bi-grid", exact: true },
      { href: "/backoffice/agence/biens", label: "Biens", icon: "bi-house-door" },
      { href: "/backoffice/agence/lots", label: "Lots", icon: "bi-grid-3x3-gap" },
      { href: "/backoffice/agence/baux", label: "Baux", icon: "bi-file-earmark-text" },
      { href: "/backoffice/agence/locataires", label: "Locataires", icon: "bi-people" },
    ],
  },
  {
    label: "Finances",
    items: [
      { href: "/backoffice/agence/echeances", label: "Échéances", icon: "bi-calendar-check" },
      { href: "/backoffice/agence/paiements", label: "Paiements", icon: "bi-receipt" },
      { href: "/backoffice/agence/quittances", label: "Quittances", icon: "bi-file-earmark-pdf" },
    ],
  },
  {
    label: "Échanges",
    items: [
      { href: "/backoffice/agence/discussions", label: "Discussions", icon: "bi-chat-dots" },
      { href: "/backoffice/agence/notifications", label: "Notifications", icon: "bi-bell" },
    ],
  },
  {
    label: "Compte",
    items: [{ href: "/backoffice/agence/parametres", label: "Paramètres", icon: "bi-gear" }],
  },
];

export default function AgenceSidebar({ user, onLogout }) {
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
          <span className={styles.userRole}>Gestionnaire</span>
        </div>
        <button type="button" className={styles.logoutButton} onClick={onLogout} title="Se déconnecter">
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </aside>
  );
}
