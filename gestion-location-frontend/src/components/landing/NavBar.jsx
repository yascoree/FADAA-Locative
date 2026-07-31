"use client";

import Link from "next/link";
import styles from "@/app/landing.module.css";

export default function NavBar() {
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fadaa-logo-full-dark.png" alt="FADAA Locative" className={styles.brandLogoFull} />
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <Link href="/#roles">Solutions</Link>
          <Link href="/#apropos">À propos</Link>
          <Link href="/front/contact">Contact</Link>
          <Link href="/#partenaires">Partenaires</Link>
        </nav>
        <div className={styles.navActions}>
          <button type="button" className={styles.langSwitch}>
            FR <i className="bi bi-chevron-down" />
          </button>
          <Link href="/front/login" className={styles.navLogin}>
            Connexion
          </Link>
          <Link href="/front/login?tab=register" className={styles.navRegister}>
            Essai gratuit
          </Link>
        </div>
      </div>
    </header>
  );
}
