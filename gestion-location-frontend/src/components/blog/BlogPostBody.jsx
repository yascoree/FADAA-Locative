import styles from "./blog.module.css";

/**
 * Rendu des blocs de contenu d'un article.
 * Chaque bloc possède un type explicite : p / h2 / list.
 */
export default function BlogPostBody({ content }) {
  return (
    <article className={styles.postBody}>
      {content.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2 key={i} className={styles.postH2}>
              {block.text}
            </h2>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={i} className={styles.postList}>
              {block.items.map((item, j) => (
                <li key={j} className={styles.postListItem}>
                  <span className={styles.listBullet} aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className={styles.postP}>
            {block.text}
          </p>
        );
      })}
    </article>
  );
}