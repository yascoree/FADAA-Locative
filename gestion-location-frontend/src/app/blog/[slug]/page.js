import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import BlogPostBody from "@/components/blog/BlogPostBody";
import { API_BASE_URL } from "@/lib/apiClient";
import { SITE_URL } from "../../layout";
import styles from "@/components/blog/blog.module.css";
import landingStyles from "../../landing.module.css";

async function loadPost(slug) {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function loadPosts() {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return {};
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || post.published_at,
    },
    twitter: { title: post.title, description: post.description },
  };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { "@type": "Organization", name: "FADAA Locative" },
    publisher: { "@type": "Organization", name: "FADAA Locative", url: SITE_URL },
    mainEntityOfPage: url,
  };

  const allPosts = await loadPosts();
  const related = allPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div className={landingStyles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <NavBar />
      <div className={styles.page}>
        <div className={styles.articleWrap}>
          <Link href="/blog" className={styles.backLink}>
            <i className="bi bi-arrow-left" /> Retour au blog
          </Link>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.articleMeta}>
            <span>{formatDate(post.published_at)}</span>
            {post.reading_time && (
              <>
                <span>·</span>
                <span>{post.reading_time} de lecture</span>
              </>
            )}
          </div>

          <BlogPostBody contentHtml={post.content_html} />

          <div className={styles.ctaBox}>
            <p>Envie de simplifier la gestion locative de vos biens ?</p>
            <Link href="/front/login?tab=register" className={styles.ctaButton}>
              Essayer FADAA Locative gratuitement <i className="bi bi-arrow-right" />
            </Link>
          </div>

          {related.length > 0 && (
            <div className={styles.grid} style={{ padding: "2.5rem 0 0", gridTemplateColumns: "1fr 1fr" }}>
              {related.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className={styles.card}>
                  <span className={styles.cardMeta}>{formatDate(p.published_at)}</span>
                  <h2 className={styles.cardTitle}>{p.title}</h2>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
