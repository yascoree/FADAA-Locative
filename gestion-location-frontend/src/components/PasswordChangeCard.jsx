"use client";

import { useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { verifyCurrentPassword } from "@/lib/profile";
import { updateUser } from "@/lib/users";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";

/** Carte "Sécurité" des pages Paramètres : bouton qui ouvre un flux en deux temps
    (confirmer le mot de passe actuel, ou "mot de passe oublié" pour sauter cette
    étape puisque l'utilisateur est déjà connecté) avant de laisser modifier le
    mot de passe. `styles` est le module CSS de la page appelante, pour rester
    visuellement cohérent avec le reste (Compte, Profil...). */
export default function PasswordChangeCard({ styles, userId, onSuccess }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState("verify"); // "verify" | "new"

  const [currentPassword, setCurrentPassword] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function openModal() {
    setStep("verify");
    setCurrentPassword("");
    setVerifyError(null);
    setNewPassword("");
    setConfirmPassword("");
    setSubmitError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (verifyBusy || submitBusy) return;
    setModalOpen(false);
  }

  async function handleVerify(e) {
    e.preventDefault();
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const valid = await verifyCurrentPassword(currentPassword);
      if (!valid) {
        setVerifyError("Mot de passe incorrect.");
        return;
      }
      setStep("new");
    } catch (err) {
      setVerifyError(extractErrorMessage(err));
    } finally {
      setVerifyBusy(false);
    }
  }

  function handleForgot() {
    setStep("new");
    setVerifyError(null);
  }

  async function handleSubmitNewPassword(e) {
    e.preventDefault();
    setSubmitError(null);
    if (newPassword !== confirmPassword) {
      setSubmitError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitBusy(true);
    try {
      await updateUser(userId, { mot_de_passe: newPassword });
      setModalOpen(false);
      onSuccess?.();
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSubmitBusy(false);
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
        <button type="button" className={styles.btn} onClick={openModal}>
          <i className="bi bi-key-fill" />
          Modifier le mot de passe
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={step === "verify" ? "Confirmez votre mot de passe actuel" : "Nouveau mot de passe"}
      >
        {step === "verify" ? (
          <form onSubmit={handleVerify}>
            {verifyError && <div className={`${styles.banner} ${styles.bannerError}`}>{verifyError}</div>}
            <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
              Pour votre sécurité, confirmez votre mot de passe actuel avant d&apos;en choisir un nouveau.
            </p>
            <TextField
              label="Mot de passe actuel"
              name="current_password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
              required
            />
            <div
              className={styles.editActions}
              style={{ marginTop: "1.2rem", justifyContent: "space-between", width: "100%" }}
            >
              <button type="button" className={styles.btnOutline} onClick={handleForgot} disabled={verifyBusy}>
                Mot de passe oublié ?
              </button>
              <button type="submit" className={styles.btn} disabled={verifyBusy || !currentPassword}>
                {verifyBusy ? "Vérification..." : "Continuer"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitNewPassword}>
            {submitError && <div className={`${styles.banner} ${styles.bannerError}`}>{submitError}</div>}
            <TextField
              label="Nouveau mot de passe"
              name="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              hint="8 caractères minimum"
              minLength={8}
              autoFocus
              required
            />
            <TextField
              label="Confirmer le mot de passe"
              name="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
            <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
              <button type="submit" className={styles.btn} disabled={submitBusy}>
                <i className="bi bi-check-lg" />
                {submitBusy ? "Enregistrement..." : "Mettre à jour le mot de passe"}
              </button>
              <button type="button" className={styles.btnOutline} onClick={closeModal} disabled={submitBusy}>
                <i className="bi bi-x-lg" />
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
