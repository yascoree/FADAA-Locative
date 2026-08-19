"use client";

import { useEffect, useState } from "react";
import { fetchCharges } from "@/lib/charges";
import styles from "./ui.module.css";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Charges (dépenses ponctuelles) rattachées à un bien ou un lot — déduites
    automatiquement du revenu correspondant (voir stats_service.get_revenue_stats
    côté backend). Lecture seule ici : la création/suppression se fait depuis la
    page Paiements (voir ChargesPanel), pas depuis la fiche bien/lot. */
export default function ChargesSection({ bienId, lotId }) {
  const [charges, setCharges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) return null;

  return (
    <div className={styles.bienDetailsSection}>
      <h3 className={styles.bienDetailsSectionTitle}>
        <i className="bi bi-wallet2" />
        Charges {charges.length > 0 && `(${formatCurrency(total)})`}
      </h3>

      {charges.length === 0 && (
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
        </div>
      ))}
    </div>
  );
}
