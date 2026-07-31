"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { updateUser } from "@/lib/users";
import { fetchProfile, createProfile, updateProfile, uploadProfilePhoto, deleteProfilePhoto } from "@/lib/profile";
import TextField from "@/components/TextField";
import PasswordChangeCard from "@/components/PasswordChangeCard";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "../proprietaire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

const EMPTY_PROFILE = { telephone: "", adresse: "", date_naissance: "", piece_identite: "" };

export default function ProprietaireParametresPage() {
  const { user, refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileBanner, setProfileBanner] = useState(null);

  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoBanner, setPhotoBanner] = useState(null);

  const [accountDraft, setAccountDraft] = useState({ prenom: "", nom: "", email: "" });
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountBanner, setAccountBanner] = useState(null);

  const [passwordSuccessBanner, setPasswordSuccessBanner] = useState(null);

  useEffect(() => {
    if (!user) return;

    async function init() {
      setAccountDraft({ prenom: user.prenom, nom: user.nom, email: user.email });
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
        setPhotoUrl(profile.photo ? `${API_BASE_URL}${profile.photo}` : null);
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

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoBanner(null);
    try {
      const updated = await uploadProfilePhoto(user.id, file);
      setProfileExists(true);
      setPhotoUrl(updated.photo ? `${API_BASE_URL}${updated.photo}` : null);
      await refreshUser();
    } catch (err) {
      setPhotoBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    setPhotoBusy(true);
    setPhotoBanner(null);
    try {
      await deleteProfilePhoto(user.id);
      setPhotoUrl(null);
      await refreshUser();
    } catch (err) {
      setPhotoBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
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

      {/* ---- Apparence ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-palette-fill" style={{ color: "var(--primary)" }} />
            Apparence
          </h3>
          <p className={styles.sectionSubtitle} style={{ margin: "-0.4rem 0 1rem" }}>
            Choisissez le thème de votre interface — le choix est mémorisé sur cet appareil.
          </p>
          <ThemeToggle />
        </div>
      </div>

      {/* ---- Compte ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-person-fill" style={{ color: "var(--primary)" }} />
            Compte
          </h3>

          <Banner banner={photoBanner} />
          <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginBottom: "1.3rem" }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                style={{ width: "4.2rem", height: "4.2rem", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span className={styles.avatar} style={{ width: "4.2rem", height: "4.2rem", fontSize: "1.3rem" }}>
                {`${user.prenom?.[0] || ""}${user.nom?.[0] || ""}`.toUpperCase() || "?"}
              </span>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <label className={styles.btnOutline} style={{ cursor: photoBusy ? "not-allowed" : "pointer" }}>
                <i className="bi bi-camera-fill" />
                {photoBusy ? "..." : "Changer la photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy}
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />
              </label>
              {photoUrl && (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={handlePhotoRemove}
                  disabled={photoBusy}
                  title="Retirer la photo"
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          </div>

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
      <Banner banner={passwordSuccessBanner} />
      <PasswordChangeCard
        styles={styles}
        userId={user.id}
        onSuccess={() => setPasswordSuccessBanner({ type: "success", message: "Mot de passe mis à jour." })}
      />
    </div>
  );
}
