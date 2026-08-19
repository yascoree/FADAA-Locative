"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { fetchUsers } from "@/lib/subscriptions";
import {
  ACCOUNT_STATUS,
  accountStatusLabels,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
} from "@/lib/users";
import { ROLES, roleLabels } from "@/lib/roles";
import { useAuth } from "@/context/AuthContext";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import Drawer from "@/components/Drawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterSelect from "@/components/FilterSelect";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function badgeClass(status) {
  if (status === ACCOUNT_STATUS.ACTIF) return styles.badgeActive;
  if (status === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return styles.badgeSuspended;
  return styles.badgeExpired;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const EMPTY_FORM = {
  nom: "",
  prenom: "",
  email: "",
  role: String(ROLES.PROPRIETAIRE),
  statut_compte: String(ACCOUNT_STATUS.ACTIF),
  mot_de_passe: "",
};

const PAGE_SIZE = 10;

export default function AdminUtilisateursPage() {
  const { t } = useLanguage();
  const ROLE_LABELS = useMemo(() => roleLabels(t), [t]);
  const ACCOUNT_STATUS_LABELS = useMemo(() => accountStatusLabels(t), [t]);
  const ROLE_OPTIONS = useMemo(
    () => Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    [ROLE_LABELS]
  );
  const STATUS_OPTIONS = useMemo(
    () => Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [ACCOUNT_STATUS_LABELS]
  );
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formTargetId, setFormTargetId] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formBanner, setFormBanner] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rowBanner, setRowBanner] = useState(null);
  const [rowBusyId, setRowBusyId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const list = await fetchUsers();
        setUsers(list);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const stats = useMemo(() => {
    const actifs = users.filter((u) => u.statut_compte === ACCOUNT_STATUS.ACTIF).length;
    const enAttente = users.filter((u) => u.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE).length;
    const desactives = users.filter((u) => u.statut_compte === ACCOUNT_STATUS.CREE_SANS_ACCES).length;
    return { total: users.length, actifs, enAttente, desactives };
  }, [users]);

  const roleDistribution = useMemo(() => {
    const dist = Object.entries(ROLE_LABELS).map(([value, label]) => ({
      role: Number(value),
      label,
      count: users.filter((u) => u.role === Number(value)).length,
    }));
    const maxCount = Math.max(1, ...dist.map((d) => d.count));
    return { dist, maxCount };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (term) {
        const haystack = [u.prenom, u.nom, u.email, ROLE_LABELS[u.role], formatDate(u.date_creation)]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (roleFilter && String(u.role) !== roleFilter) return false;
      if (statusFilter && String(u.statut_compte) !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;

  function openCreate() {
    setFormMode("create");
    setFormTargetId(null);
    setFormDraft(EMPTY_FORM);
    setFormBanner(null);
    setFormOpen(true);
  }

  function openEdit(u) {
    setFormMode("edit");
    setFormTargetId(u.id);
    setFormDraft({
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      role: String(u.role),
      statut_compte: String(u.statut_compte),
      mot_de_passe: "",
    });
    setFormBanner(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (formBusy) return;
    setFormOpen(false);
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormBusy(true);
    setFormBanner(null);
    try {
      if (formMode === "create") {
        const payload = {
          nom: formDraft.nom,
          prenom: formDraft.prenom,
          email: formDraft.email,
          role: Number(formDraft.role),
          statut_compte: Number(formDraft.statut_compte),
          mot_de_passe: formDraft.mot_de_passe,
        };
        const created = await createUser(payload);
        setUsers((prev) => [...prev, created]);
      } else {
        const payload = {
          nom: formDraft.nom,
          prenom: formDraft.prenom,
          email: formDraft.email,
          role: Number(formDraft.role),
          statut_compte: Number(formDraft.statut_compte),
        };
        if (formDraft.mot_de_passe) payload.mot_de_passe = formDraft.mot_de_passe;
        const updated = await updateUser(formTargetId, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      }
      setFormOpen(false);
    } catch (err) {
      setFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setFormBusy(false);
    }
  }

  async function handleToggleActive(u) {
    setRowBanner(null);
    setRowBusyId(u.id);
    try {
      const updated =
        u.statut_compte === ACCOUNT_STATUS.CREE_SANS_ACCES ? await activateUser(u.id) : await deactivateUser(u.id);
      setUsers((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setRowBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setRowBanner({ type: "error", message: extractErrorMessage(err) });
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return <p>{t("bo.adminUtilisateurs.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-people-fill" tone="primary" label={t("bo.adminUtilisateurs.statTotal")} value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.adminUtilisateurs.statActive")} value={stats.actifs} />
          <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.adminUtilisateurs.statPending")} value={stats.enAttente} />
          <StatCard icon="bi-slash-circle-fill" tone="danger" label={t("bo.adminUtilisateurs.statDisabled")} value={stats.desactives} />
        </div>
      </div>

      {/* ---- Répartition par rôle ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <i className="bi bi-pie-chart-fill" style={{ color: "var(--primary)" }} />
            {t("bo.adminUtilisateurs.distributionTitle")}
          </h2>
          <div className={styles.distribution}>
            {roleDistribution.dist.map(({ role, label, count }) => (
              <div className={styles.distributionRow} key={role}>
                <span className={styles.distributionName}>{label}</span>
                <div className={styles.distributionTrack}>
                  <div
                    className={styles.distributionFill}
                    style={{ width: `${(count / roleDistribution.maxCount) * 100}%` }}
                  />
                </div>
                <span className={styles.distributionCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Table des utilisateurs ---- */}
      <div className={styles.section}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.adminUtilisateurs.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.adminUtilisateurs.subtitle", { shown: filteredUsers.length, total: users.length })}
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            {t("bo.adminUtilisateurs.newUser")}
          </button>
        </div>

        <Banner banner={rowBanner} />

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder={t("bo.adminUtilisateurs.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: t("bo.adminUtilisateurs.allRoles") }, ...ROLE_OPTIONS]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: t("bo.adminUtilisateurs.allStatuses") }, ...STATUS_OPTIONS]}
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.adminUtilisateurs.colUser")}</th>
                <th>{t("bo.adminUtilisateurs.colEmail")}</th>
                <th>{t("bo.adminUtilisateurs.colRole")}</th>
                <th>{t("bo.adminUtilisateurs.colStatus")}</th>
                <th>{t("bo.adminUtilisateurs.colCreatedOn")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {t("bo.adminUtilisateurs.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedUsers.map((u) => {
                const initials = `${u.prenom?.[0] || ""}${u.nom?.[0] || ""}`.toUpperCase();
                return (
                  <tr
                    key={u.id}
                    className={`${styles.tableRowClickable} ${selectedUserId === u.id ? styles.tableRowActive : ""}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    <td>
                      <div className={styles.userCell}>
                        {u.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE_URL}${u.photo}`}
                            alt=""
                            className={styles.avatarSm}
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className={styles.avatarSm}>{initials || "?"}</span>
                        )}
                        <span className={styles.userName}>
                          {u.prenom} {u.nom}
                        </span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(u.statut_compte)}`}>
                        {ACCOUNT_STATUS_LABELS[u.statut_compte]}
                      </span>
                    </td>
                    <td>{formatDate(u.date_creation)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.adminUtilisateurs.pageOf", { page: safePage, total: totalPages, count: filteredUsers.length })}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  {t("bo.adminUtilisateurs.previous")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("bo.adminUtilisateurs.next")}
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Détail d'un utilisateur ---- */}
      <Drawer
        isOpen={!!selectedUser}
        onClose={() => setSelectedUserId(null)}
        title={selectedUser ? `${selectedUser.prenom} ${selectedUser.nom}` : ""}
      >
        {selectedUser && (() => {
          const isSelf = currentUser?.id === selectedUser.id;
          const isDisabled = selectedUser.statut_compte === ACCOUNT_STATUS.CREE_SANS_ACCES;
          const isBusy = rowBusyId === selectedUser.id;
          return (
            <>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
                <span className={styles.badge}>{ROLE_LABELS[selectedUser.role]}</span>
                <span className={`${styles.badge} ${badgeClass(selectedUser.statut_compte)}`}>
                  {ACCOUNT_STATUS_LABELS[selectedUser.statut_compte]}
                </span>
              </div>

              {!isSelf && (
                <button
                  type="button"
                  className={styles.btn}
                  style={{ width: "100%", marginBottom: "1.25rem" }}
                  onClick={() =>
                    router.push(`/backoffice/admin/messagerie?tab=conversations&user=${selectedUser.id}`)
                  }
                >
                  <i className="bi bi-chat-dots-fill" />
                  {t("bo.adminUtilisateurs.sendMessage")}
                </button>
              )}

              <div className={styles.detailInfoList}>
                <div className={styles.detailInfoRow}>
                  <span className={styles.detailInfoIcon}>
                    <i className="bi bi-envelope" />
                  </span>
                  <span className={styles.detailInfoBody}>
                    <span className={styles.detailInfoLabel}>{t("bo.adminUtilisateurs.colEmail")}</span>
                    <span className={styles.detailInfoValue}>{selectedUser.email}</span>
                  </span>
                </div>
                <div className={styles.detailInfoRow}>
                  <span className={styles.detailInfoIcon}>
                    <i className="bi bi-calendar-event" />
                  </span>
                  <span className={styles.detailInfoBody}>
                    <span className={styles.detailInfoLabel}>{t("bo.adminUtilisateurs.colCreatedOn")}</span>
                    <span className={styles.detailInfoValue}>{formatDate(selectedUser.date_creation)}</span>
                  </span>
                </div>
              </div>

              <div className={styles.editActions} style={{ marginTop: "1.5rem" }}>
                <button type="button" className={styles.btnOutline} onClick={() => openEdit(selectedUser)}>
                  <i className="bi bi-pencil" />
                  {t("bo.adminUtilisateurs.edit")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => handleToggleActive(selectedUser)}
                  disabled={isSelf || isBusy}
                  title={isSelf ? t("bo.adminUtilisateurs.selfActionBlocked") : ""}
                >
                  <i className={`bi ${isDisabled ? "bi-play-circle" : "bi-pause-circle"}`} />
                  {isDisabled ? t("bo.adminUtilisateurs.activate") : t("bo.adminUtilisateurs.deactivate")}
                </button>
                <button
                  type="button"
                  className={`${styles.btnOutline} ${styles.iconBtnDanger}`}
                  onClick={() => setDeleteTarget(selectedUser)}
                  disabled={isSelf}
                  title={isSelf ? t("bo.adminUtilisateurs.selfActionBlocked") : ""}
                >
                  <i className="bi bi-trash" />
                  {t("bo.adminUtilisateurs.delete")}
                </button>
              </div>
            </>
          );
        })()}
      </Drawer>

      {/* ---- Créer / modifier un utilisateur ---- */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={formMode === "create" ? t("bo.adminUtilisateurs.createTitle") : t("bo.adminUtilisateurs.editTitle")}
      >
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          <TextField
            label={t("bo.adminUtilisateurs.firstNameLabel")}
            name="prenom"
            value={formDraft.prenom}
            onChange={(e) => setFormDraft((d) => ({ ...d, prenom: e.target.value }))}
            required
          />
          <TextField
            label={t("bo.adminUtilisateurs.lastNameLabel")}
            name="nom"
            value={formDraft.nom}
            onChange={(e) => setFormDraft((d) => ({ ...d, nom: e.target.value }))}
            required
          />
          <TextField
            label={t("bo.adminUtilisateurs.emailLabel")}
            name="email"
            type="email"
            value={formDraft.email}
            onChange={(e) => setFormDraft((d) => ({ ...d, email: e.target.value }))}
            required
          />
          <SelectField
            label={t("bo.adminUtilisateurs.roleLabel")}
            name="role"
            options={ROLE_OPTIONS}
            value={formDraft.role}
            onChange={(e) => setFormDraft((d) => ({ ...d, role: e.target.value }))}
          />
          <SelectField
            label={t("bo.adminUtilisateurs.accountStatusLabel")}
            name="statut_compte"
            options={STATUS_OPTIONS}
            value={formDraft.statut_compte}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut_compte: e.target.value }))}
          />
          <TextField
            label={formMode === "create" ? t("bo.adminUtilisateurs.passwordLabel") : t("bo.adminUtilisateurs.newPasswordLabel")}
            name="mot_de_passe"
            type="password"
            value={formDraft.mot_de_passe}
            onChange={(e) => setFormDraft((d) => ({ ...d, mot_de_passe: e.target.value }))}
            hint={t("bo.adminUtilisateurs.passwordHint")}
            required={formMode === "create"}
            minLength={8}
          />
          <div className={styles.editActions}>
            <button type="submit" className={styles.btn} disabled={formBusy}>
              <i className="bi bi-check-lg" />
              {formBusy ? t("bo.adminUtilisateurs.saving") : t("bo.adminUtilisateurs.save")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeForm} disabled={formBusy}>
              <i className="bi bi-x-lg" />
              {t("bo.adminUtilisateurs.cancel")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Confirmation de suppression ---- */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t("bo.adminUtilisateurs.deleteUserTitle")}
        message={
          deleteTarget
            ? t("bo.adminUtilisateurs.deleteUserConfirm", {
                prenom: deleteTarget.prenom,
                nom: deleteTarget.nom,
                email: deleteTarget.email,
              })
            : ""
        }
        confirmLabel={t("bo.adminUtilisateurs.delete")}
        danger
        isBusy={deleteBusy}
      />
    </div>
  );
}
