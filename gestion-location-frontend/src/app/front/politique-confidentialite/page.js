import PolitiqueContent from "./PolitiqueContent";

const TITLE = "Politique de confidentialité";
const DESCRIPTION = "Politique de confidentialité et protection des données personnelles de FADAA Locative.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/front/politique-confidentialite" },
};

export default function PolitiqueConfidentialitePage() {
  return <PolitiqueContent />;
}
