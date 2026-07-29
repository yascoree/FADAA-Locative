"use client";

import Link from "next/link";
import LogoIcon from "@/components/LogoIcon";
import styles from "./LegalPage.module.css";

/** Mise en page commune aux pages légales (CGU, confidentialité). */
export default function LegalPage({ title, updatedAt, children }) {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <Link href="/front/login" className={styles.logoLockup}>
          <span className={styles.logoMark}>
            <LogoIcon size={20} tone="light" />
          </span>
          <span className={styles.logoWord}>FADAA Locative</span>
        </Link>
        <Link href="/front/login" className={styles.backLink}>
          ← Retour
        </Link>
      </header>

      <main className={styles.content}>
        <h1 className={styles.title}>{title}</h1>
        {updatedAt && <p className={styles.updatedAt}>Dernière mise à jour : {updatedAt}</p>}
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  );
}
