/** Pictogramme de marque FADAA Locative — asset réel exporté du logo officiel,
    recoloré selon le thème de la page (contour doré d'origine remplacé par
    la teinte locale : olive foncé sur fond clair, blanc sur fond sombre). */
export default function LogoIcon({ size = 16, className, tone = "dark" }) {
  const src = tone === "light" ? "/fadaa-icon-light.png" : "/fadaa-icon-dark.png";
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}
