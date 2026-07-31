"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLE_DASHBOARD_PATH } from "@/lib/roles";
import { createAvis, fetchAvis } from "@/lib/avis";
import { createDemandeDemo } from "@/lib/demandesDemo";
import { fetchPartenaires, PARTENAIRE_STATUS } from "@/lib/partenaires";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import ChatBot from "@/components/landing/ChatBot";
import CalendarInput from "@/components/CalendarInput";
import styles from "./landing.module.css";

// Seules les icônes et les liens restent statiques ici — les textes viennent
// des dictionnaires (voir src/locales/*.js) et sont assemblés par index dans
// chaque composant, pour rester traduisibles.
const FEATURE_ICONS = ["bi-house", "bi-stack", "bi-people", "bi-credit-card", "bi-bar-chart", "bi-bell"];

const ROLE_ICONS = ["bi-person-badge", "bi-briefcase", "bi-house-heart"];
const ROLE_CTAS = [{ href: "/front/login?tab=register" }, null, null];

const WHY_FADAA_ICONS = ["bi-lock", "bi-cloud", "bi-lightning-charge", "bi-grid-3x3-gap"];

const TESTIMONIALS = [
  {
    initials: "YA",
    name: "Youssef Alaoui",
    role: "Directeur d'agence, Urbanest",
    quote:
      "FADAA Locative a réduit notre temps de rapprochement mensuel de deux jours à deux heures. Le générateur d'échéancier automatique vaut à lui seul l'abonnement.",
  },
  {
    initials: "SB",
    name: "Sara Bennis",
    role: "Propriétaire",
    quote:
      "J'ai enfin une visibilité complète sur mes biens sans appeler mon agence chaque semaine. L'application mobile est simple et claire.",
    accent: true,
  },
  {
    initials: "KT",
    name: "Karim Tibichte",
    role: "Fondateur, IRMASERVICE",
    quote:
      "Les quittances prenaient un temps fou. Maintenant elles sont générées dès qu'un paiement solde l'échéance — les locataires les reçoivent instantanément.",
  },
];

function Hero() {
  const { t } = useLanguage();
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <span className={styles.eyebrow}>{t("hero.eyebrow")}</span>
        <h1 className={styles.headline}>
          {t("hero.headline1")} <span className={styles.headlineAccent}>{t("hero.headlineAccent")}</span>
        </h1>
        <p className={styles.subhead}>{t("hero.subhead")}</p>
        <div className={styles.heroActions}>
          <Link href="/front/login?tab=register" className={styles.btnPrimary}>
            {t("hero.ctaStart")}
          </Link>
          <button type="button" className={styles.btnSecondary} onClick={() => setShowDemoModal(true)}>
            {t("hero.ctaDemo")}
          </button>
        </div>
        {showDemoModal && <DemoRequestModal onClose={() => setShowDemoModal(false)} />}
        <div className={styles.statRow}>
          <span>
            <strong>500+</strong> {t("hero.statAgencies")}
          </span>
          <span>
            <strong>12 000+</strong> {t("hero.statLots")}
          </span>
          <span>
            <strong>99,9%</strong> {t("hero.statUptime")}
          </span>
        </div>
      </div>

      <div className={styles.heroVisual} aria-hidden="true">
        <div className={styles.mockCard}>
          <div className={styles.mockHeader}>
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
            <span className={styles.mockUrl}>app.fadaalocative.ma/dashboard</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/dashboard-screenshot.png" alt="" className={styles.mockScreenshot} />
        </div>
      </div>
    </section>
  );
}

function PartnerMark({ p }) {
  return p.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.logo.startsWith("http") ? p.logo : `${API_BASE_URL}${p.logo}`}
      alt={p.nom}
      className={styles.partnerLogoItem}
    />
  ) : (
    <span className={styles.logoItem}>{p.nom}</span>
  );
}

function TrustBar() {
  const { t } = useLanguage();
  const [partenaires, setPartenaires] = useState([]);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchPartenaires()
      .then((list) => {
        if (!cancelled) setPartenaires(list.filter((p) => p.statut === PARTENAIRE_STATUS.ACTIF));
      })
      .catch(() => {
        // Section purement vitrine : un échec de chargement ne doit pas casser la landing page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Déclenche l'entrée animée une seule fois, quand la section atteint le
  // viewport — pas au chargement de la page (elle est plus bas que le hero).
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || partenaires.length === 0) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [partenaires.length]);

  if (partenaires.length === 0) return null;

  // Piste dupliquée pour un défilement en boucle parfaitement continu
  // (translateX(-50%) ramène exactement au point de départ visuel).
  const track = [...partenaires, ...partenaires];

  return (
    <section
      id="partenaires"
      ref={sectionRef}
      className={`${styles.trust} ${visible ? styles.trustVisible : ""}`}
    >
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("trust.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("trust.title")}</h2>
        <p className={styles.sectionSub}>{t("trust.sub")}</p>
      </div>
      <div className={styles.marqueeViewport}>
        <div className={styles.marqueeTrack}>
          {track.map((p, i) => (
            <div
              className={`${styles.marqueeItem} ${i >= partenaires.length ? styles.marqueeItemDuplicate : ""}`}
              key={`${p.id}-${i}`}
              style={{ "--i": i % partenaires.length }}
            >
              <PartnerMark p={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useLanguage();
  const items = t("features.items");
  return (
    <section id="fonctionnalites" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("features.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("features.title")}</h2>
        <p className={styles.sectionSub}>{t("features.sub")}</p>
      </div>
      <div className={styles.featuresGrid}>
        {items.map((f, i) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <i className={`bi ${FEATURE_ICONS[i]}`} />
            </span>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureText}>{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Roles() {
  const { t } = useLanguage();
  const items = t("roles.items");
  return (
    <section id="roles" className={`${styles.section} ${styles.sectionAlt}`}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("roles.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("roles.title")}</h2>
        <p className={styles.sectionSub}>{t("roles.sub")}</p>
      </div>
      <div className={styles.rolesGrid}>
        {items.map((r, i) => {
          const isLocataire = i === 2;
          const cta = ROLE_CTAS[i];
          return (
            <div
              key={r.title}
              className={`${styles.roleCard} ${isLocataire ? styles.roleCardFeatured : ""}`}
            >
              <span className={styles.roleIcon}>
                <i className={`bi ${ROLE_ICONS[i]}`} />
              </span>
              <h3 className={styles.roleTitle}>{r.title}</h3>
              <p className={styles.roleText}>{r.text}</p>
              {cta && (
                <Link href={cta.href} className={styles.roleLink}>
                  {t("roles.createAccount")} <i className="bi bi-arrow-right" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const steps = t("howItWorks.steps");
  return (
    <section id="solutions" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("howItWorks.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("howItWorks.title")}</h2>
      </div>
      <div className={styles.stepsTrack}>
        <span className={styles.stepsTrackLine} aria-hidden="true" />
        {steps.map((label, i) => (
          <div key={label} className={styles.stepItem}>
            <span className={`${styles.stepCircle} ${i === 0 ? styles.stepCircleActive : ""}`}>{i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformShowcase() {
  const { t } = useLanguage();
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("platform.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("platform.title")}</h2>
        <p className={styles.sectionSub}>{t("platform.sub")}</p>
      </div>

      <div className={styles.platformVisual} aria-hidden="true">
        <div className={styles.dashMock}>
          <div className={styles.mockHeader}>
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
            <span className={styles.mockUrl}>app.fadaalocative.ma/dashboard</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/dashboard-screenshot.png" alt="" className={styles.mockScreenshot} />
        </div>

        <div className={styles.phonesStack}>
          <div className={styles.phoneBack}>
            <div className={styles.phoneScreen}>
              <span className={styles.phoneHeader}>Mes paiements</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/phone-card-total-paye.png" alt="" className={styles.phoneCardImg} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/phone-card-paye-ce-mois.png" alt="" className={styles.phoneCardImg} />
            </div>
          </div>
          <div className={styles.phoneFront}>
            <div className={styles.phoneScreen}>
              <span className={styles.phoneHeader}>Dashboard</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/phone-card-loyer.png" alt="" className={styles.phoneCardImg} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/phone-card-fin-bail.png" alt="" className={styles.phoneCardImg} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  const { t } = useLanguage();
  return (
    <section id="apropos" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("about.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("about.title")}</h2>
        <p className={styles.sectionSub}>{t("about.sub")}</p>
      </div>
      {/* Témoignages gardés en français quelle que soit la langue choisie : ce
          sont des citations réelles attribuées à des personnes nommées, les
          traduire romprait leur authenticité. */}
      <div className={styles.testimonialsGrid}>
        {TESTIMONIALS.map((item) => (
          <div
            key={item.name}
            className={`${styles.testimonialCard} ${item.accent ? styles.testimonialCardAccent : ""}`}
          >
            <p className={styles.quoteText}>&ldquo;{item.quote}&rdquo;</p>
            <div className={styles.testimonialMeta}>
              <span className={styles.testimonialAvatar}>{item.initials}</span>
              <div>
                <div className={styles.testimonialName}>{item.name}</div>
                <div className={styles.testimonialRole}>{item.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stars({ note }) {
  return (
    <span className={styles.avisStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= note ? "bi-star-fill" : "bi-star"}`} />
      ))}
    </span>
  );
}

function AvisForm() {
  const { t } = useLanguage();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("idle"); // idle | busy | sent | error
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !comment.trim() || status === "busy") return;
    setStatus("busy");
    setError(null);
    const [prenom, ...rest] = name.trim().split(/\s+/);
    const nom = rest.join(" ") || prenom;
    try {
      // L'email n'est demandé que pour limiter les envois anonymes en masse — il
      // n'est pas envoyé au serveur (le modèle Avis ne le stocke pas).
      await createAvis({ prenom, nom, note: rating, commentaire: comment.trim() });
      setStatus("sent");
      setName("");
      setEmail("");
      setComment("");
      setRating(5);
    } catch (err) {
      setStatus("error");
      setError(extractErrorMessage(err));
    }
  }

  if (status === "sent") {
    return (
      <div className={styles.avisFormCard}>
        <div className={styles.avisFormSentMsg}>
          <i className="bi bi-check-circle-fill" /> {t("avis.thanks")}
        </div>
      </div>
    );
  }

  return (
    <form className={styles.avisFormCard} onSubmit={handleSubmit}>
      <div className={styles.avisFormHead}>
        <h3>{t("avis.formTitle")}</h3>
        <div className={styles.avisFormStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.reviewStar}
              aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
            >
              <i className={`bi ${n <= rating ? "bi-star-fill" : "bi-star"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.avisFormRow}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("avis.namePlaceholder")}
          className={styles.avisFormInput}
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("avis.emailPlaceholder")}
          className={styles.avisFormInput}
          required
        />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("avis.commentPlaceholder")}
        className={styles.avisFormTextarea}
        rows={3}
        required
      />

      {status === "error" && <p className={styles.avisFormError}>{error}</p>}

      <button type="submit" className={styles.avisFormSubmit} disabled={status === "busy"}>
        {status === "busy" ? t("avis.submitting") : t("avis.submit")}
      </button>
    </form>
  );
}

function AvisSection() {
  const { t } = useLanguage();
  const [avisList, setAvisList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAvis()
      .then((list) => {
        if (!cancelled) setAvisList(list);
      })
      .catch(() => {
        // Avis publics : un échec de chargement ne doit pas casser la landing page.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="avis" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{t("avis.eyebrow")}</span>
        <h2 className={styles.sectionTitle}>{t("avis.title")}</h2>
        <p className={styles.sectionSub}>{t("avis.sub")}</p>
      </div>

      <AvisForm />

     {/* {!isLoading && avisList.length === 0 && (
        <p className={styles.avisEmpty}>Aucun avis publié pour le moment — soyez le premier à en laisser un !</p>
      )} */}

      {avisList.length > 0 &&
        (() => {
          const cards = avisList.slice(0, 6);
          return (
            <div className={styles.avisCarouselWrap} style={{ marginTop: "2.5rem" }}>
              <div
                className={styles.avisCarouselTrack}
                style={{ animationDuration: `${Math.max(18, cards.length * 6)}s` }}
              >
                {[...cards, ...cards].map((a, i) => (
                  <div key={`${a.id}-${i}`} className={`${styles.testimonialCard} ${styles.avisCard}`}>
                    <Stars note={a.note} />
                    {a.commentaire && (
                      <p className={styles.quoteText} style={{ marginTop: "0.9rem" }}>
                        &ldquo;{a.commentaire}&rdquo;
                      </p>
                    )}
                    <div className={styles.testimonialMeta} style={{ marginTop: "1rem" }}>
                      <span className={styles.testimonialAvatar}>
                        {a.prenom?.[0]}
                        {a.nom?.[0]}
                      </span>
                      <div className={styles.testimonialName}>
                        {a.prenom} {a.nom}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
    </section>
  );
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function DemoRequestModal({ onClose }) {
  const { t } = useLanguage();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("+212 ");
  const [dateSouhaitee, setDateSouhaitee] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || !email.trim() || !telephone.trim() || status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      await createDemandeDemo({
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim(),
        dateSouhaitee: dateSouhaitee || null,
        message: message.trim() || null,
      });
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(extractErrorMessage(err));
    }
  }

  return (
    <div className={styles.demoOverlay} onClick={onClose}>
      <div className={styles.demoModalCard} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.demoModalClose} onClick={onClose} aria-label={t("demo.close")}>
          <i className="bi bi-x-lg" />
        </button>

        {status === "sent" ? (
          <div className={styles.avisFormSentMsg}>
            <i className="bi bi-check-circle-fill" /> {t("demo.thanks")}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 className={styles.demoModalTitle}>{t("demo.title")}</h3>
            <p className={styles.demoModalSub}>{t("demo.sub")}</p>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>{t("demo.nameLabel")}</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={t("avis.namePlaceholder")}
                className={styles.avisFormInput}
                required
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>{t("demo.emailLabel")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("avis.emailPlaceholder")}
                className={styles.avisFormInput}
                required
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>{t("demo.phoneLabel")}</span>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+212 6XX XXX XXX"
                className={styles.avisFormInput}
                required
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>{t("demo.dateLabel")}</span>
              <CalendarInput
                name="dateSouhaitee"
                value={dateSouhaitee}
                onChange={(e) => setDateSouhaitee(e.target.value)}
                min={toISODate(new Date())}
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>{t("demo.messageLabel")}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("demo.messagePlaceholder")}
                className={styles.avisFormTextarea}
                rows={3}
              />
            </label>

            {status === "error" && <p className={styles.avisFormError}>{error}</p>}

            <button type="submit" className={styles.avisFormSubmit} disabled={status === "busy"}>
              {status === "busy" ? t("demo.submitting") : t("demo.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CtaBanner() {
  const { t } = useLanguage();
  const why = t("cta.why");
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <section className={styles.section} style={{ paddingBottom: "1.5rem" }}>
      <div className={styles.ctaCard}>
        <h2 className={styles.ctaTitle}>{t("cta.title")}</h2>
        <p className={styles.ctaSub}>{t("cta.sub")}</p>
        <div className={styles.ctaWhyGrid}>
          {why.map((w, i) => (
            <div key={w.title} className={styles.ctaWhyTile}>
              <span className={styles.ctaWhyIcon}>
                <i className={`bi ${WHY_FADAA_ICONS[i]}`} />
              </span>
              <h3 className={styles.ctaWhyTitle}>{w.title}</h3>
              <p className={styles.ctaWhyText}>{w.text}</p>
            </div>
          ))}
        </div>
        <div className={styles.ctaActions}>
          <Link href="/front/login?tab=register" className={styles.btnPrimaryLight}>
            {t("cta.ctaFree")}
          </Link>
          <button type="button" className={styles.btnCtaGhost} onClick={() => setShowDemoModal(true)}>
            {t("cta.ctaDemo")}
          </button>
        </div>
      </div>
      {showDemoModal && <DemoRequestModal onClose={() => setShowDemoModal(false)} />}
    </section>
  );
}

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(ROLE_DASHBOARD_PATH[user.role] || "/front/login");
    }
  }, [isLoading, user, router]);

  // Chargement direct sur une URL avec ancre (#apropos, ...) ou arrivée depuis une
  // autre page (ex: /front/contact -> /#partenaires) : le navigateur ne scrolle pas
  // tout seul ici car le contenu (notamment les partenaires, chargés en async) n'est
  // pas encore dans le DOM au moment du premier rendu — on retente jusqu'à ce que la
  // cible apparaisse plutôt que de dépendre du scroll natif.
  useEffect(() => {
    if (isLoading || user) return;
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    let attempts = 0;
    let timer;
    const tryScroll = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts < 20) {
        attempts += 1;
        timer = setTimeout(tryScroll, 100);
      }
    };
    tryScroll();
    return () => clearTimeout(timer);
  }, [isLoading, user]);

  if (isLoading || user) {
    return (
      <div className={styles.loadingScreen}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <Hero />
      <TrustBar />
      <Features />
      <Roles />
      <HowItWorks />
      <PlatformShowcase />
      <About />
      <AvisSection />
      <CtaBanner />
      <Footer />
      <ChatBot />
    </div>
  );
}
