"use client";

import { usePathname } from "next/navigation";

/** Rejoue un fondu/glissement doux à chaque changement de page (voir .page-transition
    dans app/globals.css) — la key sur le pathname force React à remonter le wrapper
    donc à rejouer l'animation CSS. */
export default function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
