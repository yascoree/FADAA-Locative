import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Conditions d'utilisation — FADAA Locative" };

export default function ConditionsUtilisationPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updatedAt="28 juillet 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions d&apos;utilisation régissent l&apos;accès et l&apos;usage de la plateforme FADAA
        Locative par ses utilisateurs (propriétaires, agences, gestionnaires et locataires). En créant un compte,
        vous acceptez sans réserve l&apos;ensemble des dispositions décrites ci-dessous.
      </p>

      <h2>2. Accès au service</h2>
      <p>
        L&apos;accès à la plateforme est réservé aux personnes disposant d&apos;un compte valide. Chaque utilisateur
        est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.
      </p>

      <h2>3. Utilisation du service</h2>
      <p>
        Vous vous engagez à utiliser la plateforme conformément à sa destination : gestion de biens, de baux, de
        paiements et des permissions associées. Toute utilisation frauduleuse, abusive ou contraire à la loi pourra
        entraîner la suspension ou la suppression du compte concerné.
      </p>

      <h2>4. Données et contenus</h2>
      <p>
        Les données saisies sur la plateforme (biens, baux, paiements, documents) restent la propriété de
        l&apos;utilisateur ou de l&apos;organisation qui les a créées. FADAA Locative s&apos;engage à ne les
        utiliser que dans le cadre de la fourniture du service.
      </p>

      <h2>5. Responsabilité</h2>
      <p>
        FADAA Locative met tout en œuvre pour assurer la disponibilité et la fiabilité du service, sans pouvoir
        garantir une absence totale d&apos;interruption. La plateforme ne saurait être tenue responsable des
        litiges relevant de la relation contractuelle entre propriétaires, agences et locataires.
      </p>

      <h2>6. Modification des conditions</h2>
      <p>
        Ces conditions peuvent être amenées à évoluer. Les utilisateurs seront informés de toute modification
        substantielle avant son entrée en vigueur.
      </p>

      <h2>7. Contact</h2>
      <p>
        Pour toute question relative à ces conditions, vous pouvez nous contacter via les moyens indiqués sur la
        page d&apos;accueil de la plateforme.
      </p>
    </LegalPage>
  );
}
