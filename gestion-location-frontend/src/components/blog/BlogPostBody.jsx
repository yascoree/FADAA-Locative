import styles from "./blog.module.css";

/** Rendu des blocs de contenu d'un article (voir src/lib/blogPosts.js) — pas de
    parseur markdown : chaque bloc a déjà un type explicite (p/h2/list). */
export default function BlogPostBody({ content }) {
  return (
    <div className={styles.postBody}>
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
                <li key={j}>{item}</li>
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
    </div>
  );
}
