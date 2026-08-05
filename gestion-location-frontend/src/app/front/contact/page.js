"use client";

import { useState } from "react";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import { createContactMessage } from "@/lib/contactMessages";
import { extractErrorMessage } from "@/lib/apiClient";
import { useLanguage } from "@/context/LanguageContext";
import landingStyles from "../../landing.module.css";
import styles from "./contact.module.css";

const CONTACT_ICONS = ["bi-envelope", "bi-telephone", "bi-geo-alt", "bi-clock"];
const CONTACT_HREFS = ["mailto:contact@fadaalocative.ma", "tel:+212500000000", null, null];

function ContactForm() {
  const { t } = useLanguage();
  const subjects = t("contact.subjects");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [sujet, setSujet] = useState(subjects[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | busy | sent | error
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim() || !email.trim() || !message.trim() || status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      await createContactMessage({
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim() || null,
        sujet,
        message: message.trim(),
      });
      setStatus("sent");
      setPrenom("");
      setNom("");
      setEmail("");
      setTelephone("");
      setSujet(subjects[0]);
      setMessage("");
    } catch (err) {
      setStatus("error");
      setError(extractErrorMessage(err));
    }
  }

  if (status === "sent") {
    return (
      <div className={styles.formCard}>
        <div className={styles.sentCard}>
          <span className={styles.sentIcon}>
            <i className="bi bi-check-lg" />
          </span>
          <h3 className={styles.sentTitle}>{t("contact.sentTitle")}</h3>
          <p className={styles.sentSub}>{t("contact.sentSub")}</p>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>{t("contact.formTitle")}</h3>
      <p className={styles.formSub}>{t("contact.formSub")}</p>

      <div className={styles.formRow}>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t("contact.firstNameLabel")}</span>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder={t("contact.firstNamePlaceholder")}
            className={landingStyles.avisFormInput}
            required
          />
        </label>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t("contact.lastNameLabel")}</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={t("contact.lastNamePlaceholder")}
            className={landingStyles.avisFormInput}
            required
          />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t("contact.emailLabel")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("contact.emailPlaceholder")}
            className={landingStyles.avisFormInput}
            required
          />
        </label>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{t("contact.phoneLabel")}</span>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder={t("contact.phonePlaceholder")}
            className={landingStyles.avisFormInput}
          />
        </label>
      </div>

      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>{t("contact.subjectLabel")}</span>
        <select value={sujet} onChange={(e) => setSujet(e.target.value)} className={styles.select} required>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>{t("contact.messageLabel")}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("contact.messagePlaceholder")}
          className={landingStyles.avisFormTextarea}
          rows={5}
          required
        />
      </label>

      {status === "error" && <p className={landingStyles.avisFormError}>{error}</p>}

      <button type="submit" className={landingStyles.avisFormSubmit} disabled={status === "busy"}>
        {status === "busy" ? t("contact.submitting") : t("contact.submit")}
      </button>
    </form>
  );
}

export default function ContactPage() {
  const { t } = useLanguage();
  const CONTACT_INFO = [
    { icon: CONTACT_ICONS[0], label: t("contact.labelEmail"), value: "contact@fadaalocative.ma", href: CONTACT_HREFS[0] },
    { icon: CONTACT_ICONS[1], label: t("contact.labelPhone"), value: "+212 5 00 00 00 00", href: CONTACT_HREFS[1] },
    { icon: CONTACT_ICONS[2], label: t("contact.labelAddress"), value: t("contact.addressValue"), href: CONTACT_HREFS[2] },
    { icon: CONTACT_ICONS[3], label: t("contact.labelHours"), value: t("contact.hoursValue"), href: CONTACT_HREFS[3] },
  ];

  return (
    <div className={landingStyles.page}>
      <NavBar />

      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>{t("contact.eyebrow")}</span>
        <h1 className={styles.heroTitle}>{t("contact.title")}</h1>
        <p className={styles.heroSub}>{t("contact.sub")}</p>
      </section>

      <div className={styles.layout}>
        <div className={styles.infoCol}>
          <div>
            <h2 className={styles.infoTitle}>{t("contact.infoTitle")}</h2>
            <p className={styles.infoSub}>{t("contact.infoSub")}</p>
          </div>

          {CONTACT_INFO.map((info) => (
            <div key={info.label} className={styles.infoCard}>
              <span className={styles.infoIcon}>
                <i className={`bi ${info.icon}`} />
              </span>
              <div>
                <p className={styles.infoLabel}>{info.label}</p>
                <p className={styles.infoValue}>
                  {info.href ? <a href={info.href}>{info.value}</a> : info.value}
                </p>
              </div>
            </div>
          ))}

          <div className={styles.socialRow}>
            <a
              href="https://web.whatsapp.com/send?phone=212662123684&text="
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className={styles.socialLink}
            >
              <i className="bi bi-whatsapp" />
            </a>
            <a
              href="https://web.facebook.com/fadaascol/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className={styles.socialLink}
            >
              <i className="bi bi-facebook" />
            </a>
            <a
              href="https://www.linkedin.com/company/fadaa-solutions/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className={styles.socialLink}
            >
              <i className="bi bi-linkedin" />
            </a>
            <a
              href="https://www.instagram.com/fadaa_ma/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={styles.socialLink}
            >
              <i className="bi bi-instagram" />
            </a>
          </div>
        </div>

        <ContactForm />
      </div>

      <Footer />
    </div>
  );
}
