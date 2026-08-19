"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import { resetPassword } from "@/lib/passwordReset";
import LogoIcon from "@/components/LogoIcon";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import styles from "../login/login.module.css";

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap} style={{ gridTemplateColumns: "1fr" }}>
      <main className={styles.formPanel}>
        <div className={styles.formCol}>
          <div className={styles.mobileLogo} style={{ display: "flex" }}>
            <span className={styles.logoMark}>
              <LogoIcon size={24} tone="light" />
            </span>
            <span className={styles.logoWord}>FADAA Locative</span>
          </div>

          {!token ? (
            <>
              <h1 className={styles.formTitle}>Lien invalide</h1>
              <p className={styles.formSubtext}>
                Ce lien de réinitialisation est incomplet ou incorrect. Redemandez un nouveau lien depuis la page de
                connexion.
              </p>
              <Link
                href="/front/login"
                className={styles.btnSubmit}
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}
              >
                Retour à la connexion
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className={styles.formTitle}>Mot de passe mis à jour</h1>
              <p className={styles.formSubtext}>
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
              <Link
                href="/front/login"
                className={styles.btnSubmit}
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}
              >
                Se connecter
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.formTitle}>Choisissez un nouveau mot de passe</h1>
              <p className={styles.formSubtext}>
                Ce lien est valable 30 minutes et ne peut être utilisé qu&apos;une seule fois.
              </p>
              <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <label htmlFor="new-password">Nouveau mot de passe</label>
                  <input
                    type="password"
                    id="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    autoComplete="new-password"
                    required
                  />
                  <PasswordStrengthMeter password={password} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="confirm-password">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {error && (
                  <p className={styles.formSubtext} style={{ color: "var(--danger)" }}>
                    {error}
                  </p>
                )}
                <button type="submit" className={styles.btnSubmit} disabled={busy}>
                  {busy ? "Enregistrement..." : "Réinitialiser le mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
