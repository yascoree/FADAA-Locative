import ConditionsContent from "./ConditionsContent";

const TITLE = "Conditions d'utilisation";
const DESCRIPTION = "Conditions générales d'utilisation de la plateforme FADAA Locative.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/front/conditions-utilisation" },
};

export default function ConditionsUtilisationPage() {
  return <ConditionsContent />;
}
