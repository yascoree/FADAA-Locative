import { Suspense } from "react";
import LoginContent from "./LoginContent";

const TITLE = "Connexion et inscription";
const DESCRIPTION =
  "Connectez-vous à votre espace FADAA Locative ou créez un compte gratuit en tant que propriétaire ou agence immobilière pour démarrer la gestion locative de vos biens.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: "/front/login" },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
