"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchUsers } from "@/lib/subscriptions";
import { fetchDiscussions, sendMessage, deleteDiscussion, uploadDiscussionAttachment } from "@/lib/discussions";
import { fetchNotifications, markNotificationRead, NOTIFICATION_STATUS, NOTIFICATION_TYPE } from "@/lib/notifications";
import {
  fetchReclamations,
  updateReclamationStatut,
  RECLAMATION_STATUS,
  RECLAMATION_STATUS_LABELS,
} from "@/lib/reclamations";
import {
  fetchContactMessages,
  updateContactMessageStatut,
  CONTACT_MESSAGE_STATUS,
  CONTACT_MESSAGE_STATUS_LABELS,
} from "@/lib/contactMessages";
import { ROLES } from "@/lib/roles";
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

function formatTime(value) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function previewText(message, t) {
  if (message.message) return message.message;
  if (message.piece_jointe)
    return message.piece_jointe_type?.startsWith("image/")
      ? t("bo.adminMessagerie.photoPreview")
      : t("bo.adminMessagerie.filePreview");
  return "";
}

function formatDayLabel(value, t) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return t("bo.adminMessagerie.today");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("bo.adminMessagerie.yesterday");
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function reclamationBadgeClass(r) {
  if (r.statut === RECLAMATION_STATUS.ACCEPTEE) return styles.badgeActive;
  if (r.statut === RECLAMATION_STATUS.REJETEE) return styles.badgeExpired;
  return styles.badgeSuspended;
}

function reclamationStatutLabel(r) {
  return RECLAMATION_STATUS_LABELS[r.statut];
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
    { key: "reclamations", label: t("bo.adminMessagerie.tabReclamations"), icon: "bi-inbox" },
    { key: "conversations", label: t("bo.adminMessagerie.tabConversations"), icon: "bi-chat-dots" },
    { key: "contact", label: t("bo.adminMessagerie.tabContact"), icon: "bi-envelope-paper" },
  ];
}

const buildContactFilters = (t) => [
  { value: "all", label: t("bo.adminMessagesContact.filterAll") },
  { value: CONTACT_MESSAGE_STATUS.NOUVEAU, label: t("bo.adminMessagesContact.filterNew") },
  { value: CONTACT_MESSAGE_STATUS.TRAITE, label: t("bo.adminMessagesContact.filterTreated") },
];

export default function AdminMessageriePage() {
  const { t } = useLanguage();
  const TABS = useMemo(() => buildTabs(t), [t]);
  const CONTACT_FILTERS = useMemo(() => buildContactFilters(t), [t]);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "reclamations";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "conversations" || tab === "contact" ? tab : "reclamations";
  });
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState(null);

  const [allProprietaires, setAllProprietaires] = useState([]);
  const [reclamations, setReclamations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [reclamationBanner, setReclamationBanner] = useState(null);
  const [reclamationBusyId, setReclamationBusyId] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState(null);

  const [contactMessages, setContactMessages] = useState([]);
  const [contactBanner, setContactBanner] = useState(null);
  const [contactBusyId, setContactBusyId] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState(CONTACT_MESSAGE_STATUS.NOUVEAU);
  const [contactSelectedId, setContactSelectedId] = useState(null);
  const contactTabRefs = useRef([]);
  const [contactIndicator, setContactIndicator] = useState({ left: 0, width: 0 });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [users, reclamationsList, discussions, contactList] = await Promise.all([
          fetchUsers(),
          fetchReclamations(),
          fetchDiscussions(),
          fetchContactMessages(),
        ]);
        setAllProprietaires(users.filter((u) => u.role === ROLES.PROPRIETAIRE));
        setReclamations(reclamationsList);
        setContactMessages(contactList);
        setMessages(discussions);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    // Ouvrir la messagerie vaut lecture : on marque les notifications de type
    // Discussion comme lues pour que le badge de la sidebar se vide, faute de
    // bouton "marquer comme lu" par message dans ce fil.
    async function markDiscussionsRead() {
      try {
        const notifications = await fetchNotifications();
        const unread = notifications.filter(
          (n) => n.type === NOTIFICATION_TYPE.DISCUSSION && n.statut === NOTIFICATION_STATUS.NON_LUE
        );
        await Promise.all(unread.map((n) => markNotificationRead(n.id)));
      } catch {
        // Best-effort : ne doit jamais bloquer l'affichage des conversations.
      }
    }
    markDiscussionsRead();
  }, []);

  useEffect(() => {
    // Rafraîchit le fil en tâche de fond pour afficher les messages reçus sans
    // avoir à recharger la page (le backend ne pousse pas les nouveaux messages).
    const interval = setInterval(async () => {
      try {
        const discussions = await fetchDiscussions();
        setMessages(discussions);
      } catch {
        // Silencieux : un échec de polling ne doit pas perturber la conversation en cours.
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    setTabIndicator({ width: el.offsetWidth, left: el.offsetLeft });
  }, [activeTab, isLoading]);

  const pendingReclamationsCount = useMemo(
    () => reclamations.filter((r) => r.statut === RECLAMATION_STATUS.EN_ATTENTE).length,
    [reclamations]
  );

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

  // Un propriétaire n'apparaît comme contact chattable qu'après acceptation
  // d'au moins une de ses réclamations (voir _is_legitimate_contact côté backend).
  const contacts = useMemo(() => {
    const acceptedIds = new Set(
      reclamations.filter((r) => r.statut === RECLAMATION_STATUS.ACCEPTEE).map((r) => r.proprietaire_id)
    );
    return allProprietaires
      .filter((u) => acceptedIds.has(u.id))
      .map((u) => ({
        id: u.id,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        photo: u.photo,
        role: t("bo.adminMessagerie.roleProprietaire"),
      }));
  }, [allProprietaires, reclamations, t]);

  function otherPartyId(msg) {
    return msg.user_id === user?.id ? msg.destinataire_id : msg.user_id;
  }

  const conversations = useMemo(() => {
    return contacts
      .map((contact) => {
        const thread = messages.filter((m) => otherPartyId(m) === contact.id);
        const last = thread[thread.length - 1];
        return { contact, thread, last };
      })
      .sort((a, b) => {
        if (!a.last && !b.last) return `${a.contact.prenom}`.localeCompare(b.contact.prenom);
        if (!a.last) return 1;
        if (!b.last) return -1;
        return new Date(b.last.date_sent) - new Date(a.last.date_sent);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, messages, user?.id]);

  const selectedConversation = conversations.find((c) => c.contact.id === selectedId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.thread.length, selectedId]);

  async function handleReclamationStatut(reclamation, statut) {
    setReclamationBanner(null);
    setReclamationBusyId(reclamation.id);
    try {
      const updated = await updateReclamationStatut(reclamation.id, statut);
      setReclamations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (statut === RECLAMATION_STATUS.ACCEPTEE) {
        // Une réclamation acceptée débloque la messagerie avec ce propriétaire
        // (voir _is_legitimate_contact côté backend) : on y bascule directement
        // plutôt que de laisser l'admin retrouver seul l'onglet et le contact,
        // avec le message d'origine pré-rempli pour qu'il n'ait pas à le
        // retaper pour donner suite à sa demande.
        setActiveTab("conversations");
        setSelectedId(reclamation.proprietaire_id);
        setDraft(`${t("bo.adminMessagerie.regardingSubject", { subject: reclamation.sujet })}\n\n${reclamation.message}`);
        setReclamationBanner({
          type: "success",
          message: t("bo.adminMessagerie.acceptedMessage", {
            name: reclamation.proprietaire?.prenom || t("bo.adminMessagerie.thisOwner"),
          }),
        });
      }
    } catch (err) {
      setReclamationBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setReclamationBusyId(null);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if ((!draft.trim() && !stagedAttachment) || !selectedId) return;
    setSendBusy(true);
    setSendError(null);
    try {
      const created = await sendMessage({ destinataireId: selectedId, message: draft.trim(), attachment: stagedAttachment });
      setMessages((prev) => [...prev, created]);
      setDraft("");
      setStagedAttachment(null);
    } catch (err) {
      setSendError(extractErrorMessage(err));
    } finally {
      setSendBusy(false);
    }
  }

  async function handleAttachmentChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    setAttachBusy(true);
    setSendError(null);
    try {
      const uploaded = await uploadDiscussionAttachment(file);
      setStagedAttachment(uploaded);
    } catch (err) {
      setSendError(extractErrorMessage(err));
    } finally {
      setAttachBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function handleDeleteMessage(messageId) {
    try {
      await deleteDiscussion(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setSendError(extractErrorMessage(err));
    }
  }

  if (isLoading) {
    return <p>{t("bo.adminMessagerie.loading")}</p>;
  }

  return (
    <div>
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-chat-dots-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.adminMessagerie.title")}
        </h2>
        <p className={styles.sectionSubtitle}>
          {t("bo.adminMessagerie.subtitle")}
        </p>

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
              {tab.key === "reclamations" && pendingReclamationsCount > 0 && (
                <span className={styles.archTabBadge}>{pendingReclamationsCount}</span>
              )}
              {tab.key === "contact" && contactStats.nouveaux > 0 && (
                <span className={styles.archTabBadge}>{contactStats.nouveaux}</span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== Réclamations ==================== */}
        {activeTab === "reclamations" && (
          <div>
            <Banner banner={reclamationBanner} />
            {reclamations.length === 0 && (
              <p className={styles.empty}>{t("bo.adminMessagerie.noReclamations")}</p>
            )}
            <div className={styles.reclamationList}>
              {reclamations.map((r) => {
                const busy = reclamationBusyId === r.id;
                return (
                  <div className={styles.reclamationCard} key={r.id}>
                    <div className={styles.reclamationHeader}>
                      <div>
                        <span className={styles.userName}>
                          {r.proprietaire
                            ? `${r.proprietaire.prenom} ${r.proprietaire.nom}`
                            : t("bo.adminMessagerie.unknownProprietaire", { id: r.proprietaire_id })}
                        </span>
                        {r.proprietaire?.email && <div className={styles.tableSubtext}>{r.proprietaire.email}</div>}
                      </div>
                      <span className={`${styles.badge} ${reclamationBadgeClass(r)}`}>
                        {reclamationStatutLabel(r)}
                      </span>
                    </div>
                    <div className={styles.reclamationSubject}>{r.sujet}</div>
                    <p className={styles.reclamationMessage}>{r.message}</p>
                    <div className={styles.reclamationMeta}>{formatDate(r.date_creation)}</div>

                    {r.statut === RECLAMATION_STATUS.EN_ATTENTE && (
                      <div className={styles.reclamationActions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => handleReclamationStatut(r, RECLAMATION_STATUS.ACCEPTEE)}
                        >
                          <i className="bi bi-check-lg" />
                          {t("bo.adminMessagerie.accept")}
                        </button>
                        <button
                          type="button"
                          className={styles.btnOutline}
                          disabled={busy}
                          onClick={() => handleReclamationStatut(r, RECLAMATION_STATUS.REJETEE)}
                        >
                          <i className="bi bi-x-lg" />
                          {t("bo.adminMessagerie.reject")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== Conversations ==================== */}
        {activeTab === "conversations" && (
          <div className={styles.msgShell}>
            {/* ---- Liste des contacts ---- */}
            <div className={styles.msgContacts}>
              <div className={styles.msgContactsHeader}>
                <span className={styles.msgContactsTitle}>
                  {t("bo.adminMessagerie.contactsTitle", { count: contacts.length })}
                </span>
              </div>
              {contacts.length === 0 && (
                <div className={styles.msgEmptyState}>
                  <i className="bi bi-people" />
                  {t("bo.adminMessagerie.noConversations")}
                </div>
              )}
              {conversations.map(({ contact, last }) => {
                const initials = `${contact.prenom?.[0] || ""}${contact.nom?.[0] || ""}`.toUpperCase();
                return (
                  <button
                    type="button"
                    key={contact.id}
                    className={`${styles.msgContactItem} ${selectedId === contact.id ? styles.msgContactItemActive : ""}`}
                    onClick={() => setSelectedId(contact.id)}
                  >
                    {contact.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${API_BASE_URL}${contact.photo}`}
                        alt=""
                        className={styles.avatar}
                        style={{ width: "2.2rem", height: "2.2rem", objectFit: "cover" }}
                      />
                    ) : (
                      <span className={styles.avatar} style={{ width: "2.2rem", height: "2.2rem", fontSize: "0.78rem" }}>
                        {initials || "?"}
                      </span>
                    )}
                    <div className={styles.msgContactBody}>
                      <div className={styles.msgContactTop}>
                        <span className={styles.msgContactName}>
                          {contact.prenom} {contact.nom}
                        </span>
                        {last && <span className={styles.msgContactMeta}>{formatTime(last.date_sent)}</span>}
                      </div>
                      <div className={styles.msgContactPreviewRow}>
                        <span className={styles.msgContactPreview}>
                          {last
                            ? `${last.user_id === user?.id ? t("bo.adminMessagerie.youPrefix") : ""}${previewText(last, t)}`
                            : t("bo.adminMessagerie.noMessageYet")}
                        </span>
                        <span className={styles.msgContactRole}>{contact.role}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ---- Fil de discussion ---- */}
            <div className={styles.msgThread}>
              {!selectedConversation ? (
                <div className={styles.msgEmptyState}>
                  <i className="bi bi-chat-square-text" />
                  {t("bo.adminMessagerie.selectContact")}
                </div>
              ) : (
                <>
                  <div className={styles.msgThreadHeader}>
                    {selectedConversation.contact.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${API_BASE_URL}${selectedConversation.contact.photo}`}
                        alt=""
                        className={styles.avatar}
                        style={{ width: "2.1rem", height: "2.1rem", objectFit: "cover" }}
                      />
                    ) : (
                      <span className={styles.avatar} style={{ width: "2.1rem", height: "2.1rem", fontSize: "0.76rem" }}>
                        {`${selectedConversation.contact.prenom?.[0] || ""}${selectedConversation.contact.nom?.[0] || ""}`.toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className={styles.userName}>
                        {selectedConversation.contact.prenom} {selectedConversation.contact.nom}
                      </div>
                      <div className={styles.recentEmail}>{selectedConversation.contact.email}</div>
                    </div>
                  </div>

                  <div className={styles.msgMessages}>
                    {selectedConversation.thread.length === 0 && (
                      <div className={styles.msgEmptyState}>
                        <i className="bi bi-chat-dots" />
                        {t("bo.adminMessagerie.noMessagesYet")}
                      </div>
                    )}
                    {selectedConversation.thread.map((m, i) => {
                      const mine = m.user_id === user?.id;
                      const prev = selectedConversation.thread[i - 1];
                      const showDaySeparator =
                        !prev || formatDayLabel(prev.date_sent, t) !== formatDayLabel(m.date_sent, t);
                      return (
                        <div key={m.id}>
                          {showDaySeparator && (
                            <div style={{ textAlign: "center", margin: "0.8rem 0" }}>
                              <span className={styles.msgContactMeta}>{formatDayLabel(m.date_sent, t)}</span>
                            </div>
                          )}
                          <div className={`${styles.msgBubbleRow} ${mine ? styles.msgBubbleRowMine : ""}`}>
                            <div className={styles.msgBubbleGroup}>
                              <div
                                className={`${styles.msgBubble} ${mine ? styles.msgBubbleMine : styles.msgBubbleTheirs}`}
                                onDoubleClick={() => mine && handleDeleteMessage(m.id)}
                                title={mine ? t("bo.adminMessagerie.deleteHint") : undefined}
                              >
                                {m.piece_jointe &&
                                  (m.piece_jointe_type?.startsWith("image/") ? (
                                    <a
                                      href={`${API_BASE_URL}${m.piece_jointe}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={styles.msgAttachmentWrap}
                                    >
                                      <img
                                        src={`${API_BASE_URL}${m.piece_jointe}`}
                                        alt={m.piece_jointe_nom || ""}
                                        className={styles.msgAttachmentImage}
                                      />
                                      <span className={styles.msgAttachmentZoomIcon}>
                                        <i className="bi bi-zoom-in" />
                                      </span>
                                    </a>
                                  ) : (
                                    <a
                                      href={`${API_BASE_URL}${m.piece_jointe}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={styles.msgAttachmentFile}
                                    >
                                      <i className="bi bi-file-earmark-arrow-down" />
                                      <span>{m.piece_jointe_nom || t("bo.adminMessagerie.file")}</span>
                                    </a>
                                  ))}
                                {m.message && (
                                  <div className={m.piece_jointe ? styles.msgAttachmentCaption : undefined}>
                                    {m.message}
                                  </div>
                                )}
                              </div>
                              <span className={`${styles.msgBubbleTime} ${mine ? styles.msgBubbleTimeMine : ""}`}>
                                {formatTime(m.date_sent)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {sendError && <div className={`${styles.banner} ${styles.bannerError}`} style={{ margin: "0 1rem" }}>{sendError}</div>}

                  <form className={styles.msgComposer} onSubmit={handleSend}>
                    {stagedAttachment && (
                      <div className={styles.msgStagedPreview}>
                        {stagedAttachment.piece_jointe_type?.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE_URL}${stagedAttachment.piece_jointe}`}
                            alt=""
                            className={styles.msgStagedThumb}
                          />
                        ) : (
                          <span className={styles.msgStagedFileIcon}>
                            <i className="bi bi-file-earmark" />
                          </span>
                        )}
                        <span className={styles.msgStagedName}>{stagedAttachment.piece_jointe_nom}</span>
                        <button
                          type="button"
                          className={styles.msgStagedRemove}
                          onClick={() => setStagedAttachment(null)}
                          title={t("bo.adminMessagerie.remove")}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    )}
                    <div className={styles.msgComposerRow}>
                      <label className={styles.msgAttachBtn} title={t("bo.adminMessagerie.attachFile")}>
                        <i className={`bi ${attachBusy ? "bi-hourglass-split" : "bi-paperclip"}`} />
                        <input
                          type="file"
                          onChange={handleAttachmentChange}
                          disabled={attachBusy || sendBusy}
                          style={{ display: "none" }}
                        />
                      </label>
                      <textarea
                        rows={1}
                        placeholder={t("bo.adminMessagerie.composerPlaceholder")}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sendBusy}
                      />
                      <button
                        type="submit"
                        className={styles.msgSendBtn}
                        disabled={sendBusy || (!draft.trim() && !stagedAttachment)}
                        title={t("bo.adminMessagerie.send")}
                      >
                        <i className="bi bi-send-fill" />
                      </button>
                    </div>
                  </form>
                </>
              )}
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
