import { SITE_URL } from "./layout";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // L'espace applicatif (comptes connectés) et les flux d'authentification
        // n'ont aucune valeur pour un moteur de recherche et ne doivent pas être
        // explorés — seules les pages publiques (landing, blog, contact...) le sont.
        disallow: ["/backoffice/", "/front/login", "/front/reset-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
