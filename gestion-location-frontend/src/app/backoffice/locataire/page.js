"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardStats } from "@/lib/stats";
import {
  fetchBaux,
  fetchBiens,
  fetchEcheances,
  fetchPaiements,
  fetchQuittances,
  fetchCategories,
  downloadQuittance,
  BAIL_STATUS,
  BAIL_STATUS_LABELS,
  ECHEANCE_STATUS,
  PAIEMENT_STATUS,
} from "@/lib/properties";
import { fetchDiscussions } from "@/lib/discussions";
import styles from "./locataire.module.css";

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateShort(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function badgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

export default function LocataireDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [quittances, setQuittances] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [statsData, bauxList, biensList, categoriesList, echeancesList, paiementsList, quittancesList, discussions] =
          await Promise.all([
            fetchDashboardStats(),
            fetchBaux(),
            fetchBiens(),
            fetchCategories(),
            fetchEcheances(),
            fetchPaiements(),
            fetchQuittances(),
            fetchDiscussions(),
          ]);
        setStats(statsData);
        setBaux(bauxList);
        setBiens(biensList);
        setCategories(categoriesList);
        setEcheances(echeancesList);
        setPaiements(paiementsList);
        setQuittances(quittancesList);
        setMessages(discussions);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const activeBaux = useMemo(() => baux.filter((b) => b.statut === BAIL_STATUS.ACTIF), [baux]);
  const activeBail = activeBaux[0] || null;
  const bien = biens.find((b) => b.id === activeBail?.lot?.bien_id) || null;
  const category = categories.find((c) => c.id === activeBail?.lot?.categorie_id);

  const bailEcheances = useMemo(
    () => (activeBail ? echeances.filter((e) => e.bail_id === activeBail.id) : []),
    [echeances, activeBail]
  );

  const bailPaiements = useMemo(() => {
    if (!activeBail) return [];
    return paiements
      .filter((p) => p.echeance?.bail_id === activeBail.id && p.statut !== PAIEMENT_STATUS.ANNULE)
      .sort((a, b) => new Date(b.date_paiement) - new Date(a.date_paiement));
  }, [paiements, activeBail]);

  const latePaiementsCount = useMemo(
    () => bailPaiements.filter((p) => p.echeance?.date_echeance && new Date(p.date_paiement) > new Date(p.echeance.date_echeance))
      .length,
    [bailPaiements]
  );

  function isLatePaiement(p) {
    return p.echeance?.date_echeance && new Date(p.date_paiement) > new Date(p.echeance.date_echeance);
  }

  function bienLotLabel(bail) {
    if (!bail) return "—";
    const b = biens.find((x) => x.id === bail.lot?.bien_id);
    const bienName = b?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
  }

  // Le locataire ne peut contacter que le propriétaire de son logement (voir
  // _is_legitimate_contact côté backend) — on dérive son identité des messages
  // déjà échangés, sinon un libellé générique tant qu'aucun message n'existe.
  const proprietaire = useMemo(() => {
    if (!bien) return null;
    const id = bien.proprietaire_id;
    const known = messages.find((m) => m.user?.id === id || m.destinataire?.id === id);
    const info = known ? (known.user?.id === id ? known.user : known.destinataire) : null;
    return { id, nom: info?.nom || "", prenom: info?.prenom || "Propriétaire", photo: info?.photo || null };
  }, [bien, messages]);

  async function handleDownloadQuittance(quittanceId) {
    setDownloadingId(quittanceId);
    try {
      await downloadQuittance(quittanceId);
    } catch {
      // Best-effort : un échec de téléchargement ne doit pas casser le dashboard.
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !stats) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  const paidCount = bailEcheances.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).length;
  const recentQuittances = quittances
    .slice()
    .sort((a, b) => new Date(b.date_generation) - new Date(a.date_generation))
    .slice(0, 3);
  const recentPaiements = bailPaiements.slice(0, 4);

  return (
    <div>
      {/* ---- Header ---- */}
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardGreeting}>Bonjour {user?.prenom || ""}, voici le résumé de votre location</h2>
        </div>
        <span className={styles.dashboardDate}>
          <i className="bi bi-calendar3" />
          {today}
        </span>
      </div>

      {!activeBail ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <i className="bi bi-house-slash" />
            <p>Aucun bail actif pour le moment.</p>
          </div>
        </div>
      ) : (
        <>
          {/* ---- Bannière prochaine échéance ---- */}
          <div className={styles.heroBanner}>
            <div>
              <div className={styles.heroBannerLabel}>Prochaine échéance</div>
              <div className={styles.heroBannerValue}>
                {stats.prochaine_echeance_montant != null ? formatCurrency(stats.prochaine_echeance_montant) : "Aucune"}
              </div>
              {stats.prochaine_echeance_date && (
                <div className={styles.heroBannerSub}>
                  À régler avant le {formatDate(stats.prochaine_echeance_date)} — {bienLotLabel(activeBail)}
                </div>
              )}
            </div>
            <Link href="/backoffice/locataire/echeances" className={styles.heroBannerBtn}>
              <i className="bi bi-list-check" />
              Voir mes échéances
            </Link>
          </div>

          {/* ---- Stats ---- */}
          <div className={styles.miniStatsGrid}>
            <Link href="/backoffice/locataire/bail" className={`${styles.miniStatCard} ${styles.miniStatOlive}`}>
              <div className={styles.miniStatTop}>
                <span className={styles.miniStatLabel}>Loyer mensuel</span>
                <span className={styles.miniStatIcon}>
                  <i className="bi bi-cash-stack" />
                </span>
              </div>
              <div className={styles.miniStatValue}>{formatCurrency(activeBail.loyer)}</div>
              <div className={styles.miniStatSub}>{activeBail.charges ? "Charges incluses" : "Hors charges"}</div>
            </Link>

            <Link href="/backoffice/locataire/paiements" className={`${styles.miniStatCard} ${styles.miniStatNavy}`}>
              <div className={styles.miniStatTop}>
                <span className={styles.miniStatLabel}>Paiements à jour</span>
                <span className={styles.miniStatIcon}>
                  <i className="bi bi-check-lg" />
                </span>
              </div>
              <div className={styles.miniStatValue}>
                {paidCount} / {bailEcheances.length}
              </div>
              <div className={styles.miniStatSub}>
                {latePaiementsCount === 0 ? "Historique sans incident" : `${latePaiementsCount} paiement(s) en retard`}
              </div>
            </Link>

            <Link href="/backoffice/locataire/bail" className={`${styles.miniStatCard} ${styles.miniStatGold}`}>
              <div className={styles.miniStatTop}>
                <span className={styles.miniStatLabel}>Fin du bail</span>
                <span className={styles.miniStatIcon}>
                  <i className="bi bi-calendar-check" />
                </span>
              </div>
              <div className={styles.miniStatValue}>{formatDateShort(activeBail.date_fin)}</div>
              <div className={styles.miniStatSub}>
                <span className={`${styles.badge} ${badgeClass(activeBail.statut)}`}>{BAIL_STATUS_LABELS[activeBail.statut]}</span>
              </div>
            </Link>
          </div>

          {/* ---- Historique + Mon logement ---- */}
          <div className={styles.heroGrid}>
            <div className={styles.card}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                  <i className="bi bi-receipt" style={{ color: "var(--primary)" }} />
                  Historique des paiements
                </h3>
                <Link href="/backoffice/locataire/paiements" className={styles.viewAllLink}>
                  Voir tout
                </Link>
              </div>
              {recentPaiements.length === 0 ? (
                <p className={styles.empty}>Aucun paiement enregistré pour le moment.</p>
              ) : (
                <div className={styles.tableWrap} style={{ boxShadow: "none", border: "none" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Période</th>
                        <th>Montant</th>
                        <th>Date de paiement</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPaiements.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.echeance?.date_echeance)}</td>
                          <td>{formatCurrency(p.montant)}</td>
                          <td>{formatDate(p.date_paiement)}</td>
                          <td>
                            <span className={`${styles.badge} ${isLatePaiement(p) ? styles.badgeWarning : styles.badgeActive}`}>
                              {isLatePaiement(p) ? "Payé en retard" : "Payé"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>
                <i className="bi bi-house-door-fill" style={{ color: "var(--primary)" }} />
                Mon logement
              </h3>
              <div className={styles.detailLine}>
                <strong>Bien :</strong> {bien?.designation || `Bien #${activeBail.lot?.bien_id}`}
              </div>
              <div className={styles.detailLine}>
                <strong>Lot :</strong> {activeBail.lot?.reference || `Lot #${activeBail.lot_id}`}
              </div>
              {category && (
                <div className={styles.detailLine}>
                  <strong>Type :</strong> {category.libelle}
                </div>
              )}
              <div className={styles.detailLine}>
                <strong>Début du bail :</strong> {formatDate(activeBail.date_debut)}
              </div>

              <h3 className={styles.cardTitle} style={{ marginTop: "1.3rem", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                Mon propriétaire
              </h3>
              {proprietaire && (
                <div className={styles.contactCard}>
                  {proprietaire.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE_URL}${proprietaire.photo}`}
                      alt=""
                      className={styles.avatar}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <span className={styles.avatar}>{`${proprietaire.prenom?.[0] || ""}${proprietaire.nom?.[0] || ""}`.toUpperCase() || "?"}</span>
                  )}
                  <div className={styles.contactCardBody}>
                    <div className={styles.contactCardName}>
                      {proprietaire.prenom} {proprietaire.nom}
                    </div>
                    <div className={styles.contactCardRole}>Propriétaire</div>
                  </div>
                  <Link href="/backoffice/locataire/discussions" className={styles.contactCardBtn} title="Contacter">
                    <i className="bi bi-chat-dots" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ---- Mes quittances ---- */}
          <div className={styles.section} style={{ marginBottom: 0 }}>
            <div className={styles.card}>
              <div className={styles.sectionHeaderRow}>
                <h3 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                  <i className="bi bi-file-earmark-pdf-fill" style={{ color: "var(--primary)" }} />
                  Mes quittances
                </h3>
                <Link href="/backoffice/locataire/paiements" className={styles.viewAllLink}>
                  Voir tout
                </Link>
              </div>
              {recentQuittances.length === 0 ? (
                <p className={styles.empty}>Aucune quittance pour le moment.</p>
              ) : (
                recentQuittances.map((q) => (
                  <div className={styles.dashQuittanceRow} key={q.id}>
                    <span className={styles.dashQuittanceIcon}>
                      <i className="bi bi-file-earmark-pdf" />
                    </span>
                    <div className={styles.dashQuittanceBody}>
                      <div className={styles.dashQuittanceTitle}>
                        Quittance — {formatDate(q.paiement?.date_paiement || q.date_generation)}
                      </div>
                      <div className={styles.dashQuittanceMeta}>Générée le {formatDate(q.date_generation)}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.viewAllLink}
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => handleDownloadQuittance(q.id)}
                      disabled={downloadingId === q.id}
                    >
                      {downloadingId === q.id ? "..." : "Télécharger"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
