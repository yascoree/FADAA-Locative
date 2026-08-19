"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchDemandesDemo,
  updateDemandeDemoStatut,
  DEMANDE_DEMO_STATUS,
  DEMANDE_DEMO_STATUS_LABELS,
} from "@/lib/demandesDemo";
import {
  fetchContactMessages,
  updateContactMessageStatut,
  CONTACT_MESSAGE_STATUS,
  CONTACT_MESSAGE_STATUS_LABELS,
} from "@/lib/contactMessages";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import Drawer from "@/components/Drawer";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function demandeBadgeClass(statut) {
  if (statut === DEMANDE_DEMO_STATUS.CONTACTEE) return styles.badgeActive;
  return styles.badgeSuspended;
}

function contactMessageBadgeClass(statut) {
  if (statut === CONTACT_MESSAGE_STATUS.TRAITE) return styles.badgeActive;
  return styles.badgeSuspended;
}

function contactInitialsOf(m) {
  return `${m.prenom?.[0] || ""}${m.nom?.[0] || ""}`.toUpperCase() || "?";
}

function buildTabs(t) {
  return [
    { key: "demandes", label: t("bo.adminContact.tabDemandes"), icon: "bi-calendar2-check" },
    { key: "contact", label: t("bo.adminContact.tabMessages"), icon: "bi-envelope-paper" },
  ];
}

const buildDemandeFilters = (t) => [
  { value: "all", label: t("bo.adminDemandesDemo.filterAll") },
  { value: DEMANDE_DEMO_STATUS.NOUVELLE, label: t("bo.adminDemandesDemo.filterNew") },
  { value: DEMANDE_DEMO_STATUS.CONTACTEE, label: t("bo.adminDemandesDemo.filterContacted") },
];

const buildContactFilters = (t) => [
  { value: "all", label: t("bo.adminMessagesContact.filterAll") },
  { value: CONTACT_MESSAGE_STATUS.NOUVEAU, label: t("bo.adminMessagesContact.filterNew") },
  { value: CONTACT_MESSAGE_STATUS.TRAITE, label: t("bo.adminMessagesContact.filterTreated") },
];

export default function AdminContactPage() {
  const { t } = useLanguage();
  const TABS = useMemo(() => buildTabs(t), [t]);
  const DEMANDE_FILTERS = useMemo(() => buildDemandeFilters(t), [t]);
  const CONTACT_FILTERS = useMemo(() => buildContactFilters(t), [t]);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "demandes";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "contact" ? tab : "demandes";
  });
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ---- Demandes de démo ----
  const [demandes, setDemandes] = useState([]);
  const [demandeFilter, setDemandeFilter] = useState(DEMANDE_DEMO_STATUS.NOUVELLE);
  const [demandeBanner, setDemandeBanner] = useState(null);
  const [demandeBusyId, setDemandeBusyId] = useState(null);
  const demandeTabRefs = useRef([]);
  const [demandeIndicator, setDemandeIndicator] = useState({ left: 0, width: 0 });

  // ---- Messages de contact ----
  const [contactMessages, setContactMessages] = useState([]);
  const [contactBanner, setContactBanner] = useState(null);
  const [contactBusyId, setContactBusyId] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState(CONTACT_MESSAGE_STATUS.NOUVEAU);
  const [contactSelectedId, setContactSelectedId] = useState(null);
  const contactTabRefs = useRef([]);
  const [contactIndicator, setContactIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [demandesList, contactList] = await Promise.all([fetchDemandesDemo(), fetchContactMessages()]);
        setDemandes(demandesList);
        setContactMessages(contactList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    setTabIndicator({ width: el.offsetWidth, left: el.offsetLeft });
  }, [activeTab, isLoading]);

  const demandeCounts = useMemo(() => {
    const nouvelles = demandes.filter((d) => d.statut === DEMANDE_DEMO_STATUS.NOUVELLE).length;
    return { nouvelles, contactees: demandes.length - nouvelles, total: demandes.length };
  }, [demandes]);

  const filteredDemandes = useMemo(() => {
    if (demandeFilter === "all") return demandes;
    return demandes.filter((d) => d.statut === demandeFilter);
  }, [demandes, demandeFilter]);

  useEffect(() => {
    const activeIndex = DEMANDE_FILTERS.findIndex((f) => f.value === demandeFilter);
    const el = demandeTabRefs.current[activeIndex];
    if (el) {
      setDemandeIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [demandeFilter, demandeCounts.nouvelles, DEMANDE_FILTERS, isLoading, activeTab]);

  async function handleMarkContactee(demande) {
    setDemandeBanner(null);
    setDemandeBusyId(demande.id);
    try {
      const updated = await updateDemandeDemoStatut(demande.id, DEMANDE_DEMO_STATUS.CONTACTEE);
      setDemandes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setDemandeBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setDemandeBusyId(null);
    }
  }

  const contactStats = useMemo(
    () => ({
      total: contactMessages.length,
      nouveaux: contactMessages.filter((m) => m.statut === CONTACT_MESSAGE_STATUS.NOUVEAU).length,
      traites: contactMessages.filter((m) => m.statut === CONTACT_MESSAGE_STATUS.TRAITE).length,
    }),
    [contactMessages]
  );

  const filteredContactMessages = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    return contactMessages.filter((m) => {
      if (term) {
        const haystack = [m.prenom, m.nom, m.email, m.telephone, m.sujet, m.message]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (contactStatusFilter !== "all" && m.statut !== contactStatusFilter) return false;
      return true;
    });
  }, [contactMessages, contactSearch, contactStatusFilter]);

  useEffect(() => {
    const activeIndex = CONTACT_FILTERS.findIndex((f) => f.value === contactStatusFilter);
    const el = contactTabRefs.current[activeIndex];
    if (el) {
      setContactIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [contactStatusFilter, contactStats.nouveaux, CONTACT_FILTERS, isLoading, activeTab]);

  const contactSelected = contactMessages.find((m) => m.id === contactSelectedId) || null;

  async function handleMarkContactTraite(message) {
    setContactBanner(null);
    setContactBusyId(message.id);
    try {
      const updated = await updateContactMessageStatut(message.id, CONTACT_MESSAGE_STATUS.TRAITE);
      setContactMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setContactBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setContactBusyId(null);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-envelope-paper-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.adminContact.title")}
        </h2>
        <p className={styles.sectionSubtitle}>{t("bo.adminContact.subtitle")}</p>

        <div className={styles.archTabs}>
          {tabIndicator && (
            <span
              className={styles.archTabBubble}
              style={{ width: `${tabIndicator.width}px`, transform: `translateX(${tabIndicator.left}px)` }}
            />
          )}
          {TABS.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              className={`${styles.archTab} ${activeTab === tab.key ? styles.archTabActive : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`bi ${tab.icon}`} />
              {tab.label}
              {tab.key === "demandes" && demandeCounts.nouvelles > 0 && (
                <span className={styles.archTabBadge}>{demandeCounts.nouvelles}</span>
              )}
              {tab.key === "contact" && contactStats.nouveaux > 0 && (
                <span className={styles.archTabBadge}>{contactStats.nouveaux}</span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== Demandes de démo ==================== */}
        {activeTab === "demandes" && (
          <div>
            <Banner banner={demandeBanner} />

            <div className={styles.requestFilterTabs} role="tablist" aria-label={t("bo.adminDemandesDemo.filterAriaLabel")}>
              <span
                className={styles.requestFilterIndicator}
                style={{ transform: `translateX(${demandeIndicator.left}px)`, width: demandeIndicator.width }}
                aria-hidden="true"
              />
              {DEMANDE_FILTERS.map((f, i) => (
                <button
                  key={f.value}
                  ref={(el) => {
                    demandeTabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={demandeFilter === f.value}
                  className={`${styles.requestFilterTab} ${demandeFilter === f.value ? styles.requestFilterTabActive : ""}`}
                  onClick={() => setDemandeFilter(f.value)}
                >
                  {f.label}
                  {f.value === DEMANDE_DEMO_STATUS.NOUVELLE && demandeCounts.nouvelles > 0 && (
                    <span className={styles.requestFilterTabBadge}>{demandeCounts.nouvelles}</span>
                  )}
                </button>
              ))}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("bo.adminDemandesDemo.colName")}</th>
                    <th>{t("bo.adminDemandesDemo.colContact")}</th>
                    <th>{t("bo.adminDemandesDemo.colDesiredDate")}</th>
                    <th>{t("bo.adminDemandesDemo.colMessage")}</th>
                    <th>{t("bo.adminDemandesDemo.colReceivedOn")}</th>
                    <th>{t("bo.adminDemandesDemo.colStatus")}</th>
                    <th>{t("bo.adminDemandesDemo.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDemandes.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.empty}>
                        {t("bo.adminDemandesDemo.noRequests")}
                      </td>
                    </tr>
                  )}
                  {filteredDemandes.map((d) => {
                    const busy = demandeBusyId === d.id;
                    return (
                      <tr key={d.id}>
                        <td>
                          <span className={styles.userName}>{d.nom}</span>
                        </td>
                        <td>
                          <div>{d.email}</div>
                          <div className={styles.tableSubtext}>{d.telephone}</div>
                        </td>
                        <td>{d.date_souhaitee ? formatDate(d.date_souhaitee) : "—"}</td>
                        <td style={{ maxWidth: 280 }}>{d.message || "—"}</td>
                        <td>{formatDate(d.date_creation)}</td>
                        <td>
                          <span className={`${styles.badge} ${demandeBadgeClass(d.statut)}`}>
                            {DEMANDE_DEMO_STATUS_LABELS[d.statut]}
                          </span>
                        </td>
                        <td>
                          {d.statut !== DEMANDE_DEMO_STATUS.CONTACTEE && (
                            <div className={styles.tableActions}>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => handleMarkContactee(d)}
                                disabled={busy}
                                title={t("bo.adminDemandesDemo.markContacted")}
                              >
                                <i className="bi bi-check-lg" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== Messages de contact ==================== */}
        {activeTab === "contact" && (
          <div>
            <Banner banner={contactBanner} />

            <div className={styles.statsGrid} style={{ marginTop: "0.25rem", marginBottom: "1.5rem" }}>
              <StatCard
                icon="bi-inbox-fill"
                tone="primary"
                label={t("bo.adminMessagesContact.statReceived")}
                value={<CountUp value={contactStats.total} />}
              />
              <StatCard
                icon="bi-envelope-exclamation-fill"
                tone="warning"
                label={t("bo.adminMessagesContact.statNew")}
                value={<CountUp value={contactStats.nouveaux} />}
              />
              <StatCard
                icon="bi-check-circle-fill"
                tone="accent"
                label={t("bo.adminMessagesContact.statTreated")}
                value={<CountUp value={contactStats.traites} />}
              />
            </div>

            <div className={styles.filtersRow}>
              <div className={styles.searchInputWrap}>
                <i className={`bi bi-search ${styles.searchIcon}`} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={t("bo.adminMessagesContact.searchPlaceholder")}
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
              </div>
            </div>

            <div
              className={styles.requestFilterTabs}
              role="tablist"
              aria-label={t("bo.adminMessagesContact.filterAriaLabel")}
            >
              <span
                className={styles.requestFilterIndicator}
                style={{ transform: `translateX(${contactIndicator.left}px)`, width: contactIndicator.width }}
                aria-hidden="true"
              />
              {CONTACT_FILTERS.map((f, i) => (
                <button
                  key={f.value}
                  ref={(el) => {
                    contactTabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={contactStatusFilter === f.value}
                  className={`${styles.requestFilterTab} ${contactStatusFilter === f.value ? styles.requestFilterTabActive : ""}`}
                  onClick={() => setContactStatusFilter(f.value)}
                >
                  {f.label}
                  {f.value === CONTACT_MESSAGE_STATUS.NOUVEAU && contactStats.nouveaux > 0 && (
                    <span className={styles.requestFilterTabBadge}>{contactStats.nouveaux}</span>
                  )}
                </button>
              ))}
            </div>

            {filteredContactMessages.length === 0 && (
              <p className={styles.empty}>
                <i className="bi bi-inbox" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
                {t("bo.adminMessagesContact.noMatch")}
              </p>
            )}

            <div className={styles.messageInboxList}>
              {filteredContactMessages.map((m, index) => {
                const isNew = m.statut === CONTACT_MESSAGE_STATUS.NOUVEAU;
                return (
                  <button
                    type="button"
                    key={m.id}
                    style={{ "--i": index }}
                    className={`${styles.messageCard} ${isNew ? styles.messageCardNew : ""} ${
                      contactSelectedId === m.id ? styles.messageCardSelected : ""
                    }`}
                    onClick={() => setContactSelectedId(m.id)}
                  >
                    <span className={styles.messageCardAvatar}>{contactInitialsOf(m)}</span>
                    <div className={styles.messageCardBody}>
                      <div className={styles.messageCardTopRow}>
                        <span className={styles.messageCardName}>
                          {m.prenom} {m.nom}
                        </span>
                        <span className={styles.messageCardDate}>{formatDate(m.date_creation)}</span>
                      </div>
                      <div className={styles.tableSubtext}>
                        <i className="bi bi-envelope" style={{ marginRight: "0.3rem" }} />
                        {m.email}
                      </div>
                      <div className={styles.messageCardSubject}>
                        {isNew && <span className={styles.messageCardDot} />}
                        {m.sujet}
                      </div>
                      <p className={styles.messageCardSnippet}>{m.message}</p>
                    </div>
                    <span className={`${styles.badge} ${contactMessageBadgeClass(m.statut)}`}>
                      {CONTACT_MESSAGE_STATUS_LABELS[m.statut]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {contactSelected && (
        <Drawer
          isOpen={!!contactSelected}
          onClose={() => setContactSelectedId(null)}
          title={
            <div className={styles.detailHeaderRow}>
              <div className={styles.detailHeaderIdentity}>
                <span className={styles.detailAvatar}>{contactInitialsOf(contactSelected)}</span>
                <div>
                  <h3 className={styles.detailTitle}>
                    {contactSelected.prenom} {contactSelected.nom}
                  </h3>
                  <div className={styles.detailHeaderTags}>
                    <span className={`${styles.badge} ${contactMessageBadgeClass(contactSelected.statut)}`}>
                      {CONTACT_MESSAGE_STATUS_LABELS[contactSelected.statut]}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.detailHeaderActions}>
                {contactSelected.statut !== CONTACT_MESSAGE_STATUS.TRAITE && (
                  <button
                    type="button"
                    className={styles.detailHeaderActionBtn}
                    onClick={() => handleMarkContactTraite(contactSelected)}
                    disabled={contactBusyId === contactSelected.id}
                  >
                    <i className="bi bi-check-lg" />
                    {contactBusyId === contactSelected.id
                      ? t("bo.adminMessagesContact.markingTreated")
                      : t("bo.adminMessagesContact.markTreated")}
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className={styles.detailBlockTitle}>
            <i className="bi bi-person-fill" />
            {t("bo.adminMessagesContact.contactSection")}
          </div>
          <div className={styles.detailInfoList}>
            <div className={styles.detailInfoRow}>
              <span className={styles.detailInfoIcon}>
                <i className="bi bi-envelope" />
              </span>
              <span className={styles.detailInfoBody}>
                <span className={styles.detailInfoLabel}>{t("bo.adminMessagesContact.emailLabel")}</span>
                <a className={styles.detailInfoValue} href={`mailto:${contactSelected.email}`}>
                  {contactSelected.email}
                </a>
              </span>
            </div>
            {contactSelected.telephone && (
              <div className={styles.detailInfoRow}>
                <span className={styles.detailInfoIcon}>
                  <i className="bi bi-telephone" />
                </span>
                <span className={styles.detailInfoBody}>
                  <span className={styles.detailInfoLabel}>{t("bo.adminMessagesContact.phoneLabel")}</span>
                  <a className={styles.detailInfoValue} href={`tel:${contactSelected.telephone}`}>
                    {contactSelected.telephone}
                  </a>
                </span>
              </div>
            )}
            <div className={styles.detailInfoRow}>
              <span className={styles.detailInfoIcon}>
                <i className="bi bi-calendar-event" />
              </span>
              <span className={styles.detailInfoBody}>
                <span className={styles.detailInfoLabel}>{t("bo.adminMessagesContact.receivedOnLabel")}</span>
                <span className={styles.detailInfoValue}>{formatDate(contactSelected.date_creation)}</span>
              </span>
            </div>
          </div>

          <div className={styles.detailBlockTitle} style={{ marginTop: "1.4rem" }}>
            <i className="bi bi-chat-square-text-fill" />
            {contactSelected.sujet}
          </div>
          <div className={styles.messageQuoteCard}>
            <p className={styles.messageQuoteText}>{contactSelected.message}</p>
          </div>
        </Drawer>
      )}
    </div>
  );
}
