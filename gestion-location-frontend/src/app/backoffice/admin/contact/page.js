"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchDemandesDemo, updateDemandeDemoStatut, DEMANDE_DEMO_STATUS } from "@/lib/demandesDemo";
import { fetchContactMessages, updateContactMessageStatut, CONTACT_MESSAGE_STATUS } from "@/lib/contactMessages";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import FilterSelect from "@/components/FilterSelect";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../admin.module.css";

// Le formulaire de contact public stocke le sujet choisi tel quel (texte
// affiché dans le <select>, pas un code stable — voir ContactContent.jsx),
// dans la langue du visiteur au moment de l'envoi. Cette table associe chaque
// variante connue (fr/en/ar) à une clé de sujet stable, utilisée pour trier/
// filtrer et pour l'icône + la couleur affichées, indépendamment de la langue
// d'origine du message. Le modèle DemandeDemo dédié (table/endpoint séparés,
// legacyDemo: true) reste lu en parallèle pour les demandes plus anciennes
// envoyées avant que ce formulaire ne soit unifié — sans champ sujet, donc
// toujours classées "demo".
const SUBJECT_VARIANTS = {
  info: ["demande d'information", "information request", "طلب معلومات"],
  demo: ["demande de démo", "demo request", "طلب عرض توضيحي"],
  support: ["support / assistance", "الدعم / المساعدة"],
  partnership: ["partenariat", "partnership", "شراكة"],
  press: ["presse", "press", "صحافة"],
  other: ["autre", "other", "أخرى"],
};
const SUBJECT_LOOKUP = new Map();
Object.entries(SUBJECT_VARIANTS).forEach(([key, variants]) => {
  variants.forEach((v) => SUBJECT_LOOKUP.set(v, key));
});

function subjectKeyOf(sujet) {
  if (!sujet) return "demo";
  return SUBJECT_LOOKUP.get(sujet.trim().toLowerCase()) || "other";
}

function buildSubjectMeta(t) {
  return {
    info: { label: t("bo.adminContact.subjectInfo"), icon: "bi-info-circle", tone: "Navy" },
    demo: { label: t("bo.adminContact.subjectDemo"), icon: "bi-calendar2-check", tone: "Olive" },
    support: { label: t("bo.adminContact.subjectSupport"), icon: "bi-headset", tone: "Charcoal" },
    partnership: { label: t("bo.adminContact.subjectPartnership"), icon: "bi-briefcase", tone: "Terracotta" },
    press: { label: t("bo.adminContact.subjectPress"), icon: "bi-newspaper", tone: "Navy" },
    other: { label: t("bo.adminContact.subjectOther"), icon: "bi-three-dots", tone: "Charcoal" },
  };
}

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

function timeAgo(value, t) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return t("bo.adminContact.timeAgoNow");
  if (minutes < 60) return t("bo.adminContact.timeAgoMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("bo.adminContact.timeAgoHours", { count: hours });
  return t("bo.adminContact.timeAgoDays", { count: Math.floor(hours / 24) });
}

function initialsFromName(fullName) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function statusMetaOf(item, t) {
  if (item.isNew) return { label: t("bo.adminContact.statusNew"), cls: styles.badgeSuspended };
  if (item.inProgress) return { label: t("bo.adminContact.statusInProgress"), cls: styles.badgeWarning };
  return { label: t("bo.adminContact.statusTreated"), cls: styles.badgeActive };
}

export default function AdminContactPage() {
  const { t } = useLanguage();
  const SUBJECT_META = useMemo(() => buildSubjectMeta(t), [t]);

  // Permet un lien direct vers un type précis (ex: depuis une notification
  // "Nouvelle demande de démo" — voir TYPE_TARGET dans notifications/page.js).
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const [demandes, setDemandes] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);

  const [subjectFilter, setSubjectFilter] = useState(() => (typeParam === "demo" ? "demo" : "all"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);

  // Le useState ci-dessus ne lit ?type= qu'au tout premier montage — si on
  // clique une 2e notification pendant que la page est déjà montée, Next.js
  // réutilise l'instance et l'initialisateur ne se redéclenche pas (même
  // piège que sur Messagerie). Ajustement pendant le rendu plutôt que dans un
  // effet.
  const [syncedTypeParam, setSyncedTypeParam] = useState(typeParam);
  if (typeParam !== syncedTypeParam) {
    setSyncedTypeParam(typeParam);
    if (typeParam === "demo") {
      setSubjectFilter("demo");
    }
  }

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

  const unified = useMemo(() => {
    const fromDemandes = demandes.map((d) => ({
      key: `demo-${d.id}`,
      rawId: d.id,
      legacyDemo: true,
      subjectKey: "demo",
      name: d.nom,
      email: d.email,
      telephone: d.telephone,
      dateSouhaitee: d.date_souhaitee,
      message: d.message,
      date_creation: d.date_creation,
      isNew: d.statut === DEMANDE_DEMO_STATUS.NOUVELLE,
      inProgress: d.statut === DEMANDE_DEMO_STATUS.EN_COURS,
    }));
    const fromContact = contactMessages.map((m) => ({
      key: `contact-${m.id}`,
      rawId: m.id,
      legacyDemo: false,
      subjectKey: subjectKeyOf(m.sujet),
      name: `${m.prenom} ${m.nom}`.trim(),
      email: m.email,
      telephone: m.telephone,
      dateSouhaitee: null,
      message: m.message,
      date_creation: m.date_creation,
      isNew: m.statut === CONTACT_MESSAGE_STATUS.NOUVEAU,
      inProgress: m.statut === CONTACT_MESSAGE_STATUS.EN_COURS,
    }));
    return [...fromDemandes, ...fromContact];
  }, [demandes, contactMessages]);

  const stats = useMemo(() => {
    const total = unified.length;
    const nouveaux = unified.filter((i) => i.isNew).length;
    const demoTotal = unified.filter((i) => i.subjectKey === "demo").length;
    const demoNouvelles = unified.filter((i) => i.subjectKey === "demo" && i.isNew).length;
    const traites = unified.filter((i) => !i.isNew && !i.inProgress).length;
    return { total, nouveaux, demoTotal, demoNouvelles, traites };
  }, [unified]);

  const STATUS_FILTERS = useMemo(
    () => [
      { value: "all", label: t("bo.adminContact.filterStatusAll") },
      { value: "new", label: t("bo.adminContact.filterStatusNew") },
      { value: "inProgress", label: t("bo.adminContact.statusInProgress") },
      { value: "done", label: t("bo.adminContact.filterStatusTreated") },
    ],
    [t]
  );

  const SUBJECT_FILTER_OPTIONS = useMemo(
    () => [
      { value: "all", label: t("bo.adminContact.filterAllSubjects") },
      ...Object.entries(SUBJECT_META).map(([key, meta]) => ({ value: key, label: meta.label })),
    ],
    [SUBJECT_META, t]
  );

  const SORT_OPTIONS_LOCAL = useMemo(
    () => [
      { value: "recent", label: t("bo.adminContact.sortRecent") },
      { value: "oldest", label: t("bo.adminContact.sortOldest") },
    ],
    [t]
  );

  const STATUS_VALUE_OPTIONS = useMemo(
    () => [
      { value: "1", label: t("bo.adminContact.statusNew") },
      { value: "3", label: t("bo.adminContact.statusInProgress") },
      { value: "2", label: t("bo.adminContact.statusTreated") },
    ],
    [t]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = unified.filter((item) => {
      if (subjectFilter !== "all" && item.subjectKey !== subjectFilter) return false;
      if (statusFilter === "new" && !item.isNew) return false;
      if (statusFilter === "inProgress" && !item.inProgress) return false;
      if (statusFilter === "done" && (item.isNew || item.inProgress)) return false;
      if (term) {
        const haystack = [item.name, item.email, item.telephone, item.message].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      const diff = new Date(b.date_creation) - new Date(a.date_creation);
      return sortOrder === "recent" ? diff : -diff;
    });
  }, [unified, subjectFilter, statusFilter, search, sortOrder]);

  const selected = unified.find((item) => item.key === selectedKey) || null;

  async function handleStatusChange(item, nextValue) {
    setBanner(null);
    setBusyKey(item.key);
    try {
      if (item.legacyDemo) {
        const updated = await updateDemandeDemoStatut(item.rawId, Number(nextValue));
        setDemandes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const updated = await updateContactMessageStatut(item.rawId, Number(nextValue));
        setContactMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  if (isLoading) {
    return <p>{t("bo.adminContact.loading")}</p>;
  }

  return (
    <div>
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-envelope-paper-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.adminContact.title")}
            </h2>
            <p className={styles.sectionSubtitle}>{t("bo.adminContact.subtitle")}</p>
          </div>
          <button
            type="button"
            className={`${styles.focusDemoBtn} ${subjectFilter === "demo" ? styles.focusDemoBtnActive : ""}`}
            onClick={() => setSubjectFilter((prev) => (prev === "demo" ? "all" : "demo"))}
          >
            <i className="bi bi-bullseye" />
            {t("bo.adminContact.focusDemoToggle")}
          </button>
        </div>

        <Banner banner={banner} />

        <div className={styles.statsGrid} style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
          <StatCard icon="bi-calendar2-check-fill" tone="danger" label={t("bo.adminContact.statDemoPending")} value={<CountUp value={stats.demoNouvelles} />} />
          <StatCard icon="bi-inbox-fill" tone="primary" label={t("bo.adminContact.statTotal")} value={<CountUp value={stats.total} />} />
          <StatCard icon="bi-envelope-exclamation-fill" tone="warning" label={t("bo.adminContact.statNew")} value={<CountUp value={stats.nouveaux} />} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.adminContact.statTreated")} value={<CountUp value={stats.traites} />} />
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.searchInputWrap}>
            <i className={`bi bi-search ${styles.searchIcon}`} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("bo.adminContact.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS} />
          <FilterSelect value={subjectFilter} onChange={setSubjectFilter} options={SUBJECT_FILTER_OPTIONS} />
          <FilterSelect value={sortOrder} onChange={setSortOrder} options={SORT_OPTIONS_LOCAL} />
        </div>

        {filtered.length === 0 && (
          <p className={styles.empty}>
            <i className="bi bi-inbox" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
            {t("bo.adminContact.noMatch")}
          </p>
        )}

        <div className={styles.inboxShell}>
          <div className={styles.inboxList}>
            {filtered.map((item, index) => {
              const meta = SUBJECT_META[item.subjectKey];
              const status = statusMetaOf(item, t);
              return (
                <button
                  type="button"
                  key={item.key}
                  style={{ "--i": index }}
                  className={`${styles.messageCard} ${item.isNew ? styles.messageCardNew : ""} ${
                    selectedKey === item.key ? styles.messageCardSelected : ""
                  }`}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <span className={styles.messageCardAvatar}>{initialsFromName(item.name)}</span>
                  <div className={styles.messageCardBody}>
                    <div className={styles.messageCardTopRow}>
                      <span className={styles.messageCardName}>{item.name}</span>
                      <span className={styles.messageCardDate}>{timeAgo(item.date_creation, t)}</span>
                    </div>
                    <div className={styles.tableSubtext}>
                      <i className="bi bi-envelope" style={{ marginRight: "0.3rem" }} />
                      {item.email}
                    </div>
                    <div className={styles.messageCardSubject}>
                      {item.isNew && <span className={styles.messageCardDot} />}
                      <span className={`${styles.planPill} ${styles[`planPill${meta.tone}`]} ${styles.msgTypeBadgeSm}`}>
                        <i className={`bi ${meta.icon}`} />
                        {meta.label}
                      </span>
                      {item.subjectKey === "demo" && item.dateSouhaitee && (
                        <span className={styles.messageCardDemoDate}>
                          <i className="bi bi-calendar-event" />
                          {formatDate(item.dateSouhaitee)}
                        </span>
                      )}
                    </div>
                    <p className={styles.messageCardSnippet}>{item.message || "—"}</p>
                  </div>
                  <span className={`${styles.badge} ${status.cls}`}>{status.label}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.inboxDetail}>
            {!selected ? (
              <div className={styles.inboxDetailEmpty}>
                <i className="bi bi-chat-square-text" />
                <strong>{t("bo.adminContact.detailEmptyTitle")}</strong>
                <span>{t("bo.adminContact.detailEmptySub")}</span>
              </div>
            ) : (
              (() => {
                const meta = SUBJECT_META[selected.subjectKey];
                const status = statusMetaOf(selected, t);
                return (
                  <>
                    <div className={styles.inboxDetailHeader}>
                      <div className={styles.inboxDetailIdentity}>
                        <span className={styles.detailAvatar}>{initialsFromName(selected.name)}</span>
                        <div>
                          <h3 className={styles.detailTitle}>{selected.name}</h3>
                          <div className={styles.inboxDetailTags}>
                            <span className={`${styles.planPill} ${styles[`planPill${meta.tone}`]} ${styles.msgTypeBadgeSm}`}>
                              <i className={`bi ${meta.icon}`} />
                              {meta.label}
                            </span>
                            <span className={`${styles.badge} ${status.cls}`}>{status.label}</span>
                          </div>
                        </div>
                      </div>
                      <span className={styles.messageCardDate}>{timeAgo(selected.date_creation, t)}</span>
                    </div>

                    <div className={styles.detailInfoList} style={{ marginTop: "1.1rem" }}>
                      <div className={styles.detailInfoRow}>
                        <span className={styles.detailInfoIcon}>
                          <i className="bi bi-envelope" />
                        </span>
                        <span className={styles.detailInfoBody}>
                          <span className={styles.detailInfoLabel}>{t("bo.adminContact.emailLabel")}</span>
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
                            <span className={styles.detailInfoLabel}>{t("bo.adminContact.phoneLabel")}</span>
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
                          <span className={styles.detailInfoLabel}>{t("bo.adminContact.receivedOnLabel")}</span>
                          <span className={styles.detailInfoValue}>{formatDate(selected.date_creation)}</span>
                        </span>
                      </div>
                      {selected.subjectKey === "demo" && (
                        <div className={styles.detailInfoRow}>
                          <span className={styles.detailInfoIcon}>
                            <i className="bi bi-calendar2-check" />
                          </span>
                          <span className={styles.detailInfoBody}>
                            <span className={styles.detailInfoLabel}>{t("bo.adminContact.desiredDateLabel")}</span>
                            <span className={styles.detailInfoValue}>
                              {selected.dateSouhaitee ? formatDate(selected.dateSouhaitee) : t("bo.adminContact.noDesiredDate")}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.detailBlockTitle} style={{ marginTop: "1.4rem" }}>
                      <i className="bi bi-chat-square-text-fill" />
                      {t("bo.adminContact.contactSection")}
                    </div>
                    <div className={styles.messageQuoteCard}>
                      <p className={styles.messageQuoteText}>{selected.message || "—"}</p>
                    </div>

                    <div className={styles.inboxDetailFooter}>
                      <div>
                        <div className={styles.inboxDetailFooterLabel}>{t("bo.adminContact.statusLabel")}</div>
                        <FilterSelect
                          value={String(selected.isNew ? 1 : selected.inProgress ? 3 : 2)}
                          onChange={(v) => handleStatusChange(selected, v)}
                          options={STATUS_VALUE_OPTIONS}
                          disabled={busyKey === selected.key}
                        />
                      </div>
                      <a className={styles.btn} href={`mailto:${selected.email}`}>
                        <i className="bi bi-reply-fill" />
                        {t("bo.adminContact.reply")}
                      </a>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
