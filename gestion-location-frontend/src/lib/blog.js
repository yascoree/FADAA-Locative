import apiClient from "@/lib/apiClient";

export const BLOG_POST_STATUS = { DRAFT: 1, PUBLISHED: 2 };
export const BLOG_POST_STATUS_LABELS = { 1: "Brouillon", 2: "Publié" };

// ---- Public ----

export async function fetchBlogPosts() {
  const { data } = await apiClient.get("/blog/posts");
  return data;
}

export async function fetchBlogPost(slug) {
  const { data } = await apiClient.get(`/blog/posts/${slug}`);
  return data;
}

// ---- Admin ----

export async function fetchAllBlogPosts() {
  const { data } = await apiClient.get("/blog/admin/posts");
  return data;
}

export async function fetchBlogPostById(postId) {
  const { data } = await apiClient.get(`/blog/admin/posts/${postId}`);
  return data;
}

export async function createBlogPost({ slug, title, description, excerpt, keywords, readingTime }) {
  const { data } = await apiClient.post("/blog/admin/posts", {
    slug,
    title,
    description: description || null,
    excerpt: excerpt || null,
    keywords: keywords?.length ? keywords : null,
    reading_time: readingTime || null,
  });
  return data;
}

export async function updateBlogPost(postId, changes) {
  const { data } = await apiClient.put(`/blog/admin/posts/${postId}`, changes);
  return data;
}

export async function deleteBlogPost(postId) {
  await apiClient.delete(`/blog/admin/posts/${postId}`);
}

// La page publique (/blog, /blog/[slug]) met le backend en cache 60s (voir
// `next: { revalidate: 60 }` côté fetch) — à appeler juste après une mutation
// admin réussie (publier/dépublier/enregistrer/supprimer) pour que le
// changement soit visible dès le prochain chargement plutôt que d'attendre le
// TTL. Best-effort : un échec ici ne doit jamais faire échouer l'action admin
// elle-même, le TTL reste le filet de sécurité.
export async function revalidatePublicBlog({ slug, previousSlug } = {}) {
  try {
    await fetch("/api/revalidate-blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, previousSlug }),
    });
  } catch {
    // Silencieux : voir commentaire ci-dessus.
  }
}

export async function uploadBlogCoverImage(postId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/blog/admin/posts/${postId}/cover`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadBlogInlineImage(postId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/blog/admin/posts/${postId}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}
