export const SORT_OPTIONS = [
  { value: "recent", label: "Plus récent" },
  { value: "ancien", label: "Plus ancien" },
  { value: "alpha", label: "Ordre alphabétique" },
];

/** Trie une liste selon l'un des 3 critères communs à toutes les pages de
    l'app : date décroissante, date croissante, ou alphabétique. `dateOf`/`nameOf`
    sont des accesseurs car le champ pertinent diffère selon la ressource
    (date_creation, date_echeance, designation, nom du locataire...). */
export function sortList(items, sortBy, { dateOf, nameOf }) {
  const sorted = [...items];
  if (sortBy === "alpha" && nameOf) {
    sorted.sort((a, b) => (nameOf(a) || "").localeCompare(nameOf(b) || "", "fr", { sensitivity: "base" }));
    return sorted;
  }
  sorted.sort((a, b) => new Date(dateOf(b) || 0) - new Date(dateOf(a) || 0));
  if (sortBy === "ancien") sorted.reverse();
  return sorted;
}
