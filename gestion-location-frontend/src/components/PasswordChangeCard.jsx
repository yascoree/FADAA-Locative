"use client";

import { useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { verifyCurrentPassword } from "@/lib/profile";
import { updateUser } from "@/lib/users";
import TextField from "@/components/TextField";
import { useLanguage } from "@/context/LanguageContext";

/** Carte "Sécurité" des pages Paramètres : formulaire direct (comme Compte/Profil)
    avec le mot de passe actuel, le nouveau et sa confirmation, plutôt qu'un flux
    en plusieurs étapes dans une modale. `styles` est le module CSS de la page
    appelante, pour rester visuellement cohérent avec le reste. */
export default function PasswordChangeCard({ styles, userId, onSuccess }) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("bo.security.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const valid = await verifyCurrentPassword(currentPassword);
      if (!valid) {
        setError(t("bo.security.incorrectCurrent"));
        return;
      }
      await updateUser(userId, { mot_de_passe: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.section} style={{ marginBottom: 0 }}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <i className="bi bi-shield-lock-fill" style={{ color: "var(--primary)" }} />
          {t("bo.security.title")}
        </h3>
        <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
          {t("bo.security.subtitle")}
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
          <TextField
            label={t("bo.security.currentPasswordLabel")}
            name="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <TextField
            label={t("bo.security.newPasswordLabel")}
            name="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint={t("bo.security.newPasswordHint")}
            minLength={8}
            required
          />
          <TextField
            label={t("bo.security.confirmPasswordLabel")}
            name="confirm_password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className={styles.editActions} style={{ marginTop: "1rem" }}>
            <button type="submit" className={styles.btn} disabled={busy}>
              <i className="bi bi-key-fill" />
              {busy ? t("bo.common.saving") : t("bo.security.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
