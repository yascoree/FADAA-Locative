import styles from "@/app/landing.module.css";

const FOOTER_COLUMNS = [
  {
    title: "Produit",
    links: ["Fonctionnalités", "Application mobile", "Intégrations"],
  },
  {
    title: "Ressources",
    links: ["Documentation", "Référence API", "Blog", "Support"],
  },
  {
    title: "Légal",
    links: ["Politique de confidentialité", "Conditions d'utilisation", "Sécurité"],
  },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrandCol}>
          <div className={styles.logoLockup}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fadaa-logo-full-light.png" alt="FADAA Locative" className={styles.brandLogoFull} />
          </div>
          <p className={styles.footerTagline}>
            La plateforme tout-en-un de gestion locative pour agences, propriétaires et locataires.
          </p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
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
          <h4>Contact</h4>
          <a href="mailto:contact@fadaalocative.ma">contact@fadaalocative.ma</a>
          <a href="tel:+212500000000">+212 5 00 00 00 00</a>
          <span className={styles.footerAddress}>123 Avenue Hassan II, Casablanca, Maroc</span>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p className={styles.footerCopy}>
          © {new Date().getFullYear()} FADAA Locative — IRMASERVICE. Tous droits réservés.
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
