"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { updateUser } from "@/lib/users";
import { fetchProfile, createProfile, updateProfile } from "@/lib/profile";
import TextField from "@/components/TextField";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

const EMPTY_PROFILE = { telephone: "", adresse: "", date_naissance: "", piece_identite: "" };

export default function AdminParametresPage() {
  const { user, refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileBanner, setProfileBanner] = useState(null);

  const [accountDraft, setAccountDraft] = useState({ prenom: "", nom: "", email: "" });
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountBanner, setAccountBanner] = useState(null);

  const [passwordDraft, setPasswordDraft] = useState({ mot_de_passe: "", confirmation: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordBanner, setPasswordBanner] = useState(null);

  useEffect(() => {
    if (!user) return;
    setAccountDraft({ prenom: user.prenom, nom: user.nom, email: user.email });

    async function init() {
      setIsLoading(true);
      try {
        const profile = await fetchProfile(user.id);
        setProfileExists(true);
        setProfileDraft({
          telephone: profile.telephone || "",
          adresse: profile.adresse || "",
          date_naissance: profile.date_naissance || "",
          piece_identite: profile.piece_identite || "",
        });
      } catch {
        // Pas encore de profil créé pour ce compte : le formulaire reste vide, la
        // première sauvegarde le créera (POST) plutôt que de le mettre à jour (PUT).
        setProfileExists(false);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [user]);

  async function handleSubmitProfile(e) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileBanner(null);
    try {
      const payload = {
        telephone: profileDraft.telephone || null,
        adresse: profileDraft.adresse || null,
        date_naissance: profileDraft.date_naissance || null,
        piece_identite: profileDraft.piece_identite || null,
      };
      if (profileExists) {
        await updateProfile(user.id, payload);
      } else {
        await createProfile(user.id, payload);
        setProfileExists(true);
      }
      setProfileBanner({ type: "success", message: "Profil mis à jour." });
    } catch (err) {
      setProfileBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSubmitAccount(e) {
    e.preventDefault();
    setAccountBusy(true);
    setAccountBanner(null);
    try {
      await updateUser(user.id, {
        prenom: accountDraft.prenom,
        nom: accountDraft.nom,
        email: accountDraft.email,
      });
      await refreshUser();
      setAccountBanner({ type: "success", message: "Informations du compte mises à jour." });
    } catch (err) {
      setAccountBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleSubmitPassword(e) {
    e.preventDefault();
    setPasswordBanner(null);
    if (passwordDraft.mot_de_passe !== passwordDraft.confirmation) {
      setPasswordBanner({ type: "error", message: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setPasswordBusy(true);
    try {
      await updateUser(user.id, { mot_de_passe: passwordDraft.mot_de_passe });
      setPasswordDraft({ mot_de_passe: "", confirmation: "" });
      setPasswordBanner({ type: "success", message: "Mot de passe mis à jour." });
    } catch (err) {
      setPasswordBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPasswordBusy(false);
    }
  }

  if (isLoading || !user) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-gear" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Paramètres
        </h2>
        <p className={styles.sectionSubtitle}>Gérez vos informations personnelles et la sécurité de votre compte.</p>
      </div>

      {/* ---- Compte ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-person-fill" style={{ color: "var(--primary)" }} />
            Compte
          </h3>
          <form onSubmit={handleSubmitAccount}>
            <Banner banner={accountBanner} />
            <TextField
              label="Prénom"
              name="prenom"
              value={accountDraft.prenom}
              onChange={(e) => setAccountDraft((d) => ({ ...d, prenom: e.target.value }))}
              required
            />
            <TextField
              label="Nom"
              name="nom"
              value={accountDraft.nom}
              onChange={(e) => setAccountDraft((d) => ({ ...d, nom: e.target.value }))}
              required
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={accountDraft.email}
              onChange={(e) => setAccountDraft((d) => ({ ...d, email: e.target.value }))}
              required
            />
            <div className={styles.editActions} style={{ marginTop: "1rem" }}>
              <button type="submit" className={styles.btn} disabled={accountBusy}>
                <i className="bi bi-check-lg" />
                {accountBusy ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ---- Profil ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-card-heading" style={{ color: "var(--primary)" }} />
            Profil
          </h3>
          <form onSubmit={handleSubmitProfile}>
            <Banner banner={profileBanner} />
            <TextField
              label="Téléphone"
              name="telephone"
              type="tel"
              value={profileDraft.telephone}
              onChange={(e) => setProfileDraft((d) => ({ ...d, telephone: e.target.value }))}
              placeholder="+212 6 00 00 00 00"
            />
            <TextField
              label="Adresse"
              name="adresse"
              value={profileDraft.adresse}
              onChange={(e) => setProfileDraft((d) => ({ ...d, adresse: e.target.value }))}
            />
            <TextField
              label="Date de naissance"
              name="date_naissance"
              type="date"
              value={profileDraft.date_naissance}
              onChange={(e) => setProfileDraft((d) => ({ ...d, date_naissance: e.target.value }))}
            />
            <TextField
              label="Pièce d'identité (référence)"
              name="piece_identite"
              value={profileDraft.piece_identite}
              onChange={(e) => setProfileDraft((d) => ({ ...d, piece_identite: e.target.value }))}
              placeholder="N° CIN, passeport..."
            />
            <div className={styles.editActions} style={{ marginTop: "1rem" }}>
              <button type="submit" className={styles.btn} disabled={profileBusy}>
                <i className="bi bi-check-lg" />
                {profileBusy ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ---- Sécurité ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-shield-lock-fill" style={{ color: "var(--primary)" }} />
            Sécurité
          </h3>
          <form onSubmit={handleSubmitPassword}>
            <Banner banner={passwordBanner} />
            <TextField
              label="Nouveau mot de passe"
              name="mot_de_passe"
              type="password"
              value={passwordDraft.mot_de_passe}
              onChange={(e) => setPasswordDraft((d) => ({ ...d, mot_de_passe: e.target.value }))}
              hint="8 caractères minimum"
              minLength={8}
              required
            />
            <TextField
              label="Confirmer le mot de passe"
              name="confirmation"
              type="password"
              value={passwordDraft.confirmation}
              onChange={(e) => setPasswordDraft((d) => ({ ...d, confirmation: e.target.value }))}
              minLength={8}
              required
            />
            <div className={styles.editActions} style={{ marginTop: "1rem" }}>
              <button type="submit" className={styles.btn} disabled={passwordBusy}>
                <i className="bi bi-check-lg" />
                {passwordBusy ? "Enregistrement..." : "Mettre à jour le mot de passe"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
