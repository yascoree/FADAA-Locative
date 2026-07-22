import LoadingState from "./LoadingState";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import styles from "./ui.module.css";

/**
 * Tableau générique réutilisable pour les modules métier (Biens, Lots, Baux...).
 *
 * columns: [{ key, header, render?: (row) => node, align? }]
 * rows: tableau d'objets
 * rowKey: (row) => string|number
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  emptyIcon,
  emptyTitle = "Aucune donnée pour le moment",
  emptyDescription,
  onRowClick,
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className={styles.tableEmptyCell}>
                <LoadingState />
              </td>
            </tr>
          )}
          {!isLoading && error && (
            <tr>
              <td colSpan={columns.length} className={styles.tableEmptyCell}>
                <ErrorState message={error} onRetry={onRetry} />
              </td>
            </tr>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className={styles.tableEmptyCell}>
                <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          )}
          {!isLoading &&
            !error &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
