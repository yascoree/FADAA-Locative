"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchBlogPostById,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogCoverImage,
  uploadBlogInlineImage,
  BLOG_POST_STATUS,
} from "@/lib/blog";
import BlogEditor from "@/components/BlogEditor";
import TextField from "@/components/TextField";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { useToast, ToastStack } from "@/components/Toast";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../../admin.module.css";

export default function AdminBlogEditPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const postId = Number(params.id);

  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [draft, setDraft] = useState({ title: "", slug: "", description: "", excerpt: "", keywords: "" });
  const [contentHtml, setContentHtml] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const [coverBusy, setCoverBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchBlogPostById(postId);
        setPost(data);
        setDraft({
          title: data.title,
          slug: data.slug,
          description: data.description || "",
          excerpt: data.excerpt || "",
          keywords: (data.keywords || []).join(", "),
        });
        setContentHtml(data.content_html || "");
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [postId]);

  async function handleSave() {
    setSaveBusy(true);
    try {
      const updated = await updateBlogPost(postId, {
        title: draft.title,
        slug: draft.slug,
        description: draft.description || null,
        excerpt: draft.excerpt || null,
        keywords: draft.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        content_html: contentHtml,
      });
      setPost(updated);
      showToast(t("bo.adminBlog.savedMessage"), "success");
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleTogglePublish() {
    setSaveBusy(true);
    try {
      const nextStatus =
        post.statut === BLOG_POST_STATUS.PUBLISHED ? BLOG_POST_STATUS.DRAFT : BLOG_POST_STATUS.PUBLISHED;
      const updated = await updateBlogPost(postId, { statut: nextStatus });
      setPost(updated);
      showToast(
        nextStatus === BLOG_POST_STATUS.PUBLISHED
          ? t("bo.adminBlog.publishedMessage")
          : t("bo.adminBlog.unpublishedMessage"),
        "success"
      );
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleCoverChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    try {
      const updated = await uploadBlogCoverImage(postId, file);
      setPost(updated);
    } catch (err) {
      showToast(extractErrorMessage(err), "error");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleUploadInlineImage(file) {
    return uploadBlogInlineImage(postId, file);
  }

  async function handleConfirmDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteBlogPost(postId);
      router.push("/backoffice/admin/blog");
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  if (loadError || !post) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || t("bo.adminBlog.notFound")}</div>;
  }

  const isPublished = post.statut === BLOG_POST_STATUS.PUBLISHED;

  return (
    <div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className={styles.section}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <button type="button" className={styles.btnOutline} onClick={() => router.push("/backoffice/admin/blog")}>
            <i className="bi bi-arrow-left" /> {t("bo.adminBlog.back")}
          </button>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button type="button" className={styles.btnOutline} onClick={handleTogglePublish} disabled={saveBusy}>
              <i className={`bi ${isPublished ? "bi-eye-slash" : "bi-globe"}`} />
              {isPublished ? t("bo.adminBlog.unpublish") : t("bo.adminBlog.publish")}
            </button>
            <button type="button" className={styles.btn} onClick={handleSave} disabled={saveBusy}>
              <i className="bi bi-check-lg" />
              {saveBusy ? t("bo.adminBlog.saving") : t("bo.adminBlog.save")}
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              onClick={() => setDeleteOpen(true)}
              title={t("bo.adminBlog.deletePostTitle")}
            >
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <TextField
            label={t("bo.adminBlog.titleLabel")}
            name="title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <TextField
            label={t("bo.adminBlog.slugLabel")}
            name="slug"
            value={draft.slug}
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
          />

          <label className={styles.field} style={{ display: "block", marginTop: "0.6rem" }}>
            {t("bo.adminBlog.coverLabel")}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.4rem" }}>
              {post.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_BASE_URL}${post.cover_image_url}`}
                  alt=""
                  style={{ width: 120, height: 70, objectFit: "cover", borderRadius: 8 }}
                />
              )}
              <label className={styles.btnOutline} style={{ cursor: "pointer" }}>
                <i className="bi bi-upload" />
                {coverBusy ? t("bo.adminBlog.uploadingImage") : t("bo.adminBlog.changeCover")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={coverBusy}
                  onChange={handleCoverChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </label>

          <TextField
            label={t("bo.adminBlog.excerptLabel")}
            name="excerpt"
            as="textarea"
            rows={3}
            value={draft.excerpt}
            onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
          />
          <TextField
            label={t("bo.adminBlog.descriptionLabel")}
            name="description"
            as="textarea"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <TextField
            label={t("bo.adminBlog.keywordsLabel")}
            name="keywords"
            value={draft.keywords}
            onChange={(e) => setDraft((d) => ({ ...d, keywords: e.target.value }))}
            hint={t("bo.adminBlog.keywordsHint")}
          />

          <label className={styles.field} style={{ display: "block", marginTop: "0.6rem" }}>
            {t("bo.adminBlog.contentLabel")}
            <div style={{ marginTop: "0.4rem" }}>
              <BlogEditor content={contentHtml} onChange={setContentHtml} onUploadImage={handleUploadInlineImage} />
            </div>
          </label>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t("bo.adminBlog.deletePostTitle")}
        message={t("bo.adminBlog.deletePostMessage", { title: post.title })}
        confirmLabel={t("bo.adminBlog.delete")}
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
