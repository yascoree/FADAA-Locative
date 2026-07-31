"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/landing.module.css";

export default function ChatBot() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  // On stocke une référence (type + index) plutôt que le texte figé : si
  // l'utilisateur change de langue en cours de route, toute la conversation
  // déjà affichée se retraduit au prochain rendu au lieu de rester figée.
  const [messages, setMessages] = useState([{ from: "bot", kind: "greeting" }]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);
  const questions = t("chatbot.questions");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function toggleOpen() {
    setOpen((o) => !o);
    setHasOpened(true);
  }

  function askQuestion(index) {
    setMessages((prev) => [...prev, { from: "user", kind: "faq", index }]);
    setTyping(true);
    // Petit délai avant la réponse : rend le script plus vivant qu'un texte
    // qui apparaît instantanément, sans faire croire à une vraie IA.
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { from: "bot", kind: "faq", index }]);
    }, 450);
  }

  function messageText(m) {
    if (m.kind === "greeting") return t("chatbot.greeting");
    const item = questions[m.index];
    if (!item) return "";
    return m.from === "user" ? item.question : item.answer;
  }

  return (
    <>
      <div
        className={`${styles.chatPanel} ${open ? styles.chatPanelOpen : ""}`}
        role="dialog"
        aria-label={t("chatbot.headerTitle")}
        aria-hidden={!open}
      >
        <div className={styles.chatHeader}>
          <span className={styles.chatHeaderAvatar}>
            <i className="bi bi-stars" />
          </span>
          <div>
            <div className={styles.chatHeaderTitle}>{t("chatbot.headerTitle")}</div>
            <div className={styles.chatHeaderStatus}>
              <span className={styles.chatHeaderDot} /> {t("chatbot.headerStatus")}
            </div>
          </div>
          <button
            type="button"
            className={styles.chatCloseBtn}
            onClick={() => setOpen(false)}
            aria-label={t("chatbot.closeLabel")}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className={styles.chatMessages} ref={scrollRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.chatBubble} ${m.from === "user" ? styles.chatBubbleUser : styles.chatBubbleBot}`}
            >
              {messageText(m)}
            </div>
          ))}
          {typing && (
            <div className={`${styles.chatBubble} ${styles.chatBubbleBot} ${styles.chatBubbleTyping}`}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          )}
        </div>

        <div className={styles.chatQuickReplies}>
          {questions.map((item, index) => (
            <button
              key={index}
              type="button"
              className={styles.chatChip}
              onClick={() => askQuestion(index)}
              disabled={typing}
            >
              {item.question}
            </button>
          ))}
        </div>

        <div className={styles.chatFooterCta}>
          <Link href="/front/login?tab=register" className={styles.chatFooterCtaBtn}>
            <i className="bi bi-rocket-takeoff" /> {t("chatbot.ctaFreeTrial")}
          </Link>
          <Link href="/front/contact" className={styles.chatFooterCtaLink}>
            {t("chatbot.ctaTalkHuman")} <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>

      <button
        type="button"
        className={`${styles.chatBubbleBtn} ${!hasOpened ? styles.chatBubbleBtnPulse : ""} ${open ? styles.chatBubbleBtnOpen : ""}`}
        onClick={toggleOpen}
        aria-label={open ? t("chatbot.closeLabel") : t("chatbot.openLabel")}
      >
        <i className={`bi ${open ? "bi-x-lg" : "bi-chat-dots-fill"}`} />
      </button>
    </>
  );
}
