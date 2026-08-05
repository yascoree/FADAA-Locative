"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/landing.module.css";

// Accueil et À propos pointent vers la landing page ("/" et "#apropos") : si on y est
// déjà, on scrolle nous-mêmes (même logique que NavBar) ; sinon Link navigue normalement
// et la landing page se charge de scroller au montage (voir l'effet sur le hash dans page.js).
const NAV_LINKS = [
  { href: "/", sectionId: null },
  { href: "/#apropos", sectionId: "apropos" },
  { href: "/front/contact", sectionId: null },
];

const LEGAL_HREFS = ["/front/politique-confidentialite", "/front/conditions-utilisation"];

export default function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();

  function handleNavClick(e, link) {
    if (pathname !== "/") return;
    if (link.sectionId) {
      e.preventDefault();
      document.getElementById(link.sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/#${link.sectionId}`);
    } else if (link.href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const columns = [
    {
      title: t("footer.colNav"),
      links: NAV_LINKS.map((link, i) => ({
        label: t("footer.colNavLinks")[i],
        href: link.href,
        onClick: (e) => handleNavClick(e, link),
      })),
    },
    {
      title: t("footer.colSolutions"),
      links: t("footer.colSolutionsLinks").map((label) => ({ label, href: "#" })),
    },
    {
      title: t("footer.colLegal"),
      links: t("footer.colLegalLinks").map((label, i) => ({ label, href: LEGAL_HREFS[i] })),
    },
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
              <Link key={l.label} href={l.href} onClick={l.onClick}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}

        <div className={styles.footerCol}>
          <h4>{t("footer.contactTitle")}</h4>
          <a href="tel:+212662123684" className={styles.footerContactRow}>
            <i className="bi bi-phone" /> 06 62 12 36 84
          </a>
          <a href="tel:+212520735061" className={styles.footerContactRow}>
            <i className="bi bi-telephone" /> 05 20 73 50 61
          </a>
          <a href="mailto:contact@fadaa.ma" className={styles.footerContactRow}>
            <i className="bi bi-envelope" /> contact@fadaa.ma
          </a>
          <span className={`${styles.footerAddress} ${styles.footerContactRow}`}>
            <i className="bi bi-geo-alt" /> {t("footer.address")}
          </span>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} FADAA Locative — {t("footer.copyright")}{" "}
          <a href="https://irmaservice.com/" target="_blank" rel="noopener noreferrer">
            IRMASERVICE
          </a>
          .
        </p>
        <div className={styles.footerSocials}>
          <a
            href="https://web.whatsapp.com/send?phone=212662123684&text="
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className={styles.footerSocial}
          >
            <i className="bi bi-whatsapp" />
          </a>
          <a
            href="https://web.facebook.com/fadaascol/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className={styles.footerSocial}
          >
            <i className="bi bi-facebook" />
          </a>
          <a
            href="https://www.linkedin.com/company/fadaa-solutions/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className={styles.footerSocial}
          >
            <i className="bi bi-linkedin" />
          </a>
          <a
            href="https://www.instagram.com/fadaa_ma/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className={styles.footerSocial}
          >
            <i className="bi bi-instagram" />
          </a>
        </div>
      </div>
    </footer>
  );
}
