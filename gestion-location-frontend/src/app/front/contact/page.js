"use client";

import { useState } from "react";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import { createContactMessage } from "@/lib/contactMessages";
import { extractErrorMessage } from "@/lib/apiClient";
import landingStyles from "../../landing.module.css";
import styles from "./contact.module.css";

const SUJETS = [
  "Demande d'information",
  "Demande de démo",
  "Support / assistance",
  "Partenariat",
  "Presse",
  "Autre",
];

const CONTACT_INFO = [
  {
    icon: "bi-envelope",
    label: "E-mail",
    value: "contact@fadaalocative.ma",
    href: "mailto:contact@fadaalocative.ma",
  },
  {
    icon: "bi-telephone",
    label: "Téléphone",
    value: "+212 5 00 00 00 00",
    href: "tel:+212500000000",
  },
  {
    icon: "bi-geo-alt",
    label: "Adresse",
    value: "123 Avenue Hassan II, Casablanca, Maroc",
    href: null,
  },
  {
    icon: "bi-clock",
    label: "Horaires",
    value: "Lun. – Ven., 9h – 18h",
    href: null,
  },
];

function ContactForm() {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [sujet, setSujet] = useState(SUJETS[0]);
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
      setSujet(SUJETS[0]);
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
          <h3 className={styles.sentTitle}>Message envoyé</h3>
          <p className={styles.sentSub}>
            Merci de nous avoir contactés — notre équipe vous répondra dans les plus brefs délais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>Envoyez-nous un message</h3>
      <p className={styles.formSub}>Tous les champs marqués d&apos;un * sont obligatoires.</p>

      <div className={styles.formRow}>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Prénom *</span>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Votre prénom"
            className={landingStyles.avisFormInput}
            required
          />
        </label>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Nom *</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Votre nom"
            className={landingStyles.avisFormInput}
            required
          />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>E-mail *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className={landingStyles.avisFormInput}
            required
          />
        </label>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Téléphone</span>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="+212 6XX XXX XXX"
            className={landingStyles.avisFormInput}
          />
        </label>
      </div>

      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Sujet *</span>
        <select value={sujet} onChange={(e) => setSujet(e.target.value)} className={styles.select} required>
          {SUJETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Message *</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décrivez-nous votre besoin..."
          className={landingStyles.avisFormTextarea}
          rows={5}
          required
        />
      </label>

      {status === "error" && <p className={landingStyles.avisFormError}>{error}</p>}

      <button type="submit" className={landingStyles.avisFormSubmit} disabled={status === "busy"}>
        {status === "busy" ? "Envoi..." : "Envoyer le message"}
      </button>
    </form>
  );
}

export default function ContactPage() {
  return (
    <div className={landingStyles.page}>
      <NavBar />

      <section className={styles.hero}>
        <span className={styles.heroEyebrow}>Contact</span>
        <h1 className={styles.heroTitle}>Parlons de votre gestion locative</h1>
        <p className={styles.heroSub}>
          Une question, une démo à planifier, ou un partenariat à discuter ? Notre équipe vous répond rapidement.
        </p>
      </section>

      <div className={styles.layout}>
        <div className={styles.infoCol}>
          <div>
            <h2 className={styles.infoTitle}>Nos coordonnées</h2>
            <p className={styles.infoSub}>
              Préférez-vous nous écrire directement ? Retrouvez tous nos moyens de contact ci-dessous.
            </p>
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
            <a href="#" aria-label="Facebook" className={styles.socialLink}>
              <i className="bi bi-facebook" />
            </a>
            <a href="#" aria-label="LinkedIn" className={styles.socialLink}>
              <i className="bi bi-linkedin" />
            </a>
            <a href="#" aria-label="Instagram" className={styles.socialLink}>
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
