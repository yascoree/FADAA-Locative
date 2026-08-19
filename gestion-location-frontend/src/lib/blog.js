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
