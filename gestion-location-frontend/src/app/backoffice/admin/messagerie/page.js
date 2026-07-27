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
import { ROLES } from "@/lib/roles";
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

function previewText(message) {
  if (message.message) return message.message;
  if (message.piece_jointe) return message.piece_jointe_type?.startsWith("image/") ? "📷 Photo" : "📎 Fichier";
  return "";
}

function formatDayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Aujourd'hui";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function reclamationBadgeClass(statut) {
  if (statut === RECLAMATION_STATUS.ACCEPTEE) return styles.badgeActive;
  if (statut === RECLAMATION_STATUS.REJETEE) return styles.badgeExpired;
  return styles.badgeSuspended;
}

const TABS = [
  { key: "reclamations", label: "Réclamations", icon: "bi-inbox" },
  { key: "conversations", label: "Conversations", icon: "bi-chat-dots" },
];

export default function AdminMessageriePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("reclamations");
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

  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [users, reclamationsList, discussions] = await Promise.all([
          fetchUsers(),
          fetchReclamations(),
          fetchDiscussions(),
        ]);
        setAllProprietaires(users.filter((u) => u.role === ROLES.PROPRIETAIRE));
        setReclamations(reclamationsList);
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

  // Un propriétaire n'apparaît comme contact chattable qu'après acceptation
  // d'au moins une de ses réclamations (voir _is_legitimate_contact côté backend).
  const contacts = useMemo(() => {
    const acceptedIds = new Set(
      reclamations.filter((r) => r.statut === RECLAMATION_STATUS.ACCEPTEE).map((r) => r.proprietaire_id)
    );
    return allProprietaires
      .filter((u) => acceptedIds.has(u.id))
      .map((u) => ({ id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, photo: u.photo, role: "Propriétaire" }));
  }, [allProprietaires, reclamations]);

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
        setReclamationBanner({
          type: "success",
          message: `Réclamation acceptée. Vous pouvez maintenant discuter avec ${reclamation.proprietaire?.prenom || "ce propriétaire"}.`,
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
    return <p>Chargement...</p>;
  }

  return (
    <div>
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-chat-dots-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Messagerie
        </h2>
        <p className={styles.sectionSubtitle}>
          Un propriétaire contacte d&apos;abord l&apos;administration via une réclamation. Une fois acceptée, la
          conversation s&apos;ouvre dans les deux sens.
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
            </button>
          ))}
        </div>

        {/* ==================== Réclamations ==================== */}
        {activeTab === "reclamations" && (
          <div>
            <Banner banner={reclamationBanner} />
            {reclamations.length === 0 && (
              <p className={styles.empty}>Aucune réclamation pour le moment.</p>
            )}
            <div className={styles.reclamationList}>
              {reclamations.map((r) => {
                const busy = reclamationBusyId === r.id;
                return (
                  <div className={styles.reclamationCard} key={r.id}>
                    <div className={styles.reclamationHeader}>
                      <div>
                        <span className={styles.userName}>
                          {r.proprietaire ? `${r.proprietaire.prenom} ${r.proprietaire.nom}` : `Propriétaire #${r.proprietaire_id}`}
                        </span>
                        {r.proprietaire?.email && <div className={styles.tableSubtext}>{r.proprietaire.email}</div>}
                      </div>
                      <span className={`${styles.badge} ${reclamationBadgeClass(r.statut)}`}>
                        {RECLAMATION_STATUS_LABELS[r.statut]}
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
                          Accepter
                        </button>
                        <button
                          type="button"
                          className={styles.btnOutline}
                          disabled={busy}
                          onClick={() => handleReclamationStatut(r, RECLAMATION_STATUS.REJETEE)}
                        >
                          <i className="bi bi-x-lg" />
                          Rejeter
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
                <span className={styles.msgContactsTitle}>Propriétaires ({contacts.length})</span>
              </div>
              {contacts.length === 0 && (
                <div className={styles.msgEmptyState}>
                  <i className="bi bi-people" />
                  Aucune conversation ouverte. Acceptez une réclamation pour commencer à discuter.
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
                          {last ? `${last.user_id === user?.id ? "Vous : " : ""}${previewText(last)}` : "Aucun message"}
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
                  Sélectionnez un propriétaire pour démarrer une conversation.
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
                        Aucun message pour l&apos;instant. Dites bonjour !
                      </div>
                    )}
                    {selectedConversation.thread.map((m, i) => {
                      const mine = m.user_id === user?.id;
                      const prev = selectedConversation.thread[i - 1];
                      const showDaySeparator = !prev || formatDayLabel(prev.date_sent) !== formatDayLabel(m.date_sent);
                      return (
                        <div key={m.id}>
                          {showDaySeparator && (
                            <div style={{ textAlign: "center", margin: "0.8rem 0" }}>
                              <span className={styles.msgContactMeta}>{formatDayLabel(m.date_sent)}</span>
                            </div>
                          )}
                          <div className={`${styles.msgBubbleRow} ${mine ? styles.msgBubbleRowMine : ""}`}>
                            <div className={styles.msgBubbleGroup}>
                              <div
                                className={`${styles.msgBubble} ${mine ? styles.msgBubbleMine : styles.msgBubbleTheirs}`}
                                onDoubleClick={() => mine && handleDeleteMessage(m.id)}
                                title={mine ? "Double-clic pour supprimer" : undefined}
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
                                      <span>{m.piece_jointe_nom || "Fichier"}</span>
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
                          title="Retirer"
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    )}
                    <div className={styles.msgComposerRow}>
                      <label className={styles.msgAttachBtn} title="Joindre un fichier">
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
                        placeholder="Écrivez un message... (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={sendBusy}
                      />
                      <button
                        type="submit"
                        className={styles.msgSendBtn}
                        disabled={sendBusy || (!draft.trim() && !stagedAttachment)}
                        title="Envoyer"
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
      </div>
    </div>
  );
}
