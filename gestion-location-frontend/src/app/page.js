"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DASHBOARD_PATH } from "@/lib/roles";
import { createAvis, fetchAvis } from "@/lib/avis";
import { createDemandeDemo } from "@/lib/demandesDemo";
import { fetchPartenaires, PARTENAIRE_STATUS } from "@/lib/partenaires";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import styles from "./landing.module.css";

const FEATURES = [
  {
    icon: "bi-house",
    title: "Gestion des biens",
    text: "Enregistrez immeubles, lots et documents dans un espace organisé.",
  },
  {
    icon: "bi-stack",
    title: "Gestion des baux",
    text: "Créez un bail en quelques secondes — l'échéancier est généré automatiquement.",
  },
  {
    icon: "bi-people",
    title: "Gestion des locataires",
    text: "Centralisez fiches, documents et historique de communication.",
  },
  {
    icon: "bi-credit-card",
    title: "Encaissement des loyers",
    text: "Suivez les paiements, les soldes, et générez les quittances PDF automatiquement.",
  },
  {
    icon: "bi-bar-chart",
    title: "Tableau de bord analytique",
    text: "Visibilité en temps réel sur les revenus, l'occupation et les impayés.",
  },
  {
    icon: "bi-bell",
    title: "Notifications push",
    text: "Rappels automatiques pour les échéances, quittances et fins de bail.",
  },
];

const ROLES = [
  {
    icon: "bi-person-badge",
    title: "Propriétaire",
    text: "Gérez vos biens et vos baux en autonomie, ou déléguez à un gestionnaire de confiance tout en gardant un œil sur tout.",
    cta: { label: "Créer un compte", href: "/front/login?tab=register" },
  },
  {
    icon: "bi-briefcase",
    title: "Gestionnaire / Agence",
    text: "Gérez les biens de plusieurs propriétaires au même endroit, avec des permissions précises accordées par mandat.",
    cta: { label: "Créer un compte", href: "/front/login?tab=register" },
  },
  {
    icon: "bi-house-heart",
    title: "Locataire",
    text: "Consultez vos échéances, vos paiements et vos quittances. Votre propriétaire vous invite directement — aucune inscription nécessaire.",
    cta: null,
  },
  {
    icon: "bi-speedometer2",
    title: "Administrateur",
    text: "Supervise l'ensemble de la plateforme : utilisateurs, abonnements et journal d'activité, sur invitation uniquement.",
    cta: null,
  },
];

const STEPS = [
  "Créer l'agence",
  "Ajouter les biens",
  "Créer les baux",
  "Assigner les locataires",
  "Suivre les paiements",
  "Générer les quittances",
];

const WHY_FADAA = [
  {
    icon: "bi-lock",
    title: "Sécurisé",
    text: "Données chiffrées et accès basé sur les rôles.",
  },
  {
    icon: "bi-cloud",
    title: "100% Cloud",
    text: "Accédez à vos données partout, toujours synchronisées.",
  },
  {
    icon: "bi-lightning-charge",
    title: "Rapide",
    text: "Réponses en moins de 500 ms sur les actions clés.",
  },
  {
    icon: "bi-grid-3x3-gap",
    title: "Multi-tenant",
    text: "Données isolées par compte, conçu pour grandir.",
  },
];

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

const DASH_BIENS = [
  { name: "Résidence Anfa — 4 lots", badge: "Actif" },
  { name: "Villa Oasis — 1 lot", badge: "Actif" },
  { name: "Immeuble Nour — 6 lots", badge: "Actif" },
];

const DASH_ACTIVITY = [
  { text: "Paiement reçu", time: "il y a 2h" },
  { text: "Bail créé", time: "il y a 5j" },
  { text: "Relance d'impayé envoyée", time: "il y a 1j" },
];

function NavBar() {
  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <div className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fadaa-logo-full-dark.png" alt="FADAA Locative" className={styles.brandLogoFull} />
        </div>
        <nav className={styles.navLinks}>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#roles">Solutions</a>
          <a href="#apropos">À propos</a>
          <a href="#contact">Contact</a>
          <a href="#partenaires">Partenaires</a>
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

function Hero() {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <span className={styles.eyebrow}>La gestion locative, réinventée</span>
        <h1 className={styles.headline}>
          Gérez vos biens locatifs <span className={styles.headlineAccent}>plus intelligemment</span>
        </h1>
        <p className={styles.subhead}>
          FADAA Locative centralise vos biens, baux, locataires et paiements sur une seule plateforme — pour que les
          agences et propriétaires passent moins de temps sur des tableurs et plus de temps à développer leur
          portefeuille.
        </p>
        <div className={styles.heroActions}>
          <Link href="/front/login?tab=register" className={styles.btnPrimary}>
            Commencer
          </Link>
          <button type="button" className={styles.btnSecondary} onClick={() => setShowDemoModal(true)}>
            Demander une démo
          </button>
        </div>
        {showDemoModal && <DemoRequestModal onClose={() => setShowDemoModal(false)} />}
        <div className={styles.statRow}>
          <span>
            <strong>500+</strong> agences
          </span>
          <span>
            <strong>12 000+</strong> lots gérés
          </span>
          <span>
            <strong>99,9%</strong> de disponibilité
          </span>
        </div>
      </div>

      <div className={styles.heroVisual} aria-hidden="true">
        <div className={styles.mockCard}>
          <div className={styles.mockHeader}>
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
            <span className={styles.mockDot} />
          </div>
          <div className={styles.mockBody}>
            <div className={styles.mockTileRow}>
              <div className={styles.mockTile}>
                <span className={styles.mockTileLabel}>Encaissé</span>
                <span className={styles.mockTileValue}>42 500 MAD</span>
              </div>
              <div className={`${styles.mockTile} ${styles.mockTileAccent}`}>
                <span className={styles.mockTileLabel}>Occupation</span>
                <span className={styles.mockTileValue}>87%</span>
              </div>
              <div className={styles.mockTile}>
                <span className={styles.mockTileLabel}>Impayés</span>
                <span className={styles.mockTileValue}>3</span>
              </div>
            </div>
            <div className={styles.mockBars}>
              {[45, 55, 50, 68, 60, 78, 62].map((h, i) => (
                <span key={i} className={styles.mockBar} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className={styles.mockList}>
              <div className={styles.mockListRow}>
                <span>K. Amrani — Résidence Anfa</span>
                <span className={styles.mockStatusOk}>Payé</span>
              </div>
              <div className={styles.mockListRow}>
                <span>S. Bennis — Villa Oasis</span>
                <span className={styles.mockStatusOk}>Payé</span>
              </div>
              <div className={styles.mockListRow}>
                <span>M. Idrissi — Immeuble Nour</span>
                <span className={styles.mockStatusBad}>Impayé</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const [partenaires, setPartenaires] = useState([]);

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

  if (partenaires.length === 0) return null;

  return (
    <section id="partenaires" className={styles.trust}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Partenaires</span>
        <h2 className={styles.sectionTitle}>Ils nous font confiance</h2>
        <p className={styles.sectionSub}>
          Agences et propriétaires à travers le Maroc gèrent déjà leur portefeuille avec FADAA Locative.
        </p>
      </div>
      <div className={styles.logosRow}>
        {partenaires.map((p) =>
          p.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.logo.startsWith("http") ? p.logo : `${API_BASE_URL}${p.logo}`}
              alt={p.nom}
              className={styles.partnerLogoItem}
            />
          ) : (
            <span key={p.id} className={styles.logoItem}>
              {p.nom}
            </span>
          )
        )}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="fonctionnalites" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Fonctionnalités</span>
        <h2 className={styles.sectionTitle}>Tout ce qu&apos;il faut pour gérer vos locations</h2>
        <p className={styles.sectionSub}>
          Une seule plateforme pour tout le cycle de vie locatif, de l&apos;ajout d&apos;un bien à l&apos;encaissement
          du loyer.
        </p>
      </div>
      <div className={styles.featuresGrid}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <i className={`bi ${f.icon}`} />
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
  return (
    <section id="roles" className={`${styles.section} ${styles.sectionAlt}`}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Pour qui ?</span>
        <h2 className={styles.sectionTitle}>Un espace pensé pour chaque rôle</h2>
        <p className={styles.sectionSub}>Chacun voit exactement ce dont il a besoin, rien de plus.</p>
      </div>
      <div className={styles.rolesGrid}>
        {ROLES.map((r) => (
          <div key={r.title} className={styles.roleCard}>
            <span className={styles.roleIcon}>
              <i className={`bi ${r.icon}`} />
            </span>
            <h3 className={styles.roleTitle}>{r.title}</h3>
            <p className={styles.roleText}>{r.text}</p>
            {r.cta && (
              <Link href={r.cta.href} className={styles.roleLink}>
                {r.cta.label} <i className="bi bi-arrow-right" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Solutions</span>
        <h2 className={styles.sectionTitle}>Opérationnel en six étapes simples</h2>
      </div>
      <div className={styles.stepsTrack}>
        <span className={styles.stepsTrackLine} aria-hidden="true" />
        {STEPS.map((label, i) => (
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
  return (
    <section className={`${styles.section} ${styles.sectionAlt}`}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Produit</span>
        <h2 className={styles.sectionTitle}>Une seule plateforme, du web au mobile</h2>
        <p className={styles.sectionSub}>
          Le même portefeuille, piloté depuis un dashboard complet au bureau et suivi en un coup d&apos;œil en
          déplacement.
        </p>
      </div>

      <div className={styles.platformVisual} aria-hidden="true">
        <div className={styles.dashMock}>
          <div className={styles.dashSidebar}>
            <div className={styles.dashLogo}>
              <span className={styles.logoMark} />
              FADAA Locative
            </div>
            <nav className={styles.dashNav}>
              <span className={styles.dashNavActive}>Dashboard</span>
              <span>Biens</span>
              <span>Baux</span>
              <span>Locataires</span>
              <span>Paiements</span>
              <span>Quittances</span>
              <span>Paramètres</span>
            </nav>
          </div>
          <div className={styles.dashMain}>
            <div className={styles.dashHeader}>
              <span>Dashboard</span>
              <span className={styles.dashUser}>Karim Tibichte</span>
            </div>
            <div className={styles.dashTiles}>
              <div className={styles.dashTile}>
                <span className={styles.dashTileLabel}>Encaissé (mois)</span>
                <span className={styles.dashTileValue}>42 500 MAD</span>
              </div>
              <div className={styles.dashTile}>
                <span className={styles.dashTileLabel}>Attendu (mois)</span>
                <span className={styles.dashTileValue}>48 000 MAD</span>
              </div>
              <div className={`${styles.dashTile} ${styles.dashTileAccent}`}>
                <span className={styles.dashTileLabel}>Occupation</span>
                <span className={styles.dashTileValue}>87%</span>
              </div>
              <div className={styles.dashTile}>
                <span className={styles.dashTileLabel}>Impayés</span>
                <span className={styles.dashTileValue}>3</span>
              </div>
            </div>
            <div className={styles.dashCols}>
              <div className={styles.dashPanel}>
                <h4>Biens</h4>
                {DASH_BIENS.map((b) => (
                  <div key={b.name} className={styles.dashPanelRow}>
                    <span>{b.name}</span>
                    <span className={styles.dashBadge}>{b.badge}</span>
                  </div>
                ))}
              </div>
              <div className={styles.dashPanel}>
                <h4>Activité récente</h4>
                {DASH_ACTIVITY.map((a) => (
                  <div key={a.text} className={styles.dashPanelRow}>
                    <span>{a.text}</span>
                    <span className={styles.dashChip}>{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.phonesStack}>
          <div className={styles.phoneBack}>
            <div className={styles.phoneScreen}>
              <span className={styles.phoneHeader}>Mes paiements</span>
              {["Payé", "Payé", "Payé"].map((s, i) => (
                <div key={i} className={styles.phoneListRow}>
                  <span className={styles.phoneListLine} />
                  <span className={styles.mockStatusOk}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.phoneFront}>
            <div className={styles.phoneScreen}>
              <span className={styles.phoneHeader}>Dashboard</span>
              <div className={styles.phoneCardAccent}>
                <span>Prochaine échéance</span>
                <strong>3 500 MAD — 5 août</strong>
              </div>
              <div className={styles.phoneCard}>
                <span>Mon bien</span>
                <strong>Résidence Anfa — 3B</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyFadaa() {
  return (
    <section className={styles.section}>
      <div className={styles.whyCard}>
        <div className={styles.sectionHead}>
          <span className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Pourquoi FADAA Locative</span>
          <h2 className={styles.whyTitle}>Pensé pour la fiabilité à grande échelle</h2>
          <p className={styles.whySub}>L&apos;infrastructure sur laquelle votre activité peut compter, chaque jour.</p>
        </div>
        <div className={styles.whyGrid}>
          {WHY_FADAA.map((w) => (
            <div key={w.title} className={styles.whyTile}>
              <span className={styles.whyIcon}>
                <i className={`bi ${w.icon}`} />
              </span>
              <h3 className={styles.whyTileTitle}>{w.title}</h3>
              <p className={styles.whyTileText}>{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="apropos" className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>À propos</span>
        <h2 className={styles.sectionTitle}>Adopté par les agences et propriétaires</h2>
        <p className={styles.sectionSub}>
          FADAA Locative est développé par IRMASERVICE pour simplifier la gestion locative au Maroc.
        </p>
      </div>
      <div className={styles.testimonialsGrid}>
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className={`${styles.testimonialCard} ${t.accent ? styles.testimonialCardAccent : ""}`}>
            <p className={styles.quoteText}>&ldquo;{t.quote}&rdquo;</p>
            <div className={styles.testimonialMeta}>
              <span className={styles.testimonialAvatar}>{t.initials}</span>
              <div>
                <div className={styles.testimonialName}>{t.name}</div>
                <div className={styles.testimonialRole}>{t.role}</div>
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
          <i className="bi bi-check-circle-fill" /> Merci ! Votre avis sera publié après modération.
        </div>
      </div>
    );
  }

  return (
    <form className={styles.avisFormCard} onSubmit={handleSubmit}>
      <div className={styles.avisFormHead}>
        <h3>Laissez votre avis</h3>
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
          placeholder="Votre nom"
          className={styles.avisFormInput}
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre e-mail"
          className={styles.avisFormInput}
          required
        />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Partagez votre expérience avec FADAA Locative..."
        className={styles.avisFormTextarea}
        rows={3}
        required
      />

      {status === "error" && <p className={styles.avisFormError}>{error}</p>}

      <button type="submit" className={styles.avisFormSubmit} disabled={status === "busy"}>
        {status === "busy" ? "Envoi..." : "Envoyer mon avis"}
      </button>
    </form>
  );
}

function AvisSection() {
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
        <span className={styles.eyebrow}>Avis</span>
        <h2 className={styles.sectionTitle}>Ce que disent nos utilisateurs</h2>
        <p className={styles.sectionSub}>Des avis vérifiés, publiés après modération.</p>
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

const CALENDAR_WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const CALENDAR_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MiniDatePicker({ value, onChange }) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // grille lundi -> dimanche
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));

  return (
    <div className={styles.miniCalendarWrap} ref={wrapRef}>
      <button type="button" className={styles.miniCalendarTrigger} onClick={() => setOpen((o) => !o)}>
        <i className="bi bi-calendar3" />
        <span className={selectedDate ? undefined : styles.miniCalendarPlaceholder}>
          {selectedDate
            ? selectedDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
            : "Choisir une date"}
        </span>
      </button>

      {open && (
        <div className={styles.miniCalendarPanel}>
          <div className={styles.miniCalendarHeader}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mois précédent">
              <i className="bi bi-chevron-left" />
            </button>
            <span>
              {CALENDAR_MONTHS[month]} {year}
            </span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Mois suivant">
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          <div className={styles.miniCalendarWeekdays}>
            {CALENDAR_WEEKDAYS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>

          <div className={styles.miniCalendarGrid}>
            {cells.map((d, i) => {
              if (!d) return <span key={`empty-${i}`} />;
              const isPast = d < today;
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  disabled={isPast}
                  className={`${styles.miniCalendarDay} ${isSelected ? styles.miniCalendarDaySelected : ""} ${
                    isToday ? styles.miniCalendarDayToday : ""
                  }`}
                  onClick={() => {
                    onChange(toISODate(d));
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DemoRequestModal({ onClose }) {
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
        <button type="button" className={styles.demoModalClose} onClick={onClose} aria-label="Fermer">
          <i className="bi bi-x-lg" />
        </button>

        {status === "sent" ? (
          <div className={styles.avisFormSentMsg}>
            <i className="bi bi-check-circle-fill" /> Merci ! Votre demande a été transmise, notre équipe vous
            recontactera rapidement.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 className={styles.demoModalTitle}>Demander une démo</h3>
            <p className={styles.demoModalSub}>
              Laissez-nous vos coordonnées et vos disponibilités, un membre de notre équipe vous recontactera pour
              organiser une démonstration.
            </p>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>Nom</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Votre nom"
                className={styles.avisFormInput}
                required
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Votre e-mail"
                className={styles.avisFormInput}
                required
              />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>Téléphone</span>
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
              <span className={styles.demoFieldLabel}>Date souhaitée pour la démo</span>
              <MiniDatePicker value={dateSouhaitee} onChange={setDateSouhaitee} />
            </label>

            <label className={styles.demoFieldGroup}>
              <span className={styles.demoFieldLabel}>Message (optionnel)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Précisez votre besoin"
                className={styles.avisFormTextarea}
                rows={3}
              />
            </label>

            {status === "error" && <p className={styles.avisFormError}>{error}</p>}

            <button type="submit" className={styles.avisFormSubmit} disabled={status === "busy"}>
              {status === "busy" ? "Envoi..." : "Envoyer ma demande"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CtaBanner() {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <section className={styles.section} style={{ paddingBottom: "1.5rem" }}>
      <div className={styles.ctaCard}>
        <h2 className={styles.ctaTitle}>Prêt à simplifier votre gestion locative ?</h2>
        <p className={styles.ctaSub}>
          Rejoignez des centaines d&apos;agences et de propriétaires qui gèrent déjà leur portefeuille sur FADAA
          Locative.
        </p>
        <div className={styles.ctaActions}>
          <Link href="/front/login?tab=register" className={styles.btnPrimaryLight}>
            Essai gratuit
          </Link>
          <button type="button" className={styles.btnCtaGhost} onClick={() => setShowDemoModal(true)}>
            Demander une démo
          </button>
        </div>
      </div>
      {showDemoModal && <DemoRequestModal onClose={() => setShowDemoModal(false)} />}
    </section>
  );
}

function Footer() {
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

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(ROLE_DASHBOARD_PATH[user.role] || "/front/login");
    }
  }, [isLoading, user, router]);

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
      <WhyFadaa />
      <About />
      <AvisSection />
      <CtaBanner />
      <Footer />
    </div>
  );
}
