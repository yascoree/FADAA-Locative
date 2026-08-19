import Link from "next/link";
import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import { BLOG_POSTS } from "@/lib/blogPosts";
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

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return (
    <div className={landingStyles.page}>
      <NavBar />
      <div className={styles.page}>
        <div className={styles.hero}>
          {/* <span className={styles.eyebrow}>Blog FADAA Locative</span> */}
          <h1 className={styles.title}>Gestion locative et immobilière : conseils et guides</h1>
          <p className={styles.subtitle}>{DESCRIPTION}</p>
        </div>

        <div className={styles.grid}>
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
              <span className={styles.cardMeta}>
                {formatDate(post.publishedAt)} · {post.readingTime}
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
