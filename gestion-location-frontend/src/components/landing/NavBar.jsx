"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "@/app/landing.module.css";

const SECTION_LINKS = [
  { id: "fonctionnalites", labelKey: "nav.fonctionnalites" },
  { id: "solutions", labelKey: "nav.solutions" },
  { id: "apropos", labelKey: "nav.apropos" },
  { id: "partenaires", labelKey: "nav.partenaires" },
];

export default function NavBar() {
  const { t } = useLanguage();
  const pathname = usePathname();

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
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fadaa-logo-full-dark.png" alt="FADAA Locative" className={styles.brandLogoFull} />
        </Link>
        <nav className={styles.navLinks}>
          {SECTION_LINKS.map(({ id, labelKey }) => (
            <Link key={id} href={`/#${id}`} onClick={(e) => handleSectionClick(e, id)}>
              {t(labelKey)}
            </Link>
          ))}
          <Link href="/front/contact">{t("nav.contact")}</Link>
        </nav>
        <div className={styles.navActions}>
          <LanguageSwitcher />
          <Link href="/front/login" className={styles.navLogin}>
            {t("nav.connexion")}
          </Link>
          <Link href="/front/login?tab=register" className={styles.navRegister}>
            {t("nav.essaiGratuit")}
          </Link>
        </div>
      </div>
    </header>
  );
}
