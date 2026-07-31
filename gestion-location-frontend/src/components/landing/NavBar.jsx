"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "@/app/landing.module.css";

export default function NavBar() {
  const { t } = useLanguage();

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fadaa-logo-full-dark.png" alt="FADAA Locative" className={styles.brandLogoFull} />
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/#fonctionnalites">{t("nav.fonctionnalites")}</Link>
          <Link href="/#roles">{t("nav.solutions")}</Link>
          <Link href="/#apropos">{t("nav.apropos")}</Link>
          <Link href="/#partenaires">{t("nav.partenaires")}</Link>
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
