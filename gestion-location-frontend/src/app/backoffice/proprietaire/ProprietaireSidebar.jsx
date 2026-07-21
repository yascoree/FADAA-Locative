"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./proprietaire.module.css";

const NAV_SECTIONS = [
  {
    label: "Général",
    items: [
      { href: "/backoffice/proprietaire", label: "Dashboard", icon: "bi-grid", exact: true },
      { href: "/backoffice/proprietaire/biens", label: "Mes biens", icon: "bi-house-door" },
      { href: "/backoffice/proprietaire/baux", label: "Baux", icon: "bi-file-earmark-text" },
      { href: "/backoffice/proprietaire/messagerie", label: "Messagerie", icon: "bi-chat-dots", badge: 1 },
    ],
  },
  {
    label: "Finances",
    items: [
      { href: "/backoffice/proprietaire/revenus", label: "Revenus", icon: "bi-cash-stack" },
      { href: "/backoffice/proprietaire/quittances", label: "Quittances", icon: "bi-receipt" },
    ],
  },
  {
    label: "Compte",
    items: [
      { href: "/backoffice/proprietaire/permissions", label: "Gestion Permission", icon: "bi-shield-lock" },
      { href: "/backoffice/proprietaire/parametres", label: "Paramètres", icon: "bi-gear" },
    ],
  },
];

export default function ProprietaireSidebar({ user, onLogout }) {
  const pathname = usePathname();
  const initial = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logoMark}>F</span>
        <span>FADAA Locative</span>
      </div>

      <div className={styles.navSections}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className={styles.sectionLabel}>{section.label}</div>
            <nav className={styles.navList}>
              {section.items.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                  >
                    <i className={`bi ${item.icon} ${styles.navIcon}`} />
                    {item.label}
                    {item.badge ? <span className={styles.navBadge}>{item.badge}</span> : null}
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
          <span className={styles.userRole}>Propriétaire</span>
        </div>
        <button type="button" className={styles.logoutButton} onClick={onLogout} title="Se déconnecter">
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </aside>
  );
}
