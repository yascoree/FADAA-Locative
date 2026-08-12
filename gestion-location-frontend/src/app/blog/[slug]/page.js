import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import BlogPostBody from "@/components/blog/BlogPostBody";
import { BLOG_POSTS, getAllBlogSlugs, getBlogPost } from "@/lib/blogPosts";
import { SITE_URL } from "../../layout";
import styles from "@/components/blog/blog.module.css";
import landingStyles from "../../landing.module.css";

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
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
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
    },
    twitter: { title: post.title, description: post.description },
  };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { "@type": "Organization", name: "FADAA Locative" },
    publisher: { "@type": "Organization", name: "FADAA Locative", url: SITE_URL },
    mainEntityOfPage: url,
  };

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

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
            <span>{formatDate(post.publishedAt)}</span>
            <span>·</span>
            <span>{post.readingTime} de lecture</span>
          </div>

          <BlogPostBody content={post.content} />

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
                  <span className={styles.cardMeta}>{formatDate(p.publishedAt)}</span>
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
