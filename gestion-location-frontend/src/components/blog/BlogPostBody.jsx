import styles from "./blog.module.css";

/** Rendu du corps HTML d'un article (déjà sanitizé côté backend à l'écriture —
    voir app.services.blog_post_service._sanitize — avant d'être persisté et
    republié via cette page). */
export default function BlogPostBody({ contentHtml }) {
  return <div className={styles.postBody} dangerouslySetInnerHTML={{ __html: contentHtml }} />;
}
