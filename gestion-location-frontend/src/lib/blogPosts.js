// Contenu du blog stocké en statique (pas de backend dédié) — chaque article
// est un objet de ce tableau, rendu par src/components/blog/BlogPostBody.jsx.
// Pour ajouter un article : ajouter une entrée ici avec un slug unique.
export const BLOG_POSTS = [
  {
    slug: "gestion-locative-maroc-guide",
    title: "Gestion locative au Maroc : le guide complet pour propriétaires et agences",
    description:
      "Comprendre la gestion locative au Maroc : obligations légales, encaissement des loyers, relation avec les locataires et comment un logiciel de gestion locative simplifie chaque étape.",
    keywords: ["gestion locative Maroc", "gestion immobilière", "agence immobilière"],
    publishedAt: "2026-06-02",
    updatedAt: "2026-08-01",
    readingTime: "7 min",
    excerpt:
      "Que vous soyez propriétaire d'un seul appartement ou agence gérant plusieurs dizaines de biens, la gestion locative au Maroc suit les mêmes fondamentaux. Voici comment les maîtriser.",
    content: [
      { type: "p", text: "La gestion locative regroupe l'ensemble des tâches nécessaires pour louer un bien immobilier dans de bonnes conditions et en tirer un revenu régulier : trouver un locataire fiable, rédiger le bail, encaisser les loyers, suivre les échéances, gérer la maintenance et rester en règle avec la loi. Au Maroc, ce travail repose encore largement sur des tableurs, des carnets de reçus et des relances téléphoniques — alors que le volume de biens gérés par propriétaire et par agence ne cesse d'augmenter." },
      { type: "h2", text: "Les fondamentaux de la gestion locative au Maroc" },
      { type: "p", text: "Un bail de location au Maroc doit préciser la durée, le montant du loyer, les modalités de révision et les obligations respectives du bailleur et du locataire. Au-delà du cadre légal, la gestion locative quotidienne implique trois piliers : le suivi des échéances de paiement, la traçabilité des encaissements (avec émission de quittances), et la communication avec le locataire en cas de retard ou de demande d'intervention." },
      { type: "p", text: "Pour un propriétaire qui gère un ou deux biens, ce suivi reste faisable manuellement. Il devient vite ingérable dès que le portefeuille grandit, ou dès qu'une agence immobilière gère les biens de plusieurs clients propriétaires en parallèle — chacun avec ses propres locataires, ses propres échéances et ses propres attentes de reporting." },
      { type: "h2", text: "Propriétaire seul ou agence : des besoins différents" },
      { type: "p", text: "Un propriétaire individuel cherche avant tout de la visibilité : savoir qui a payé, qui est en retard, et quand renouveler un bail qui arrive à échéance. Une agence immobilière, elle, doit en plus gérer une équipe de collaborateurs, répartir les mandats entre eux, et rendre compte à chaque propriétaire client de l'état de son patrimoine — sans jamais mélanger les informations d'un client avec celles d'un autre." },
      { type: "p", text: "C'est cette double exigence — simplicité pour le propriétaire, structure pour l'agence — qui rend la gestion locative complexe à l'échelle, et qui justifie de s'appuyer sur un outil dédié plutôt que sur des fichiers Excel dispersés." },
      { type: "h2", text: "Ce qu'un logiciel de gestion locative change concrètement" },
      { type: "list", items: [
        "Échéancier automatique : chaque loyer dû génère une échéance et une relance si nécessaire, sans ressaisie manuelle.",
        "Quittances générées automatiquement à chaque paiement encaissé, envoyées au locataire sans intervention.",
        "Vue consolidée du patrimoine : biens, lots, baux et locataires liés entre eux, consultables en un coup d'œil.",
        "Pour les agences : gestion d'équipe et de mandats clients, avec des permissions précises par collaborateur.",
      ] },
      { type: "p", text: "L'objectif n'est pas de complexifier la gestion locative, mais de retirer la charge de suivi manuel pour se concentrer sur la relation avec les locataires et la valorisation du patrimoine. C'est exactement le rôle que joue FADAA Locative : centraliser biens, baux, paiements et échanges dans une seule interface, pensée aussi bien pour un propriétaire indépendant que pour une agence immobilière structurée." },
      { type: "h2", text: "Par où commencer ?" },
      { type: "p", text: "La transition d'un suivi manuel vers un logiciel de gestion locative se fait généralement bien en commençant par un seul bien ou un seul portefeuille, le temps de prendre en main l'échéancier et la génération des quittances, avant d'étendre l'usage à l'ensemble du patrimoine géré." },
    ],
  },
  {
    slug: "choisir-logiciel-gestion-locative",
    title: "Comment choisir son logiciel de gestion locative en 2026",
    description:
      "Les critères essentiels pour choisir un logiciel de gestion locative adapté à votre situation : propriétaire individuel ou agence immobilière, fonctionnalités clés, sécurité des paiements.",
    keywords: ["logiciel de gestion locative", "gestion locative Maroc", "gestion immobilière"],
    publishedAt: "2026-06-16",
    readingTime: "6 min",
    excerpt:
      "Tous les logiciels de gestion locative ne se valent pas. Voici les critères à vérifier avant de choisir celui qui accompagnera votre activité au quotidien.",
    content: [
      { type: "p", text: "Le marché des logiciels de gestion locative s'est étoffé ces dernières années, mais les besoins réels d'un propriétaire marocain ou d'une agence immobilière locale ne sont pas toujours couverts par des solutions pensées pour d'autres marchés. Voici les critères qui font vraiment la différence au moment de choisir." },
      { type: "h2", text: "1. La gestion multi-biens et multi-lots" },
      { type: "p", text: "Un bien immobilier peut contenir plusieurs lots (appartements, commerces) loués séparément. Un bon logiciel de gestion locative doit représenter cette hiérarchie — bien, lot, bail, locataire — sans forcer à dupliquer les informations, et permettre de passer d'une vue d'ensemble du patrimoine à un lot précis en quelques clics." },
      { type: "h2", text: "2. Le suivi des paiements et des échéances" },
      { type: "p", text: "C'est le cœur du réacteur : le logiciel doit générer automatiquement les échéances de loyer, suivre les encaissements, distinguer un paiement partiel d'un paiement complet, et relancer les retards sans intervention manuelle. La génération automatique de quittances à chaque paiement est un gain de temps considérable, surtout pour une agence gérant des dizaines de locataires." },
      { type: "h2", text: "3. La gestion d'équipe pour les agences immobilières" },
      { type: "p", text: "Pour une agence immobilière, la question n'est plus seulement « gérer un bien » mais « organiser une équipe autour de plusieurs clients propriétaires ». Le logiciel doit permettre d'inviter des collaborateurs, de leur attribuer des mandats précis, et de garantir qu'un propriétaire ne voit jamais les données d'un autre client de l'agence." },
      { type: "h2", text: "4. La sécurité et la traçabilité" },
      { type: "p", text: "Chaque paiement, chaque modification de bail, chaque révocation d'accès doit être tracée. C'est ce qui protège à la fois le propriétaire (preuve des encaissements) et l'agence (journal d'activité en cas de litige)." },
      { type: "h2", text: "5. La simplicité d'usage au quotidien" },
      { type: "p", text: "Un logiciel puissant mais compliqué finit par être abandonné au profit du tableur habituel. La prise en main doit être rapide : créer un bien, ajouter un locataire, encaisser un premier loyer — sans formation préalable ni documentation à lire." },
      { type: "p", text: "FADAA Locative a été construit autour de ces cinq critères, avec une distinction claire entre l'espace propriétaire et l'espace agence, chacun adapté à son propre workflow plutôt qu'une interface unique générique." },
    ],
  },
  {
    slug: "bail-de-location-maroc",
    title: "Bail de location au Maroc : ce qu'il faut savoir avant de signer",
    description:
      "Les mentions obligatoires d'un bail de location au Maroc, la durée, le dépôt de garantie, et comment un logiciel de gestion locative facilite le suivi du contrat après signature.",
    keywords: ["bail de location", "gestion locative Maroc", "gestion immobilière"],
    publishedAt: "2026-07-03",
    readingTime: "5 min",
    excerpt:
      "Le bail de location est le socle de toute relation entre propriétaire et locataire. Voici ce qu'il doit contenir, et comment en assurer le suivi une fois signé.",
    content: [
      { type: "p", text: "Le bail de location (ou contrat de bail) formalise l'accord entre un propriétaire et son locataire : durée d'occupation, montant du loyer, charges, dépôt de garantie et obligations de chaque partie. Sa rédaction soignée évite la majorité des litiges qui surviennent en cours de location." },
      { type: "h2", text: "Les mentions essentielles d'un bail" },
      { type: "list", items: [
        "L'identité complète du propriétaire (ou de l'agence mandatée) et du locataire.",
        "La désignation précise du bien et, le cas échéant, du lot loué.",
        "La date de début et la durée du bail, avec les conditions de renouvellement.",
        "Le montant du loyer, sa périodicité et les modalités de révision.",
        "Le montant du dépôt de garantie et les conditions de sa restitution.",
        "La répartition des charges entre propriétaire et locataire.",
      ] },
      { type: "h2", text: "Après la signature : le vrai travail commence" },
      { type: "p", text: "Signer un bail de location n'est que la première étape. Le suivi qui suit — échéances de loyer, éventuelles révisions, renouvellement ou résiliation — représente l'essentiel du travail de gestion locative sur la durée du contrat. C'est là qu'un mauvais suivi manuel coûte le plus cher : un renouvellement oublié, une échéance non relancée, un dépôt de garantie mal documenté au moment du départ du locataire." },
      { type: "h2", text: "Le rôle d'un logiciel de gestion locative" },
      { type: "p", text: "En centralisant chaque bail avec son historique de paiements, ses échéances à venir et sa date d'expiration, un logiciel de gestion locative comme FADAA Locative transforme le bail d'un simple document signé en un objet vivant, suivi automatiquement du premier jour jusqu'à la fin du contrat — avec alertes avant échéance et historique complet consultable à tout moment, aussi bien par le propriétaire que par l'agence qui gère le bien en son nom." },
    ],
  },
  {
    slug: "paiement-loyer-automatiser-recouvrement",
    title: "Paiement du loyer : comment sécuriser et automatiser le recouvrement",
    description:
      "Retards de loyer, quittances, relances : les bonnes pratiques pour sécuriser le paiement du loyer et automatiser le recouvrement grâce à un logiciel de gestion locative.",
    keywords: ["paiement du loyer", "gestion locative Maroc", "logiciel de gestion locative"],
    publishedAt: "2026-07-21",
    readingTime: "6 min",
    excerpt:
      "Le paiement du loyer est le nerf de la gestion locative. Voici comment réduire les retards et supprimer la charge administrative liée aux quittances.",
    content: [
      { type: "p", text: "Aucun aspect de la gestion locative n'a autant d'impact direct sur la rentabilité d'un bien que le paiement du loyer. Un retard non détecté à temps, une quittance non émise, ou un encaissement mal enregistré peuvent créer des tensions inutiles avec un locataire par ailleurs fiable." },
      { type: "h2", text: "Pourquoi les retards de loyer passent souvent inaperçus" },
      { type: "p", text: "Avec un suivi manuel (tableur ou carnet), un retard de paiement n'est souvent constaté qu'au moment de faire les comptes en fin de mois — trop tard pour relancer efficacement. Plus le nombre de locataires suivis augmente, plus ce délai de détection s'allonge, et plus les impayés s'accumulent avant d'être traités." },
      { type: "h2", text: "Automatiser la détection et la relance" },
      { type: "p", text: "Un échéancier automatique change la donne : chaque loyer dû est suivi individuellement, avec un statut clair — payé, partiel ou en retard — visible en temps réel. Dès qu'une échéance dépasse sa date sans encaissement, une relance peut être envoyée automatiquement au locataire, sans attendre que le propriétaire ou l'agence s'en aperçoive manuellement." },
      { type: "h2", text: "La quittance : une formalité qui ne doit jamais être oubliée" },
      { type: "p", text: "La quittance de loyer prouve le paiement et protège autant le locataire que le propriétaire en cas de litige. Générée manuellement, elle est souvent la première tâche administrative négligée quand le volume de locataires augmente. Automatiser sa génération dès qu'un paiement est enregistré supprime cette charge et garantit qu'aucun encaissement ne reste sans preuve." },
      { type: "h2", text: "Ce que change un suivi centralisé" },
      { type: "p", text: "Avec FADAA Locative, chaque paiement encaissé, en attente ou en retard est visible instantanément — par bien, par locataire ou sur l'ensemble du portefeuille — avec quittance et relance automatiques. Pour une agence, ce même suivi se décline par mandat client, sans jamais mélanger les paiements d'un propriétaire avec ceux d'un autre." },
    ],
  },
  {
    slug: "agence-immobiliere-gerer-plusieurs-clients",
    title: "Agence immobilière : comment gérer plusieurs propriétaires sans perdre le contrôle",
    description:
      "Les défis spécifiques d'une agence immobilière qui gère le patrimoine de plusieurs propriétaires, et comment structurer équipe, mandats et permissions pour rester organisé.",
    keywords: ["agence immobilière", "gestion immobilière", "gestion locative Maroc"],
    publishedAt: "2026-08-05",
    readingTime: "6 min",
    excerpt:
      "Gérer un bien pour un client est simple. En gérer des dizaines pour plusieurs propriétaires, avec une équipe, exige une vraie structure. Voici comment l'organiser.",
    content: [
      { type: "p", text: "Une agence immobilière qui démarre gère souvent son premier client comme elle gérerait son propre bien : un tableur, quelques dossiers, une bonne mémoire. Cette approche tient jusqu'au deuxième, troisième client — puis devient rapidement intenable dès qu'une équipe de plusieurs collaborateurs doit se coordonner sur des dizaines de biens appartenant à des propriétaires différents." },
      { type: "h2", text: "Le vrai défi : cloisonner sans complexifier" },
      { type: "p", text: "Chaque propriétaire client d'une agence immobilière doit pouvoir suivre uniquement son propre patrimoine — jamais celui des autres clients de l'agence. En interne, l'agence doit pouvoir répartir les mandats entre ses collaborateurs (qui gère quel client, avec quels droits) sans construire une organisation en silos qui ralentit le travail d'équipe." },
      { type: "h2", text: "Structurer les mandats plutôt que les biens" },
      { type: "p", text: "La bonne unité de gestion pour une agence n'est pas le bien individuel, mais le mandat confié par chaque propriétaire : quels biens sont couverts, quelles permissions sont accordées (voir, créer, modifier des paiements, des baux, des échéances), et qui dans l'équipe peut agir sur ce mandat. Cette structure évite qu'un collaborateur accède par erreur — ou par défaut de configuration — aux données d'un client qui ne lui a pas été confié." },
      { type: "h2", text: "L'acquisition de nouveaux clients doit rester simple" },
      { type: "p", text: "Une agence immobilière qui grandit a besoin d'inviter facilement de nouveaux propriétaires comme clients, sans processus manuel lourd : un email d'invitation, le propriétaire configure lui-même l'étendue de l'accès qu'il accorde, et le mandat se met en place sans échange de documents papier." },
      { type: "h2", text: "Ce que permet une plateforme pensée pour les agences" },
      { type: "p", text: "FADAA Locative structure nativement cette relation à trois niveaux : l'agence, ses collaborateurs, et les propriétaires clients — chacun avec sa propre vue et ses propres droits. Un propriétaire garde le contrôle total sur ce qu'il autorise l'agence à faire ; l'agence garde une vue consolidée de tous ses mandats sans jamais mélanger les portefeuilles de ses clients." },
    ],
  },
];

export function getBlogPost(slug) {
  return BLOG_POSTS.find((post) => post.slug === slug) || null;
}

export function getAllBlogSlugs() {
  return BLOG_POSTS.map((post) => post.slug);
}
