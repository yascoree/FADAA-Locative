"use client";

import { useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { verifyCurrentPassword } from "@/lib/profile";
import { updateUser } from "@/lib/users";
import TextField from "@/components/TextField";

/** Carte "Sécurité" des pages Paramètres : formulaire direct (comme Compte/Profil)
    avec le mot de passe actuel, le nouveau et sa confirmation, plutôt qu'un flux
    en plusieurs étapes dans une modale. `styles` est le module CSS de la page
    appelante, pour rester visuellement cohérent avec le reste. */
export default function PasswordChangeCard({ styles, userId, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const valid = await verifyCurrentPassword(currentPassword);
      if (!valid) {
        setError("Mot de passe actuel incorrect.");
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
          Sécurité
        </h3>
        <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
          Modifiez le mot de passe de votre compte.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
          <TextField
            label="Mot de passe actuel"
            name="current_password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <TextField
            label="Nouveau mot de passe"
            name="new_password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="8 caractères minimum"
            minLength={8}
            required
          />
          <TextField
            label="Confirmer le nouveau mot de passe"
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
              {busy ? "Enregistrement..." : "Mettre à jour le mot de passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
