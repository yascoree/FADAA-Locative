"use client";

import Link from "next/link";
import LogoIcon from "@/components/LogoIcon";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./LegalPage.module.css";

/** Mise en page commune aux pages légales (CGU, confidentialité). */
export default function LegalPage({ title, updatedAt, children }) {
  const { t } = useLanguage();
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
          {t("legal.common.backLink")}
        </Link>
      </header>

      <main className={styles.content}>
        <h1 className={styles.title}>{title}</h1>
        {updatedAt && (
          <p className={styles.updatedAt}>
            {t("legal.common.updatedAtPrefix")}
            {updatedAt}
          </p>
        )}
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  );
}
