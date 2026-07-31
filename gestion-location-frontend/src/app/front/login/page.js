"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLE_DASHBOARD_PATH, PUBLIC_REGISTER_ROLES } from "@/lib/roles";
import { extractErrorMessage } from "@/lib/apiClient";
import { requestPasswordReset } from "@/lib/passwordReset";
import { fetchAvis } from "@/lib/avis";
import Modal from "@/components/Modal";
import LogoIcon from "@/components/LogoIcon";
import LanguageSwitcher from "@/components/landing/LanguageSwitcher";
import styles from "./login.module.css";

const QUOTE_ROTATION_MS = 6000;

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Stars({ note }) {
  return (
    <span className={styles.quoteStars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= note ? "bi-star-fill" : "bi-star"}`} />
      ))}
    </span>
  );
}

function BrandPanel() {
  const { t } = useLanguage();
  const [avisList, setAvisList] = useState([]);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAvis()
      .then((list) => {
        if (!cancelled) setAvisList(list.filter((a) => a.commentaire?.trim()));
      })
      .catch(() => {
        // Avis publics : un échec de chargement ne doit pas casser l'écran de connexion.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (avisList.length < 2) return undefined;
    const id = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % avisList.length);
    }, QUOTE_ROTATION_MS);
    return () => clearInterval(id);
  }, [avisList.length]);

  const currentAvis = avisList[quoteIndex] || null;

  return (
    <aside className={styles.brandPanel} aria-hidden="true">
      <span className={`${styles.blob} ${styles.blob1}`} />
      <span className={`${styles.blob} ${styles.blob2}`} />
      <span className={`${styles.blob} ${styles.blob3}`} />

      <div className={styles.brandTop}>
        <div className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fadaa-logo-full-light.png" alt="FADAA Locative" className={styles.brandLogoFull} />
        </div>
      </div>

      <div className={styles.brandMiddle}>
        <div className={styles.brandEyebrow}>{t("login.brandEyebrow")}</div>
        <h1 className={styles.brandHeadline}>{t("login.brandHeadline")}</h1>
        <p className={styles.brandSub}>{t("login.brandSub")}</p>

        <div className={styles.statRow}>
          <div>
            <div className={styles.statValue}>500+</div>
            <div className={styles.statLabel}>{t("login.statBiens")}</div>
          </div>
          <div>
            <div className={styles.statValue}>98%</div>
            <div className={styles.statLabel}>{t("login.statSatisfaction")}</div>
          </div>
          <div>
            <div className={styles.statValue}>4.9</div>
            <div className={styles.statLabel}>{t("login.statNote")}</div>
          </div>
        </div>
      </div>

      <div className={styles.brandBottom}>
        <div className={styles.quoteCard} key={currentAvis ? currentAvis.id : "fallback"}>
          <span className={styles.quoteMark}>&ldquo;</span>
          {currentAvis ? (
            <>
              <p className={styles.quoteText}>{currentAvis.commentaire}</p>
              <p className={styles.quoteAttr}>
                <strong>
                  {currentAvis.prenom} {currentAvis.nom?.[0]}.
                </strong>
                <Stars note={currentAvis.note} />
              </p>
            </>
          ) : (
            <>
              <p className={styles.quoteText}>{t("login.fallbackQuoteText")}</p>
              <p className={styles.quoteAttr}>{t("login.fallbackQuoteAttribution")}</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, minLength, invalid }) {
  const { t } = useLanguage();
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
          aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
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
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");

  // ---- Login form state ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginBanner, setLoginBanner] = useState(null);

  // ---- Forgot password modal state ----
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotDebugLink, setForgotDebugLink] = useState(null);
  const [forgotError, setForgotError] = useState(null);

  // ---- Register form state ----
  const role = PUBLIC_REGISTER_ROLES[0].value;
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
      await register({
        nom: lastName,
        prenom: firstName,
        email: registerEmail,
        mot_de_passe: registerPassword,
        role: Number(role),
      });
      const me = await login(registerEmail, registerPassword);
      router.push(ROLE_DASHBOARD_PATH[me.role] || "/");
    } catch (err) {
      setRegisterBanner({ type: "error", message: extractErrorMessage(err) });
      setRegisterBusy(false);
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
  }

  function openForgotPassword() {
    setForgotEmail(loginEmail);
    setForgotSubmitted(false);
    setForgotDebugLink(null);
    setForgotError(null);
    setForgotOpen(true);
  }

  function closeForgotPassword() {
    if (forgotBusy) return;
    setForgotOpen(false);
  }

  async function handleSubmitForgotPassword(e) {
    e.preventDefault();
    setForgotBusy(true);
    setForgotError(null);
    try {
      const data = await requestPasswordReset(forgotEmail);
      setForgotDebugLink(data.debug_link || null);
      setForgotSubmitted(true);
    } catch (err) {
      setForgotError(extractErrorMessage(err));
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <BrandPanel />

      <main className={styles.formPanel}>
        <div className={styles.formCol}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.6rem" }}>
            <LanguageSwitcher />
          </div>

          <div className={styles.mobileLogo}>
            <span className={styles.logoMark}>
            <LogoIcon size={24} tone="light" />
          </span>
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
              {t("login.tabLogin")}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === "register" ? styles.tabBtnActive : ""}`}
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => switchTab("register")}
            >
              {t("login.tabRegister")}
            </button>
          </div>

          {activeTab === "login" ? (
            <form onSubmit={handleLogin}>
              <h2 className={styles.formTitle}>{t("login.loginTitle")}</h2>
              <p className={styles.formSubtext}>
                {t("login.loginSubtitlePrefix")}{" "}
                <button type="button" onClick={() => switchTab("register")}>
                  {t("login.loginSubtitleLink")}
                </button>
              </p>

              {loginBanner && <div className={`${styles.banner} ${styles.bannerError}`}>{loginBanner.message}</div>}

              <div className={styles.field}>
                <label htmlFor="login-email">{t("login.emailLabel")}</label>
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
                label={t("login.passwordLabel")}
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              <div className={styles.rowBetween}>
                <label className={styles.rememberRow}>
                  <input type="checkbox" className={styles.checkbox} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t("login.remember")}
                </label>
                <button type="button" className={styles.forgotLink} onClick={openForgotPassword}>
                  {t("login.forgot")}
                </button>
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={loginBusy}>
                {loginBusy ? t("login.submitting") : t("login.submit")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate>
              <h2 className={styles.formTitle}>{t("login.registerTitle")}</h2>
              <p className={styles.formSubtext}>
                {t("login.registerSubtitlePrefix")}{" "}
                <button type="button" onClick={() => switchTab("login")}>
                  {t("login.registerSubtitleLink")}
                </button>
              </p>

              {registerBanner && (
                <div className={`${styles.banner} ${registerBanner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
                  {registerBanner.message}
                </div>
              )}

              <span className={styles.accountBadge}>
                <i className="bi bi-house-check-fill" />
                {t("login.accountBadge")}
              </span>

              <div className={styles.nameGrid}>
                <div className={styles.field}>
                  <label htmlFor="register-firstname">{t("login.firstNameLabel")}</label>
                  <input
                    type="text"
                    id="register-firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t("login.firstNameLabel")}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="register-lastname">{t("login.lastNameLabel")}</label>
                  <input
                    type="text"
                    id="register-lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t("login.lastNameLabel")}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="register-email">{t("login.emailLabel")}</label>
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
                label={t("login.passwordLabel")}
                value={registerPassword}
                onChange={setRegisterPassword}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
                minLength={8}
              />

              <div>
                <PasswordField
                  id="register-password-confirm"
                  label={t("login.confirmPasswordLabel")}
                  value={registerConfirm}
                  onChange={setRegisterConfirm}
                  placeholder="Retapez votre mot de passe"
                  autoComplete="new-password"
                  invalid={passwordMismatchTyped}
                />
                {passwordMismatchTyped && <p className={styles.fieldError}>{t("login.passwordMismatch")}</p>}
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
                  {t("login.termsPrefix")}{" "}
                  <Link href="/front/conditions-utilisation" target="_blank">
                    {t("login.termsLink")}
                  </Link>{" "}
                  {t("login.andWord")}{" "}
                  <Link href="/front/politique-confidentialite" target="_blank">
                    {t("login.privacyLink")}
                  </Link>
                </label>
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={!canSubmitRegister}>
                {registerBusy ? t("login.submitCreating") : t("login.submitCreate")}
              </button>
            </form>
          )}

          <p className={styles.legalNote}>
            {activeTab === "login" ? t("login.legalLoginPrefix") : t("login.legalRegisterPrefix")}, {t("login.legalMiddle")}{" "}
            <Link href="/front/conditions-utilisation" target="_blank">
              {t("login.termsLink")}
            </Link>{" "}
            {t("login.legalAnd")}{" "}
            <Link href="/front/politique-confidentialite" target="_blank">
              {t("login.privacyLink")}
            </Link>
            .
          </p>
        </div>
      </main>

      <Modal isOpen={forgotOpen} onClose={closeForgotPassword} title={t("login.forgotModalTitle")}>
        {forgotSubmitted ? (
          <div>
            <p className={styles.formSubtext} style={{ margin: 0 }}>
              {t("login.forgotSentText")}
            </p>
            {forgotDebugLink && (
              <div className={styles.formSubtext} style={{ marginTop: "0.9rem" }}>
                <strong>{t("login.forgotTestModeLabel")}</strong> {t("login.forgotTestModeText")}
                <br />
                <a href={forgotDebugLink} style={{ wordBreak: "break-all" }}>
                  {forgotDebugLink}
                </a>
              </div>
            )}
            <button type="button" className={styles.btnSubmit} style={{ marginTop: "1.2rem" }} onClick={closeForgotPassword}>
              {t("login.forgotClose")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitForgotPassword}>
            <p className={styles.formSubtext} style={{ margin: "0 0 1rem" }}>
              {t("login.forgotModalText")}
            </p>
            <div className={styles.field}>
              <label htmlFor="forgot-email">{t("login.emailLabel")}</label>
              <input
                type="email"
                id="forgot-email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                required
              />
            </div>
            {forgotError && (
              <p className={styles.formSubtext} style={{ color: "var(--danger, #c1622f)" }}>
                {forgotError}
              </p>
            )}
            <button type="submit" className={styles.btnSubmit} disabled={forgotBusy}>
              {forgotBusy ? t("login.forgotSubmitting") : t("login.forgotSubmit")}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
