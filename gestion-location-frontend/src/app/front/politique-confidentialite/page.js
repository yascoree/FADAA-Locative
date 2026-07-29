import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Politique de confidentialité — FADAA Locative" };

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="28 juillet 2026">
      <h2>1. Données collectées</h2>
      <p>
        Lors de la création d&apos;un compte et de l&apos;utilisation de la plateforme, nous collectons les données
        nécessaires à la fourniture du service : identité, coordonnées, informations relatives aux biens, baux et
        paiements que vous gérez.
      </p>

      <h2>2. Finalités du traitement</h2>
      <p>Ces données sont utilisées pour :</p>
      <ul>
        <li>Créer et gérer votre compte et vos accès selon votre rôle ;</li>
        <li>Assurer le suivi des biens, baux, paiements et permissions ;</li>
        <li>Vous envoyer les notifications nécessaires au bon fonctionnement du service ;</li>
        <li>Améliorer la sécurité et la fiabilité de la plateforme.</li>
      </ul>

      <h2>3. Partage des données</h2>
      <p>
        Vos données ne sont partagées qu&apos;avec les personnes de votre organisation habilitées (propriétaire,
        agence, gestionnaires) selon les permissions que vous définissez. Elles ne sont jamais vendues à des tiers.
      </p>

      <h2>4. Conservation des données</h2>
      <p>
        Les données sont conservées pendant toute la durée d&apos;utilisation du compte, puis archivées ou
        supprimées conformément aux obligations légales applicables à la gestion locative.
      </p>

      <h2>5. Sécurité</h2>
      <p>
        Les échanges avec la plateforme sont chiffrés et l&apos;accès aux données est restreint selon les rôles et
        permissions attribués à chaque utilisateur.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données personnelles.
        Pour exercer ces droits, contactez-nous via les moyens indiqués sur la page d&apos;accueil de la
        plateforme.
      </p>
    </LegalPage>
  );
}
