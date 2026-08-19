"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchAllBlogPosts,
  createBlogPost,
  deleteBlogPost,
  revalidatePublicBlog,
  BLOG_POST_STATUS,
  BLOG_POST_STATUS_LABELS,
} from "@/lib/blog";
import Drawer from "@/components/Drawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import { useToast, ToastStack } from "@/components/Toast";
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

function statusBadgeClass(statut) {
  return statut === BLOG_POST_STATUS.PUBLISHED ? styles.badgeActive : styles.badgeSuspended;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const EMPTY_DRAFT = { title: "", slug: "", description: "", excerpt: "", keywords: "" };

export default function AdminBlogPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { toasts, showToast, dismissToast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        setPosts(await fetchAllBlogPosts());
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setSlugTouched(false);
    setCreateError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  function handleTitleChange(value) {
    setDraft((d) => ({ ...d, title: value, slug: slugTouched ? d.slug : slugify(value) }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createBlogPost({
        slug: draft.slug,
        title: draft.title,
        description: draft.description,
        excerpt: draft.excerpt,
        keywords: draft.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      router.push(`/backoffice/admin/blog/${created.id}`);
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteBlogPost(deleteTarget.id);
      revalidatePublicBlog({ slug: deleteTarget.slug });
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast(t("bo.adminBlog.deletedMessage"), "success");
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {loadError && <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-newspaper" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.adminBlog.title")}
            </h2>
            <p className={styles.sectionSubtitle}>{t("bo.adminBlog.subtitle", { count: posts.length })}</p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            {t("bo.adminBlog.newPost")}
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.adminBlog.colTitle")}</th>
                <th>{t("bo.adminBlog.colStatus")}</th>
                <th>{t("bo.adminBlog.colPublishedAt")}</th>
                <th>{t("bo.adminBlog.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    {t("bo.adminBlog.noPosts")}
                  </td>
                </tr>
              )}
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <span className={styles.userName}>{post.title}</span>
                    <div className={styles.tableSubtext}>/{post.slug}</div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusBadgeClass(post.statut)}`}>
                      {BLOG_POST_STATUS_LABELS[post.statut]}
                    </span>
                  </td>
                  <td>{formatDate(post.published_at)}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => router.push(`/backoffice/admin/blog/${post.id}`)}
                        title={t("bo.adminBlog.editTitle")}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => setDeleteTarget(post)}
                        title={t("bo.adminBlog.deleteTitle")}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer isOpen={createOpen} onClose={closeCreate} title={<h3>{t("bo.adminBlog.createDrawerTitle")}</h3>}>
        <Banner banner={createError ? { type: "error", message: createError } : null} />
        <form onSubmit={handleCreate}>
          <TextField
            label={t("bo.adminBlog.titleLabel")}
            name="title"
            value={draft.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
          <TextField
            label={t("bo.adminBlog.slugLabel")}
            name="slug"
            value={draft.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
            }}
            hint={t("bo.adminBlog.slugHint")}
            required
          />
          <TextField
            label={t("bo.adminBlog.excerptLabel")}
            name="excerpt"
            as="textarea"
            rows={3}
            value={draft.excerpt}
            onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
            hint={t("bo.adminBlog.excerptHint")}
          />
          <TextField
            label={t("bo.adminBlog.descriptionLabel")}
            name="description"
            as="textarea"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            hint={t("bo.adminBlog.descriptionHint")}
          />
          <TextField
            label={t("bo.adminBlog.keywordsLabel")}
            name="keywords"
            value={draft.keywords}
            onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
            hint={t("bo.adminBlog.keywordsHint")}
          />
          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-arrow-right" />
              {createBusy ? t("bo.adminBlog.creating") : t("bo.adminBlog.createAndWrite")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              {t("bo.adminBlog.cancel")}
            </button>
          </div>
        </form>
      </Drawer>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t("bo.adminBlog.deletePostTitle")}
        message={deleteTarget ? t("bo.adminBlog.deletePostMessage", { title: deleteTarget.title }) : ""}
        confirmLabel={t("bo.adminBlog.delete")}
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
