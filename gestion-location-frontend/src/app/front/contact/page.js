import ContactContent from "./ContactContent";

const TITLE = "Contact — Parlez à notre équipe";
const DESCRIPTION =
  "Contactez FADAA Locative pour une démo ou une question sur notre logiciel de gestion locative et immobilière au Maroc. Réponse rapide par email, téléphone ou formulaire.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/front/contact" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/front/contact" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default function ContactPage() {
  return <ContactContent />;
}
