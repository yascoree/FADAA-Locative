import LandingContent from "./LandingContent";
import { SITE_URL } from "./layout";

const TITLE = "Gestion locative Maroc — Logiciel tout-en-un pour propriétaires et agences";
const DESCRIPTION =
  "Gérez vos biens, baux, loyers et locataires depuis une seule plateforme. FADAA Locative simplifie la gestion locative et immobilière au Maroc pour propriétaires et agences immobilières.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

const SOFTWARE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FADAA Locative",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "MAD",
    description: "Essai gratuit de 30 jours",
  },
};

export default function RootPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSON_LD) }}
      />
      <LandingContent />
    </>
  );
}
