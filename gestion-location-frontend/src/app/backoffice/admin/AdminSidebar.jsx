"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { fetchNotifications, NOTIFICATION_STATUS, NOTIFICATION_TYPE } from "@/lib/notifications";
import { fetchDemandesDemo, DEMANDE_DEMO_STATUS } from "@/lib/demandesDemo";
import { fetchPlanChangeRequests, PLAN_CHANGE_REQUEST_STATUS } from "@/lib/subscriptions";
import LogoIcon from "@/components/LogoIcon";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./admin.module.css";

function useNavSections() {
  const { t } = useLanguage();
  return [
    {
      label: t("bo.adminSidebar.administration"),
      items: [
        { href: "/backoffice/admin", label: t("bo.adminSidebar.dashboard"), icon: "bi-grid", exact: true },
        { href: "/backoffice/admin/utilisateurs", label: t("bo.adminSidebar.users"), icon: "bi-people" },
        { href: "/backoffice/admin/messagerie", label: t("bo.adminSidebar.messaging"), icon: "bi-chat-dots", badgeKey: "discussions" },
        {
          href: "/backoffice/admin/demandes-demo",
          label: t("bo.adminSidebar.demoRequests"),
          icon: "bi-calendar2-check",
          badgeKey: "demandesDemo",
        },
        { href: "/backoffice/admin/notifications", label: t("bo.adminSidebar.notifications"), icon: "bi-bell", badgeKey: "notifications" },
      ],
    },
    {
      label: t("bo.adminSidebar.platform"),
      items: [
        {
          href: "/backoffice/admin/abonnements",
          label: t("bo.adminSidebar.subscriptions"),
          icon: "bi-credit-card",
          badgeKey: "planRequests",
        },
        { href: "/backoffice/admin/architecture", label: t("bo.adminSidebar.categories"), icon: "bi-diagram-3" },
        { href: "/backoffice/admin/avis", label: t("bo.adminSidebar.reviews"), icon: "bi-chat-square-quote" },
        { href: "/backoffice/admin/partenaires", label: t("bo.adminSidebar.partners"), icon: "bi-buildings" },
      ],
    },
    {
      label: t("bo.adminSidebar.system"),
      items: [
        { href: "/backoffice/admin/historique", label: t("bo.adminSidebar.activityLog"), icon: "bi-clock-history" },
        { href: "/backoffice/admin/parametres", label: t("bo.adminSidebar.settings"), icon: "bi-gear" },
      ],
    },
  ];
}

export default function AdminSidebar({ user, onLogout }) {
  const { t } = useLanguage();
  const NAV_SECTIONS = useNavSections();
  const pathname = usePathname();
  const initial = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase();
  const itemRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  const [badges, setBadges] = useState({
    discussions: 0,
    demandesDemo: 0,
    notifications: 0,
    planRequests: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [list, demandes, planRequests] = await Promise.all([
          fetchNotifications(),
          fetchDemandesDemo(),
          fetchPlanChangeRequests(),
        ]);
        if (cancelled) return;
        const unread = list.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE);
        setBadges({
          discussions: unread.filter((n) => n.type === NOTIFICATION_TYPE.DISCUSSION).length,
          demandesDemo: demandes.filter((d) => d.statut === DEMANDE_DEMO_STATUS.NOUVELLE).length,
          notifications: unread.filter((n) => n.type !== NOTIFICATION_TYPE.DISCUSSION).length,
          planRequests: planRequests.filter((r) => r.statut === PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE).length,
        });
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
  }, [pathname, NAV_SECTIONS]);

  useEffect(() => {
    const el = activeHref ? itemRefs.current[activeHref] : null;
    setBubble(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [activeHref]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <LogoIcon size={36} />
        <span>FADAA Locative</span>
      </div>

      <Link href="/" target="_blank" rel="noopener noreferrer" className={styles.backToSiteLink}>
        <i className="bi bi-box-arrow-up-right" />
        {t("bo.adminSidebar.backToSite")}
      </Link>

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
          <span className={styles.userRole}>{t("bo.adminSidebar.role")}</span>
        </div>
        <button type="button" className={styles.logoutButton} onClick={onLogout} title={t("bo.common.logout")}>
          <i className="bi bi-box-arrow-right" />
        </button>
      </div>
    </aside>
  );
}
