"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchLocataires } from "@/lib/tenants";
import { fetchMandates, MANDAT_STATUS } from "@/lib/mandates";
import { fetchDiscussions, sendMessage, deleteDiscussion, uploadDiscussionAttachment } from "@/lib/discussions";
import { fetchNotifications, markNotificationRead, NOTIFICATION_STATUS, NOTIFICATION_TYPE } from "@/lib/notifications";
import LoadingState from "@/components/LoadingState";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../agence.module.css";

function formatTime(value) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function previewText(message, t) {
  if (message.message) return message.message;
  if (message.piece_jointe) {
    return message.piece_jointe_type?.startsWith("image/")
      ? t("bo.proprietaireMessagerie.photoPreview")
      : t("bo.proprietaireMessagerie.filePreview");
  }
  return "";
}

function formatDayLabel(value, t) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return t("bo.proprietaireMessagerie.today");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("bo.proprietaireMessagerie.yesterday");
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AgenceDiscussionsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
        const [locataires, mandates, discussions] = await Promise.all([
          fetchLocataires(),
          fetchMandates(),
          fetchDiscussions(),
        ]);
        const tenantContacts = locataires.map((l) => ({
          id: l.id,
          nom: l.nom,
          prenom: l.prenom,
          email: l.email,
          photo: l.photo,
          role: t("bo.agenceDiscussions.roleTenant"),
        }));
        const proprietaireContacts = mandates
          .filter((m) => m.statut === MANDAT_STATUS.ACTIF && m.proprietaire)
          .map((m) => ({
            id: m.proprietaire.id,
            nom: m.proprietaire.nom,
            prenom: m.proprietaire.prenom,
            email: m.proprietaire.email,
            photo: m.proprietaire.photo,
            role: t("bo.agenceDiscussions.roleProprietaire"),
          }));
        const merged = [...proprietaireContacts, ...tenantContacts].filter(
          (c, i, arr) => arr.findIndex((o) => o.id === c.id) === i
        );
        setContacts(merged);
        setMessages(discussions);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <LoadingState label={t("bo.common.loading")} />;
  }

  return (
    <div>
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-chat-dots-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.agenceDiscussions.title")}
        </h2>
        <p className={styles.sectionSubtitle}>{t("bo.agenceDiscussions.subtitle")}</p>

        <div className={styles.msgShell}>
          {/* ---- Liste des contacts ---- */}
          <div className={styles.msgContacts}>
            <div className={styles.msgContactsHeader}>
              <span className={styles.msgContactsTitle}>
                {t("bo.proprietaireMessagerie.contactsCount", { count: contacts.length })}
              </span>
            </div>
            {contacts.length === 0 && (
              <div className={styles.msgEmptyState}>
                <i className="bi bi-people" />
                {t("bo.agenceDiscussions.noContacts")}
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
                          ? `${last.user_id === user?.id ? t("bo.proprietaireMessagerie.you") : ""}${previewText(last, t)}`
                          : t("bo.proprietaireMessagerie.noMessage")}
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
                {t("bo.proprietaireMessagerie.selectContact")}
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
                      {t("bo.proprietaireMessagerie.noMessagesYet")}
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
                              title={mine ? t("bo.proprietaireMessagerie.deleteHint") : undefined}
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
                                    <span>{m.piece_jointe_nom || t("bo.proprietaireMessagerie.fileFallbackName")}</span>
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
                        title={t("bo.proprietaireMessagerie.removeAttachment")}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  )}
                  <div className={styles.msgComposerRow}>
                    <label className={styles.msgAttachBtn} title={t("bo.proprietaireMessagerie.attachFile")}>
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
                      placeholder={t("bo.proprietaireMessagerie.messagePlaceholder")}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sendBusy}
                    />
                    <button
                      type="submit"
                      className={styles.msgSendBtn}
                      disabled={sendBusy || (!draft.trim() && !stagedAttachment)}
                      title={t("bo.proprietaireMessagerie.send")}
                    >
                      <i className="bi bi-send-fill" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
