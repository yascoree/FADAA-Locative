"use client";

import { useEffect, useRef, useState } from "react";

const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

/** Anime un nombre de sa valeur précédente (0 au premier rendu) jusqu'à `value`,
    utilisé pour les chiffres clés des dashboards. `formatter` reçoit le nombre
    courant (arrondi) à chaque frame et retourne ce qui doit s'afficher — passer
    la même fonction de formatage (ex. formatCurrency) que le reste de la page. */
export default function CountUp({ value, duration = 900, decimals = 0, formatter }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(PREFERS_REDUCED_MOTION ? target : 0);
  const fromRef = useRef(PREFERS_REDUCED_MOTION ? target : 0);

  useEffect(() => {
    function snapToTarget() {
      setDisplay(target);
      fromRef.current = target;
    }

    if (PREFERS_REDUCED_MOTION) {
      snapToTarget();
      return undefined;
    }

    const from = fromRef.current;
    if (from === target) {
      snapToTarget();
      return undefined;
    }

    const start = performance.now();
    let rafId;

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (target - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  const rounded = Number(display.toFixed(decimals));
  return <>{formatter ? formatter(rounded) : rounded.toLocaleString("fr-FR")}</>;
}
