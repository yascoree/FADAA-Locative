"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchCharges, createCharge, deleteCharge } from "@/lib/charges";
import TextField from "@/components/TextField";
import styles from "./ui.module.css";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_DRAFT = { libelle: "", montant: "", date_charge: "", description: "" };

/** Charges (dépenses ponctuelles) rattachées à un bien ou un lot — déduites
    automatiquement du revenu correspondant (voir stats_service.get_revenue_stats
    côté backend). `canManage` gate la création/suppression : seul le propriétaire
    peut ajouter une charge, l'agence ne voit que la liste en lecture seule. */
export default function ChargesSection({ bienId, lotId, canManage = false }) {
  const [charges, setCharges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchCharges({ bienId, lotId });
        if (active) setCharges(data);
      } catch {
        // Best-effort : ne doit jamais bloquer l'affichage du reste de la fiche.
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [bienId, lotId]);

  const total = charges.reduce((sum, c) => sum + Number(c.montant || 0), 0);

  async function handleAdd(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCharge({
        bienId,
        lotId,
        libelle: draft.libelle,
        montant: draft.montant,
        dateCharge: draft.date_charge,
        description: draft.description,
      });
      setCharges((prev) => [created, ...prev]);
      setDraft(EMPTY_DRAFT);
      setFormOpen(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(chargeId) {
    try {
      await deleteCharge(chargeId);
      setCharges((prev) => prev.filter((c) => c.id !== chargeId));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  if (isLoading) return null;

  return (
    <div className={styles.bienDetailsSection}>
      <h3 className={styles.bienDetailsSectionTitle}>
        <i className="bi bi-wallet2" />
        Charges {charges.length > 0 && `(${formatCurrency(total)})`}
      </h3>

      {error && <p className={styles.fieldError}>{error}</p>}

      {charges.length === 0 && !formOpen && (
        <div className={styles.bienGalleryEmpty}>
          <i className="bi bi-wallet2" />
          Aucune charge enregistrée.
        </div>
      )}

      {charges.map((c) => (
        <div key={c.id} className={styles.detailsListRow} style={{ cursor: "default" }}>
          <div className={styles.detailsListRowBody}>
            <div className={styles.detailsListRowTitle}>{c.libelle}</div>
            <div className={styles.detailsListRowSub}>{formatDate(c.date_charge)}</div>
          </div>
          <span>{formatCurrency(c.montant)}</span>
          {canManage && (
            <button
              type="button"
              onClick={() => handleDelete(c.id)}
              title="Supprimer cette charge"
              style={{
                marginLeft: "0.6rem",
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--danger, #d33)",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <>
          {formOpen ? (
            <form onSubmit={handleAdd} style={{ marginTop: "0.8rem" }}>
              <TextField
                label="Libellé"
                name="libelle"
                value={draft.libelle}
                onChange={(e) => setDraft((d) => ({ ...d, libelle: e.target.value }))}
                placeholder="Ex : Réparation plomberie, syndic..."
                required
              />
              <TextField
                label="Montant (MAD)"
                name="montant"
                type="number"
                step="0.01"
                min="0"
                value={draft.montant}
                onChange={(e) => setDraft((d) => ({ ...d, montant: e.target.value }))}
                required
              />
              <TextField
                label="Date"
                name="date_charge"
                type="date"
                value={draft.date_charge}
                onChange={(e) => setDraft((d) => ({ ...d, date_charge: e.target.value }))}
                required
              />
              <TextField
                label="Description"
                name="description"
                as="textarea"
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                hint="Optionnel"
              />
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem" }}>
                <button type="submit" className={styles.btn} disabled={busy}>
                  <i className="bi bi-check-lg" />
                  {busy ? "Enregistrement..." : "Ajouter"}
                </button>
                <button type="button" className={styles.btnOutline} onClick={() => setFormOpen(false)} disabled={busy}>
                  <i className="bi bi-x-lg" />
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className={styles.btnOutline} style={{ marginTop: "0.8rem" }} onClick={() => setFormOpen(true)}>
              <i className="bi bi-plus-lg" />
              Ajouter une charge
            </button>
          )}
        </>
      )}
    </div>
  );
}
