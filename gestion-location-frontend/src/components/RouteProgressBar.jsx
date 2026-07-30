"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./ui.module.css";

/** Fine barre colorée qui balaie le haut de l'écran à chaque changement de page
    (clic dans la sidebar) — la navigation App Router étant quasi instantanée
    côté client, ce n'est pas une vraie mesure de chargement mais un repère
    visuel de transition, façon Vercel/YouTube. Ignore le tout premier rendu
    (pas de barre au chargement initial de la page). */
export default function RouteProgressBar() {
  const pathname = usePathname();
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }
    setPhase("running");
    const toComplete = setTimeout(() => setPhase("done"), 180);
    const toHide = setTimeout(() => setPhase("idle"), 550);
    return () => {
      clearTimeout(toComplete);
      clearTimeout(toHide);
    };
  }, [pathname]);

  if (phase === "idle") return null;

  return <div className={`${styles.routeProgress} ${phase === "done" ? styles.routeProgressDone : ""}`} />;
}
