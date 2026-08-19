import Link from "next/link";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import { API_BASE_URL } from "@/lib/apiClient";
import { SITE_URL } from "../layout";
import styles from "@/components/blog/blog.module.css";
import landingStyles from "../landing.module.css";

const TITLE = "Blog — Gestion locative et immobilière au Maroc";
const DESCRIPTION =
  "Conseils, guides et bonnes pratiques sur la gestion locative, la gestion immobilière et le suivi des loyers au Maroc, par l'équipe FADAA Locative.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/blog` },
  twitter: { title: TITLE, description: DESCRIPTION },
};

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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

export default async function BlogIndexPage() {
  const posts = (await loadPosts()).sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  return (
    <div className={landingStyles.page}>
      <NavBar />
      <div className={styles.page}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Blog FADAA Locative</span>
          <h1 className={styles.title}>Gestion locative et immobilière : conseils et guides</h1>
          <p className={styles.subtitle}>{DESCRIPTION}</p>
        </div>

        <div className={styles.grid}>
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
              <span className={styles.cardMeta}>
                {formatDate(post.published_at)}
                {post.reading_time ? ` · ${post.reading_time}` : ""}
              </span>
              <h2 className={styles.cardTitle}>{post.title}</h2>
              <p className={styles.cardExcerpt}>{post.excerpt}</p>
              <span className={styles.cardReadMore}>
                Lire l&apos;article <i className="bi bi-arrow-right" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
