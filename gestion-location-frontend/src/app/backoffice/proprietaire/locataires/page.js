"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { fetchLocataires, createLocataire } from "@/lib/tenants";
import { fetchBiens, fetchBaux, fetchEcheances, fetchPaiements, BAIL_STATUS, BAIL_STATUS_LABELS, ECHEANCE_STATUS } from "@/lib/properties";
import { ACCOUNT_STATUS, ACCOUNT_STATUS_LABELS } from "@/lib/users";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterChip from "@/components/FilterChip";
import styles from "../proprietaire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function accountBadgeClass(statut) {
  if (statut === ACCOUNT_STATUS.ACTIF) return styles.badgeActive;
  if (statut === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return styles.badgeWarning;
  return styles.badgeDanger;
}

function bailBadgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function isOverdue(echeance) {
  if (echeance.statut === ECHEANCE_STATUS.PAYE || !echeance.date_echeance) return false;
  return new Date(echeance.date_echeance) < new Date(new Date().toDateString());
}

const STATUS_OPTIONS = Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_FORM = { prenom: "", nom: "", email: "", mot_de_passe: "", statut_compte: String(ACCOUNT_STATUS.ACTIF) };

export default function ProprietaireLocatairesPage() {
  const searchParams = useSearchParams();
  const [locataires, setLocataires] = useState([]);
  const [baux, setBaux] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formBanner, setFormBanner] = useState(null);

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [locatairesList, bauxList, echeancesList, paiementsList, biensList] = await Promise.all([
          fetchLocataires(),
          fetchBaux(),
          fetchEcheances(),
          fetchPaiements(),
          fetchBiens(),
        ]);
        setLocataires(locatairesList);
        setBaux(bauxList);
        setEcheances(echeancesList);
        setPaiements(paiementsList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function bauxOf(locataireId) {
    return baux.filter((b) => b.locataire_id === locataireId);
  }

  function echeancesOf(locataireId) {
    const bailIds = new Set(bauxOf(locataireId).map((b) => b.id));
    return echeances.filter((e) => bailIds.has(e.bail_id));
  }

  function paiementsOf(locataireId) {
    const bailIds = new Set(bauxOf(locataireId).map((b) => b.id));
    return paiements.filter((p) => bailIds.has(p.echeance?.bail_id));
  }

  function bienLotLabel(bail) {
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
  }

  const locataireHasOverdue = useMemo(() => {
    const map = new Map();
    locataires.forEach((l) => {
      map.set(l.id, echeancesOf(l.id).some(isOverdue));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, baux, echeances]);

  const stats = useMemo(() => {
    const avecBailActif = locataires.filter((l) => bauxOf(l.id).some((b) => b.statut === BAIL_STATUS.ACTIF)).length;
    const enRetard = locataires.filter((l) => locataireHasOverdue.get(l.id)).length;
    const desactives = locataires.filter((l) => l.statut_compte !== ACCOUNT_STATUS.ACTIF).length;
    return { total: locataires.length, avecBailActif, enRetard, desactives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, baux, locataireHasOverdue]);

  const filteredLocataires = useMemo(() => {
    const term = search.trim().toLowerCase();
    return locataires.filter((l) => {
      if (term) {
        const activeBaux = bauxOf(l.id).filter((b) => b.statut === BAIL_STATUS.ACTIF);
        const haystack = [l.prenom, l.nom, l.email, ...activeBaux.map((b) => bienLotLabel(b))]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (overdueOnly && !locataireHasOverdue.get(l.id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, search, overdueOnly, locataireHasOverdue, baux, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredLocataires.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLocataires = filteredLocataires.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = locataires.find((l) => l.id === selectedId) || null;

  function openCreate() {
    setFormDraft(EMPTY_FORM);
    setFormBanner(null);
    setFormOpen(true);
  }

  useEffect(() => {
    function openIfRequested() {
      if (searchParams.get("create") === "1") {
        openCreate();
      }
    }
    openIfRequested();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeForm() {
    if (formBusy) return;
    setFormOpen(false);
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormBusy(true);
    setFormBanner(null);
    try {
      const created = await createLocataire({
        prenom: formDraft.prenom,
        nom: formDraft.nom,
        email: formDraft.email,
        motDePasse: formDraft.mot_de_passe,
        statutCompte: Number(formDraft.statut_compte),
      });
      setLocataires((prev) => [...prev, created]);
      setFormOpen(false);
    } catch (err) {
      setFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setFormBusy(false);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-people-fill" tone="primary" label="Locataires" value={stats.total} />
          <StatCard icon="bi-file-earmark-check-fill" tone="accent" label="Avec bail actif" value={stats.avecBailActif} />
          <StatCard icon="bi-exclamation-octagon-fill" tone="danger" label="En retard de paiement" value={stats.enRetard} />
          <StatCard icon="bi-slash-circle-fill" tone="warning" label="Comptes désactivés" value={stats.desactives} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Mes locataires
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredLocataires.length} locataire(s) affiché(s) sur {locataires.length}.
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            Nouveau locataire
          </button>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par nom, e-mail, bien occupé..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterChip
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setCurrentPage(1);
            }}
          >
            En retard uniquement
          </FilterChip>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Locataire</th>
                <th>Email</th>
                <th>Bien(s) occupé(s)</th>
                <th>Statut du compte</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocataires.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Aucun locataire ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedLocataires.map((l) => {
                const activeBaux = bauxOf(l.id).filter((b) => b.statut === BAIL_STATUS.ACTIF);
                const initials = `${l.prenom?.[0] || ""}${l.nom?.[0] || ""}`.toUpperCase();
                return (
                  <tr key={l.id} className={selectedId === l.id ? styles.tableRowActive : ""}>
                    <td>
                      <div className={styles.userCell}>
                        {l.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE_URL}${l.photo}`}
                            alt=""
                            className={styles.avatarSm}
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className={styles.avatarSm}>{initials || "?"}</span>
                        )}
                        <span className={styles.userName}>
                          {l.prenom} {l.nom}
                        </span>
                        {locataireHasOverdue.get(l.id) && (
                          <span className={styles.badge} style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                            Retard
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{l.email}</td>
                    <td>
                      {activeBaux.length > 0
                        ? activeBaux.map((b) => bienLotLabel(b)).join(", ")
                        : bauxOf(l.id).length > 0
                          ? "Aucun bail actif"
                          : "—"}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${accountBadgeClass(l.statut_compte)}`}>
                        {ACCOUNT_STATUS_LABELS[l.statut_compte]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setSelectedId(selectedId === l.id ? null : l.id)}
                          title="Voir le détail"
                        >
                          <i className="bi bi-eye" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLocataires.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredLocataires.length} locataire(s)
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  Précédent
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  Suivant
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Détail du locataire ---- */}
        {selected && (
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <h3 className={styles.detailTitle}>
                <i className="bi bi-person-vcard-fill" style={{ color: "var(--primary)" }} />
                {selected.prenom} {selected.nom}
              </h3>
              <button type="button" className={styles.btnOutline} onClick={() => setSelectedId(null)}>
                <i className="bi bi-x-lg" />
                Fermer
              </button>
            </div>

            <div className={styles.detailColumns}>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-person-fill" />
                  Coordonnées
                </div>
                <div className={styles.detailLine}>
                  <strong>Email :</strong> {selected.email}
                </div>
                <div className={styles.detailLine}>
                  <strong>Statut du compte :</strong> {ACCOUNT_STATUS_LABELS[selected.statut_compte]}
                </div>
                <div className={styles.detailLine}>
                  <strong>Compte créé le :</strong> {formatDate(selected.date_creation)}
                </div>
              </div>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-cash-stack" />
                  Résumé financier
                </div>
                <div className={styles.detailLine}>
                  <strong>Total payé :</strong>{" "}
                  {formatCurrency(paiementsOf(selected.id).reduce((sum, p) => sum + Number(p.montant || 0), 0))}
                </div>
                <div className={styles.detailLine}>
                  <strong>Échéances en retard :</strong> {echeancesOf(selected.id).filter(isOverdue).length}
                </div>
              </div>
            </div>

            <div className={styles.detailBlockTitle}>
              <i className="bi bi-file-earmark-text-fill" />
              Historique des baux
            </div>
            <div className={styles.tableWrap} style={{ marginTop: "0.5rem" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Bien / Lot</th>
                    <th>Période</th>
                    <th>Loyer</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {bauxOf(selected.id).length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        Aucun bail.
                      </td>
                    </tr>
                  )}
                  {bauxOf(selected.id).map((b) => (
                    <tr key={b.id}>
                      <td>{bienLotLabel(b)}</td>
                      <td>
                        {formatDate(b.date_debut)} → {formatDate(b.date_fin)}
                      </td>
                      <td>{formatCurrency(b.loyer)}</td>
                      <td>
                        <span className={`${styles.badge} ${bailBadgeClass(b.statut)}`}>
                          {BAIL_STATUS_LABELS[b.statut] || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---- Nouveau locataire ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title="Nouveau locataire">
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
            Créez un compte locataire, puis utilisez son e-mail lors de la création d&apos;un bail.
          </p>
          <TextField
            label="Prénom"
            name="prenom"
            value={formDraft.prenom}
            onChange={(e) => setFormDraft((d) => ({ ...d, prenom: e.target.value }))}
            required
          />
          <TextField
            label="Nom"
            name="nom"
            value={formDraft.nom}
            onChange={(e) => setFormDraft((d) => ({ ...d, nom: e.target.value }))}
            required
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={formDraft.email}
            onChange={(e) => setFormDraft((d) => ({ ...d, email: e.target.value }))}
            required
          />
          <TextField
            label="Mot de passe"
            name="mot_de_passe"
            type="password"
            value={formDraft.mot_de_passe}
            onChange={(e) => setFormDraft((d) => ({ ...d, mot_de_passe: e.target.value }))}
            hint="8 caractères minimum"
            minLength={8}
            required
          />
          <SelectField
            label="Statut du compte"
            name="statut_compte"
            options={STATUS_OPTIONS}
            value={formDraft.statut_compte}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut_compte: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={formBusy}>
              <i className="bi bi-check-lg" />
              {formBusy ? "Création..." : "Créer"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeForm} disabled={formBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
