"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/landing.module.css";

export default function Footer() {
  const { t } = useLanguage();

  const columns = [
    { title: t("footer.colProduct"), links: t("footer.colProductLinks") },
    { title: t("footer.colResources"), links: t("footer.colResourcesLinks") },
    { title: t("footer.colLegal"), links: t("footer.colLegalLinks") },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrandCol}>
          <div className={styles.logoLockup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fadaa-logo-full-light.png" alt="FADAA Locative" className={styles.brandLogoFull} />
          </div>
          <p className={styles.footerTagline}>{t("footer.tagline")}</p>
        </div>

        {columns.map((col) => (
          <div key={col.title} className={styles.footerCol}>
            <h4>{col.title}</h4>
            {col.links.map((l) => (
              <a key={l} href="#">
                {l}
              </a>
            ))}
          </div>
        ))}

        <div className={styles.footerCol}>
          <h4>{t("footer.contactTitle")}</h4>
          <a href="mailto:contact@fadaalocative.ma">contact@fadaalocative.ma</a>
          <a href="tel:+212500000000">+212 5 00 00 00 00</a>
          <span className={styles.footerAddress}>{t("footer.address")}</span>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} FADAA Locative — {t("footer.copyright")}
        </p>
        <div className={styles.footerSocials}>
          <a href="#" aria-label="Facebook" className={styles.footerSocial}>
            <i className="bi bi-facebook" />
          </a>
          <a href="#" aria-label="LinkedIn" className={styles.footerSocial}>
            <i className="bi bi-linkedin" />
          </a>
          <a href="#" aria-label="Instagram" className={styles.footerSocial}>
            <i className="bi bi-instagram" />
          </a>
        </div>
      </div>
    </footer>
  );
}
