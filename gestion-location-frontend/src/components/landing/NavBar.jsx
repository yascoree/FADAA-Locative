"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "@/app/landing.module.css";

const SECTION_LINKS = [
  { id: "fonctionnalites", labelKey: "nav.fonctionnalites" },
  { id: "solutions", labelKey: "nav.solutions" },
  // { id: "apropos", labelKey: "nav.apropos" },
  { id: "partenaires", labelKey: "nav.partenaires" },
];

export default function NavBar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Le header ne se fond dans le hero sombre que sur la landing elle-même
  // (les autres pages via ce composant, ex: /front/contact, n'ont pas de hero
  // sombre en dessous) — d'où la double condition pathname + scroll.
  const isHomeTop = pathname === "/" && !scrolled;

  useEffect(() => {
    if (pathname !== "/") return undefined;
    function onScroll() {
      setScrolled(window.scrollY > 48);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Sur la landing page elle-même, Next.js Link ne redéclenche pas le scroll si le
  // hash cliqué correspond déjà à l'URL courante (ex: on a déjà visité #apropos,
  // scrollé ailleurs, puis reclique dessus) — on gère alors le scroll nous-mêmes.
  // Depuis une autre page (ex: /front/contact), on laisse Link naviguer normalement
  // vers "/#id" ; la landing page se charge elle-même de scroller au montage.
  function handleSectionClick(e, id) {
    if (pathname !== "/") return;
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `/#${id}`);
  }

  return (
    <header className={`${styles.nav} ${isHomeTop ? styles.navDark : ""}`}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isHomeTop ? "/fadaa-logo-full-light.png" : "/fadaa-logo-full-dark.png"}
            alt="FADAA Locative"
            className={styles.brandLogoFull}
          />
        </Link>
        <nav className={styles.navLinks}>
          {SECTION_LINKS.map(({ id, labelKey }) => (
            <Link key={id} href={`/#${id}`} onClick={(e) => handleSectionClick(e, id)}>
              {t(labelKey)}
            </Link>
          ))}
          <Link href="/blog">{t("nav.blog")}</Link>
          <Link href="/front/contact">{t("nav.contact")}</Link>
        </nav>
        <div className={styles.navActions}>
          <LanguageSwitcher />
          <Link href="/front/login" className={styles.navLogin}>
            {t("nav.connexion")}
          </Link>
          <Link href="/front/login?tab=register" className={styles.navRegister}>
            {t("nav.essaiGratuit")}
            <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>
    </header>
  );
}
