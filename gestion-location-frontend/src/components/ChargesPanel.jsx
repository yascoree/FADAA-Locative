"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchCharges, createCharge, deleteCharge } from "@/lib/charges";
import { fetchLots } from "@/lib/properties";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const EMPTY_DRAFT = { bien_id: "", lot_id: "", libelle: "", montant: "", date_charge: "", description: "" };

/** Panneau de gestion des charges (dépenses ponctuelles rattachées à un bien ou
    un lot, déduites du revenu — voir stats_service côté backend). Volontairement
    séparé de la gestion des biens/lots (voir ChargesSection, lecture seule sur
    ces fiches) : toute création/suppression de charge passe par ici.

    `biens` : tous les biens visibles par l'utilisateur (sert à afficher le nom du
    bien/lot de chaque charge). `creatableBiens` : sous-ensemble sur lequel il peut
    créer une charge (par défaut = `biens`, ex: côté agence, filtré côté appelant
    sur la permission MANAGE_CHARGE) — si vide, le bouton "+ Nouvelle charge" est
    masqué. */
export default function ChargesPanel({ biens, creatableBiens, styles }) {
  const creatable = creatableBiens ?? biens;
  const [charges, setCharges] = useState([]);
  const [lots, setLots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const [chargesList, lotsList] = await Promise.all([fetchCharges(), fetchLots()]);
        if (active) {
          setCharges(chargesList);
          setLots(lotsList);
        }
      } catch (err) {
        if (active) setLoadError(extractErrorMessage(err));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const biensById = useMemo(() => Object.fromEntries(biens.map((b) => [b.id, b])), [biens]);
  const lotsById = useMemo(() => Object.fromEntries(lots.map((l) => [l.id, l])), [lots]);

  function targetLabel(charge) {
    if (charge.lot_id) {
      const lot = lotsById[charge.lot_id];
      const bien = lot ? biensById[lot.bien_id] : null;
      return lot ? `${bien?.designation || "—"} · ${lot.reference}` : `Lot #${charge.lot_id}`;
    }
    const bien = biensById[charge.bien_id];
    return bien?.designation || `Bien #${charge.bien_id}`;
  }

  const total = charges.reduce((sum, c) => sum + Number(c.montant || 0), 0);
  const lotsForSelectedBien = draft.bien_id ? lots.filter((l) => l.bien_id === Number(draft.bien_id)) : [];

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, bien_id: creatable[0] ? String(creatable[0].id) : "" });
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createCharge({
        bienId: draft.lot_id ? null : Number(draft.bien_id),
        lotId: draft.lot_id ? Number(draft.lot_id) : null,
        libelle: draft.libelle,
        montant: draft.montant,
        dateCharge: draft.date_charge,
        description: draft.description,
      });
      setCharges((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteCharge(deleteTarget.id);
      setCharges((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className={styles.section}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-wallet2" /> Charges
          </h2>
          <p className={styles.sectionSubtitle}>
            {charges.length} charge(s) enregistrée(s) · {formatCurrency(total)} au total
          </p>
        </div>
        {creatable.length > 0 && (
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" /> Nouvelle charge
          </button>
        )}
      </div>

      {loadError && (
        <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>
      )}

      {charges.length === 0 ? (
        <p className={styles.empty}>Aucune charge enregistrée.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Bien / lot</th>
              <th>Date</th>
              <th>Montant</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id}>
                <td>{c.libelle}</td>
                <td>{targetLabel(c)}</td>
                <td>{formatDate(c.date_charge)}</td>
                <td>{formatCurrency(c.montant)}</td>
                <td>
                  <button
                    type="button"
                    className={styles.iconBtnDanger}
                    onClick={() => setDeleteTarget(c)}
                    title="Supprimer cette charge"
                  >
                    <i className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal isOpen={createOpen} onClose={closeCreate} title="Nouvelle charge">
        <form onSubmit={handleCreate}>
          {createError && <div className={`${styles.banner} ${styles.bannerError}`}>{createError}</div>}
          <SelectField
            label="Bien"
            name="bien_id"
            value={draft.bien_id}
            onChange={(e) => setDraft((d) => ({ ...d, bien_id: e.target.value, lot_id: "" }))}
            options={creatable.map((b) => ({ value: String(b.id), label: b.designation }))}
            required
          />
          <SelectField
            label="Lot"
            name="lot_id"
            value={draft.lot_id}
            onChange={(e) => setDraft((d) => ({ ...d, lot_id: e.target.value }))}
            options={[
              { value: "", label: "Bien entier (pas de lot)" },
              ...lotsForSelectedBien.map((l) => ({ value: String(l.id), label: l.reference })),
            ]}
            hint="Optionnel — précisez un lot si la charge ne concerne qu'une partie du bien."
          />
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
          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-check-lg" />
              {createBusy ? "Enregistrement..." : "Ajouter"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la charge"
        message={deleteTarget ? `Supprimer « ${deleteTarget.libelle} » ? Cette action est irréversible.` : ""}
        confirmLabel="Supprimer"
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
