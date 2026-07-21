"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchMandates, fetchPermissionCatalog, fetchMandatePermissions, groupPermissionCatalog } from "@/lib/mandates";
import {
  fetchCategories,
  fetchBiens,
  createBien,
  fetchLots,
  createLot,
  fetchBaux,
  createBail,
} from "@/lib/properties";
import { lookupLocataireByEmail } from "@/lib/mandates";
import styles from "./agence.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>{banner.message}</div>;
}

export default function AgenceDashboardPage() {
  const [mandates, setMandates] = useState([]);
  const [selectedMandatId, setSelectedMandatId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [granted, setGranted] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [biens, setBiens] = useState([]);
  const [lots, setLots] = useState([]);
  const [baux, setBaux] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedBienId, setSelectedBienId] = useState(null);
  const [selectedLotId, setSelectedLotId] = useState(null);

  // ---- Formulaires de test ----
  const [bienCategorieId, setBienCategorieId] = useState("");
  const [bienDesignation, setBienDesignation] = useState("");
  const [bienBusy, setBienBusy] = useState(false);
  const [bienBanner, setBienBanner] = useState(null);

  const [lotReference, setLotReference] = useState("");
  const [lotLoyer, setLotLoyer] = useState("");
  const [lotBusy, setLotBusy] = useState(false);
  const [lotBanner, setLotBanner] = useState(null);

  const [bailEmail, setBailEmail] = useState("");
  const [bailDateDebut, setBailDateDebut] = useState("");
  const [bailDateFin, setBailDateFin] = useState("");
  const [bailLoyer, setBailLoyer] = useState("");
  const [bailBusy, setBailBusy] = useState(false);
  const [bailBanner, setBailBanner] = useState(null);

  const selectedMandat = mandates.find((m) => m.id === Number(selectedMandatId)) || null;
  const proprietaireId = selectedMandat?.proprietaire_id;

  const biensForProprietaire = useMemo(
    () => biens.filter((b) => b.proprietaire_id === proprietaireId),
    [biens, proprietaireId]
  );
  const lotsForBien = useMemo(
    () => lots.filter((l) => l.bien_id === Number(selectedBienId)),
    [lots, selectedBienId]
  );
  const bauxForLot = useMemo(() => baux.filter((b) => b.lot_id === Number(selectedLotId)), [baux, selectedLotId]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [mandateList, catalog, categoryList, bienList, lotList, bailList] = await Promise.all([
          fetchMandates(),
          fetchPermissionCatalog(),
          fetchCategories(),
          fetchBiens(),
          fetchLots(),
          fetchBaux(),
        ]);
        setMandates(mandateList);
        setGroups(groupPermissionCatalog(catalog));
        setCategories(categoryList);
        setBiens(bienList);
        setLots(lotList);
        setBaux(bailList);
        const firstActive = mandateList.find((m) => m.statut === 1) || mandateList[0];
        if (firstActive) setSelectedMandatId(String(firstActive.id));
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadPermissions() {
      if (!selectedMandatId) return;
      try {
        const grantedList = await fetchMandatePermissions(selectedMandatId);
        setGranted(new Set(grantedList.map((item) => item.permission.code)));
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      }
    }
    loadPermissions();
  }, [selectedMandatId]);

  async function handleCreateBien(e) {
    e.preventDefault();
    setBienBanner(null);
    setBienBusy(true);
    try {
      const bien = await createBien({
        proprietaireId,
        categorieId: Number(bienCategorieId),
        designation: bienDesignation,
      });
      setBienBanner({ type: "success", message: `Bien #${bien.id} créé avec succès.` });
      setBienDesignation("");
      setBiens((prev) => [...prev, bien]);
    } catch (err) {
      setBienBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBienBusy(false);
    }
  }

  async function handleCreateLot(e) {
    e.preventDefault();
    setLotBanner(null);
    setLotBusy(true);
    try {
      const lot = await createLot({
        bienId: Number(selectedBienId),
        reference: lotReference,
        loyerReference: lotLoyer ? Number(lotLoyer) : null,
      });
      setLotBanner({ type: "success", message: `Lot #${lot.id} créé avec succès.` });
      setLotReference("");
      setLotLoyer("");
      setLots((prev) => [...prev, lot]);
    } catch (err) {
      setLotBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setLotBusy(false);
    }
  }

  async function handleCreateBail(e) {
    e.preventDefault();
    setBailBanner(null);
    setBailBusy(true);
    try {
      const locataire = await lookupLocataireByEmail(bailEmail);
      const bail = await createBail({
        lotId: Number(selectedLotId),
        locataireId: locataire.id,
        dateDebut: bailDateDebut,
        dateFin: bailDateFin,
        loyer: bailLoyer ? Number(bailLoyer) : null,
      });
      setBailBanner({ type: "success", message: `Bail #${bail.id} créé pour ${locataire.prenom} ${locataire.nom}.` });
      setBailDateDebut("");
      setBailDateFin("");
      setBailLoyer("");
      setBaux((prev) => [...prev, bail]);
    } catch (err) {
      setBailBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBailBusy(false);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <h1 className="h4">Tester mes accès</h1>
      <p className="text-muted">
        Cet écran attaque directement l&apos;API pour vérifier ce que vos permissions actuelles autorisent vraiment —
        les réponses (succès ou refus) reflètent exactement ce que le propriétaire vous a accordé.
      </p>

      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.selectorCard}>
        <div className={styles.selectorRow}>
          <label htmlFor="mandat-select">
            <strong>Propriétaire géré :</strong>
          </label>
          <select
            id="mandat-select"
            value={selectedMandatId || ""}
            onChange={(e) => {
              setSelectedMandatId(e.target.value);
              setSelectedBienId(null);
              setSelectedLotId(null);
            }}
          >
            {mandates.map((mandat) => (
              <option key={mandat.id} value={mandat.id}>
                {mandat.proprietaire?.prenom} {mandat.proprietaire?.nom} ({mandat.statut === 1 ? "actif" : "révoqué"})
              </option>
            ))}
          </select>
        </div>

        {mandates.length === 0 && <p className={styles.empty}>Aucun propriétaire ne vous a encore accordé de mandat.</p>}

        {selectedMandat && (
          <div className={styles.chipRow}>
            {groups.flatMap((group) =>
              group.permissions.map((permission) => (
                <span
                  key={permission.code}
                  className={`${styles.chip} ${granted.has(permission.code) ? styles.chipGranted : ""}`}
                  title={granted.has(permission.code) ? "Accordé" : "Non accordé"}
                >
                  {permission.libelle}
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {selectedMandat && (
        <div className={styles.panels}>
          {/* ---- Biens ---- */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Biens de {selectedMandat.proprietaire?.prenom}</h2>
            <Banner banner={bienBanner} />
            <form onSubmit={handleCreateBien}>
              <div className={styles.formGroup}>
                <select value={bienCategorieId} onChange={(e) => setBienCategorieId(e.target.value)} required>
                  <option value="">Catégorie...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.libelle}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Désignation (ex: Villa Oasis)"
                  value={bienDesignation}
                  onChange={(e) => setBienDesignation(e.target.value)}
                />
                <button type="submit" className={styles.submitButton} disabled={bienBusy || !bienCategorieId}>
                  {bienBusy ? "Création..." : "+ Créer un bien"}
                </button>
              </div>
            </form>
            <div className={styles.list}>
              {biensForProprietaire.length === 0 && <p className={styles.empty}>Aucun bien visible pour ce propriétaire.</p>}
              {biensForProprietaire.map((bien) => (
                <div
                  key={bien.id}
                  className={`${styles.listItem} ${Number(selectedBienId) === bien.id ? styles.listItemActive : ""}`}
                  onClick={() => {
                    setSelectedBienId(bien.id);
                    setSelectedLotId(null);
                  }}
                >
                  <span className={styles.listItemLabel}>{bien.designation || `Bien #${bien.id}`}</span>
                  <span className={styles.listItemMeta}>#{bien.id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Lots ---- */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Lots {selectedBienId ? `du bien #${selectedBienId}` : ""}</h2>
            {!selectedBienId && <p className={styles.empty}>Sélectionnez un bien à gauche pour gérer ses lots.</p>}
            {selectedBienId && (
              <>
                <Banner banner={lotBanner} />
                <form onSubmit={handleCreateLot}>
                  <div className={styles.formGroup}>
                    <input
                      type="text"
                      placeholder="Référence (ex: Lot 3B)"
                      value={lotReference}
                      onChange={(e) => setLotReference(e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Loyer de référence"
                      value={lotLoyer}
                      onChange={(e) => setLotLoyer(e.target.value)}
                    />
                    <button type="submit" className={styles.submitButton} disabled={lotBusy}>
                      {lotBusy ? "Création..." : "+ Créer un lot"}
                    </button>
                  </div>
                </form>
                <div className={styles.list}>
                  {lotsForBien.length === 0 && <p className={styles.empty}>Aucun lot pour ce bien.</p>}
                  {lotsForBien.map((lot) => (
                    <div
                      key={lot.id}
                      className={`${styles.listItem} ${Number(selectedLotId) === lot.id ? styles.listItemActive : ""}`}
                      onClick={() => setSelectedLotId(lot.id)}
                    >
                      <span className={styles.listItemLabel}>{lot.reference || `Lot #${lot.id}`}</span>
                      <span className={styles.listItemMeta}>#{lot.id}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ---- Baux ---- */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Baux {selectedLotId ? `du lot #${selectedLotId}` : ""}</h2>
            {!selectedLotId && <p className={styles.empty}>Sélectionnez un lot au centre pour gérer ses baux.</p>}
            {selectedLotId && (
              <>
                <Banner banner={bailBanner} />
                <form onSubmit={handleCreateBail}>
                  <div className={styles.formGroup}>
                    <input
                      type="email"
                      placeholder="E-mail du locataire"
                      value={bailEmail}
                      onChange={(e) => setBailEmail(e.target.value)}
                      required
                    />
                    <div className={styles.formRow2}>
                      <input
                        type="date"
                        value={bailDateDebut}
                        onChange={(e) => setBailDateDebut(e.target.value)}
                        title="Date de début"
                      />
                      <input
                        type="date"
                        value={bailDateFin}
                        onChange={(e) => setBailDateFin(e.target.value)}
                        title="Date de fin"
                      />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Loyer"
                      value={bailLoyer}
                      onChange={(e) => setBailLoyer(e.target.value)}
                    />
                    <button type="submit" className={styles.submitButton} disabled={bailBusy}>
                      {bailBusy ? "Création..." : "+ Créer un bail"}
                    </button>
                  </div>
                </form>
                <div className={styles.list}>
                  {bauxForLot.length === 0 && <p className={styles.empty}>Aucun bail pour ce lot.</p>}
                  {bauxForLot.map((bail) => (
                    <div className={styles.listItem} key={bail.id}>
                      <span className={styles.listItemLabel}>Bail #{bail.id}</span>
                      <span className={styles.listItemMeta}>locataire #{bail.locataire_id}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
