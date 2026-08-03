"use client";

import { useState, useEffect, useMemo } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchContactMessages,
  updateContactMessageStatut,
  CONTACT_MESSAGE_STATUS,
  CONTACT_MESSAGE_STATUS_LABELS,
} from "@/lib/contactMessages";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import Drawer from "@/components/Drawer";
import FilterSelect from "@/components/FilterSelect";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function messageBadgeClass(statut) {
  if (statut === CONTACT_MESSAGE_STATUS.TRAITE) return styles.badgeActive;
  return styles.badgeSuspended;
}

function initialsOf(m) {
  return `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`.toUpperCase() || "?";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AdminMessagesContactPage() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchContactMessages();
        setMessages(data);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  async function handleMarkTraite(message) {
    setBanner(null);
    setBusyId(message.id);
    try {
      const updated = await updateContactMessageStatut(message.id, CONTACT_MESSAGE_STATUS.TRAITE);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(
    () => ({
      total: messages.length,
      nouveaux: messages.filter((m) => m.statut === CONTACT_MESSAGE_STATUS.NOUVEAU).length,
      traites: messages.filter((m) => m.statut === CONTACT_MESSAGE_STATUS.TRAITE).length,
    }),
    [messages]
  );

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (term) {
        const haystack = [m.prenom, m.nom, m.email, m.telephone, m.sujet, m.message]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter && String(m.statut) !== statusFilter) return false;
      return true;
    });
  }, [messages, search, statusFilter]);

  const selected = messages.find((m) => m.id === selectedId) || null;

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-envelope-paper" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Messages de contact
        </h2>
        <p className={styles.sectionSubtitle}>
          Messages soumis depuis le formulaire de contact public. Répondez par e-mail ou téléphone puis marquez le
          message comme traité.
        </p>

        <div className={styles.statsGrid} style={{ marginTop: "1.25rem", marginBottom: "1.5rem" }}>
          <StatCard icon="bi-inbox-fill" tone="primary" label="Messages reçus" value={<CountUp value={stats.total} />} />
          <StatCard
            icon="bi-envelope-exclamation-fill"
            tone="warning"
            label="Nouveaux"
            value={<CountUp value={stats.nouveaux} />}
          />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Traités" value={<CountUp value={stats.traites} />} />
        </div>

        <Banner banner={banner} />

        <div className={styles.filtersRow}>
          <div className={styles.searchInputWrap}>
            <i className={`bi bi-search ${styles.searchIcon}`} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Rechercher par nom, e-mail, sujet, message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "Tous les statuts" },
              ...Object.entries(CONTACT_MESSAGE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        {filteredMessages.length === 0 && (
          <p className={styles.empty}>
            <i className="bi bi-inbox" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
            Aucun message ne correspond à ces critères.
          </p>
        )}

        <div className={styles.messageInboxList}>
          {filteredMessages.map((m, index) => {
            const isNew = m.statut === CONTACT_MESSAGE_STATUS.NOUVEAU;
            return (
              <button
                type="button"
                key={m.id}
                style={{ "--i": index }}
                className={`${styles.messageCard} ${isNew ? styles.messageCardNew : ""} ${
                  selectedId === m.id ? styles.messageCardSelected : ""
                }`}
                onClick={() => setSelectedId(m.id)}
              >
                <span className={styles.messageCardAvatar}>{initialsOf(m)}</span>
                <div className={styles.messageCardBody}>
                  <div className={styles.messageCardTopRow}>
                    <span className={styles.messageCardName}>
                      {m.prenom} {m.nom}
                    </span>
                    <span className={styles.messageCardDate}>{formatDate(m.date_creation)}</span>
                  </div>
                  <div className={styles.messageCardSubject}>
                    {isNew && <span className={styles.messageCardDot} />}
                    {m.sujet}
                  </div>
                  <p className={styles.messageCardSnippet}>{m.message}</p>
                </div>
                <span className={`${styles.badge} ${messageBadgeClass(m.statut)}`}>
                  {CONTACT_MESSAGE_STATUS_LABELS[m.statut]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <Drawer
          isOpen={!!selected}
          onClose={() => setSelectedId(null)}
          title={
            <div className={styles.detailHeaderRow}>
              <div className={styles.detailHeaderIdentity}>
                <span className={styles.detailAvatar}>{initialsOf(selected)}</span>
                <div>
                  <h3 className={styles.detailTitle}>
                    {selected.prenom} {selected.nom}
                  </h3>
                  <div className={styles.detailHeaderTags}>
                    <span className={`${styles.badge} ${messageBadgeClass(selected.statut)}`}>
                      {CONTACT_MESSAGE_STATUS_LABELS[selected.statut]}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.detailHeaderActions}>
                {selected.statut !== CONTACT_MESSAGE_STATUS.TRAITE && (
                  <button
                    type="button"
                    className={styles.detailHeaderActionBtn}
                    onClick={() => handleMarkTraite(selected)}
                    disabled={busyId === selected.id}
                  >
                    <i className="bi bi-check-lg" />
                    {busyId === selected.id ? "..." : "Marquer traité"}
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className={styles.detailBlockTitle}>
            <i className="bi bi-person-fill" />
            Contact
          </div>
          <div className={styles.detailInfoList}>
            <div className={styles.detailInfoRow}>
              <span className={styles.detailInfoIcon}>
                <i className="bi bi-envelope" />
              </span>
              <span className={styles.detailInfoBody}>
                <span className={styles.detailInfoLabel}>Email</span>
                <a className={styles.detailInfoValue} href={`mailto:${selected.email}`}>
                  {selected.email}
                </a>
              </span>
            </div>
            {selected.telephone && (
              <div className={styles.detailInfoRow}>
                <span className={styles.detailInfoIcon}>
                  <i className="bi bi-telephone" />
                </span>
                <span className={styles.detailInfoBody}>
                  <span className={styles.detailInfoLabel}>Téléphone</span>
                  <a className={styles.detailInfoValue} href={`tel:${selected.telephone}`}>
                    {selected.telephone}
                  </a>
                </span>
              </div>
            )}
            <div className={styles.detailInfoRow}>
              <span className={styles.detailInfoIcon}>
                <i className="bi bi-calendar-event" />
              </span>
              <span className={styles.detailInfoBody}>
                <span className={styles.detailInfoLabel}>Reçu le</span>
                <span className={styles.detailInfoValue}>{formatDate(selected.date_creation)}</span>
              </span>
            </div>
          </div>

          <div className={styles.detailBlockTitle} style={{ marginTop: "1.4rem" }}>
            <i className="bi bi-chat-square-text-fill" />
            {selected.sujet}
          </div>
          <div className={styles.messageQuoteCard}>
            <p className={styles.messageQuoteText}>{selected.message}</p>
          </div>
        </Drawer>
      )}
    </div>
  );
}
