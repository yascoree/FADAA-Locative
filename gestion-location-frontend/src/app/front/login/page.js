"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLE_DASHBOARD_PATH, ROLE_LABELS, PUBLIC_REGISTER_ROLES } from "@/lib/roles";
import { extractErrorMessage } from "@/lib/apiClient";
import styles from "./login.module.css";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BrandPanel() {
  return (
    <aside className={styles.brandPanel} aria-hidden="true">
      <span className={`${styles.blob} ${styles.blob1}`} />
      <span className={`${styles.blob} ${styles.blob2}`} />

      <div className={styles.brandTop}>
        <div className={styles.logoLockup}>
          <span className={styles.logoMark}>F</span>
          <span className={styles.logoWord}>FADAA Locative</span>
        </div>
      </div>

      <div className={styles.brandMiddle}>
        <div className={styles.brandEyebrow}>Plateforme de gestion locative</div>
        <h1 className={styles.brandHeadline}>La gestion locative, enfin sous contrôle.</h1>
        <p className={styles.brandSub}>
          Biens, baux, paiements et permissions de vos gestionnaires — tout au même endroit.
        </p>

        <div className={styles.statRow}>
          <div>
            <div className={styles.statValue}>500+</div>
            <div className={styles.statLabel}>biens gérés sur la plateforme</div>
          </div>
          <div>
            <div className={styles.statValue}>98%</div>
            <div className={styles.statLabel}>de propriétaires satisfaits</div>
          </div>
          <div>
            <div className={styles.statValue}>4.9</div>
            <div className={styles.statLabel}>note moyenne des utilisateurs</div>
          </div>
        </div>
      </div>

      <div className={styles.brandBottom}>
        <div className={styles.quoteCard}>
          <span className={styles.quoteMark}>&ldquo;</span>
          <p className={styles.quoteText}>
            Depuis qu&apos;on gère nos biens avec FADAA, chaque gestionnaire sait exactement ce qu&apos;il a le
            droit de faire — plus aucune mauvaise surprise.
          </p>
          <p className={styles.quoteAttr}>
            <strong>Nadia B.</strong> — propriétaire de 8 biens
          </p>
        </div>
      </div>
    </aside>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, minLength, invalid }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          type={visible ? "text" : "password"}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          data-invalid={invalid ? "true" : "false"}
          required
        />
        <button
          type="button"
          className={styles.pwToggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onClick={() => setVisible((v) => !v)}
        >
          <EyeIcon />
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState("login");

  // ---- Login form state ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginBanner, setLoginBanner] = useState(null);

  // ---- Register form state ----
  const [role, setRole] = useState(PUBLIC_REGISTER_ROLES[0].value);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerBanner, setRegisterBanner] = useState(null);

  const passwordsMatch = registerPassword.length > 0 && registerPassword === registerConfirm;
  const passwordMismatchTyped = registerConfirm.length > 0 && !passwordsMatch;
  const canSubmitRegister =
    passwordsMatch && registerPassword.length >= 8 && terms && !registerBusy && firstName && lastName && registerEmail;

  async function handleLogin(e) {
    e.preventDefault();
    setLoginBanner(null);
    setLoginBusy(true);
    try {
      const me = await login(loginEmail, loginPassword);
      router.push(ROLE_DASHBOARD_PATH[me.role] || "/");
    } catch (err) {
      setLoginBanner({ type: "error", message: extractErrorMessage(err) });
      setLoginBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegisterBanner(null);
    setRegisterBusy(true);
    try {
      const created = await register({
        nom: lastName,
        prenom: firstName,
        email: registerEmail,
        mot_de_passe: registerPassword,
        role: Number(role),
      });
      setRegisterBanner({
        type: "success",
        message: `Compte créé : ${created.prenom} ${created.nom} (${ROLE_LABELS[created.role]}). Vous pouvez maintenant vous connecter avec cet e-mail.`,
      });
      setLoginEmail(registerEmail);
      setFirstName("");
      setLastName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirm("");
      setTerms(false);
    } catch (err) {
      setRegisterBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setRegisterBusy(false);
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
  }

  return (
    <div className={styles.wrap}>
      <BrandPanel />

      <main className={styles.formPanel}>
        <div className={styles.formCol}>
          <div className={styles.mobileLogo}>
            <span className={styles.logoMark}>F</span>
            <span className={styles.logoWord}>FADAA Locative</span>
          </div>

          <div className={styles.tabSwitch} role="tablist" aria-label="Connexion ou création de compte">
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "login" ? styles.tabBtnActive : ""}`}
              role="tab"
              aria-selected={activeTab === "login"}
              onClick={() => switchTab("login")}
            >
              Se connecter
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "register" ? styles.tabBtnActive : ""}`}
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => switchTab("register")}
            >
              Créer un compte
            </button>
          </div>

          {activeTab === "login" ? (
            <form onSubmit={handleLogin}>
              <h2 className={styles.formTitle}>Bon retour parmi nous</h2>
              <p className={styles.formSubtext}>
                Pas encore de compte ?{" "}
                <button type="button" onClick={() => switchTab("register")}>
                  Créer un compte
                </button>
              </p>

              {loginBanner && <div className={`${styles.banner} ${styles.bannerError}`}>{loginBanner.message}</div>}

              <div className={styles.field}>
                <label htmlFor="login-email">Adresse e-mail</label>
                <input
                  type="email"
                  id="login-email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  required
                />
              </div>

              <PasswordField
                id="login-password"
                label="Mot de passe"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              <div className={styles.rowBetween}>
                <label className={styles.rememberRow}>
                  <input type="checkbox" className={styles.checkbox} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Se souvenir de moi
                </label>
                <button type="button" className={styles.forgotLink}>
                  Mot de passe oublié ?
                </button>
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={loginBusy}>
                {loginBusy ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate>
              <h2 className={styles.formTitle}>Créez votre compte</h2>
              <p className={styles.formSubtext}>
                Déjà un compte ?{" "}
                <button type="button" onClick={() => switchTab("login")}>
                  Se connecter
                </button>
              </p>

              {registerBanner && (
                <div className={`${styles.banner} ${registerBanner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
                  {registerBanner.message}
                </div>
              )}

              <span className={styles.fieldLabel}>Type de compte</span>
              <div className={styles.roleSelect}>
                {PUBLIC_REGISTER_ROLES.map((option) => (
                  <label key={option.value} className={styles.roleOption}>
                    <input
                      type="radio"
                      name="register-role"
                      value={option.value}
                      checked={role === option.value}
                      onChange={() => setRole(option.value)}
                    />
                    <span className={`${styles.roleCard} ${role === option.value ? styles.roleCardActive : ""}`}>
                      <span className={styles.roleTitle}>{option.label}</span>
                      <span className={styles.roleSub}>{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className={styles.nameGrid}>
                <div className={styles.field}>
                  <label htmlFor="register-firstname">Prénom</label>
                  <input
                    type="text"
                    id="register-firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="register-lastname">Nom</label>
                  <input
                    type="text"
                    id="register-lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="register-email">Adresse e-mail</label>
                <input
                  type="email"
                  id="register-email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  required
                />
              </div>

              <PasswordField
                id="register-password"
                label="Mot de passe"
                value={registerPassword}
                onChange={setRegisterPassword}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
                minLength={8}
              />

              <div>
                <PasswordField
                  id="register-password-confirm"
                  label="Confirmer le mot de passe"
                  value={registerConfirm}
                  onChange={setRegisterConfirm}
                  placeholder="Retapez votre mot de passe"
                  autoComplete="new-password"
                  invalid={passwordMismatchTyped}
                />
                {passwordMismatchTyped && <p className={styles.fieldError}>Les mots de passe ne correspondent pas.</p>}
              </div>

              <div className={`${styles.checkboxRow} ${styles.termsRow}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  id="register-terms"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <label htmlFor="register-terms">
                  J&apos;accepte les <a href="#terms">Conditions d&apos;utilisation</a> et la{" "}
                  <a href="#privacy">Politique de confidentialité</a>
                </label>
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={!canSubmitRegister}>
                {registerBusy ? "Création..." : "Créer mon compte"}
              </button>
            </form>
          )}

          <p className={styles.securityNote}>🔒 Connexion sécurisée et chiffrée</p>

          <p className={styles.legalNote}>
            {activeTab === "login" ? "En vous connectant" : "En créant votre compte"}, vous acceptez nos{" "}
            <a href="#terms">Conditions d&apos;utilisation</a> et notre <a href="#privacy">Politique de confidentialité</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
