import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTheme } from "../state/ThemeContext";

export function CGUPage() {
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  return (
    <div
      style={{
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        padding: "24px 16px",
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
      }}
    >
      <Link
        to="/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          fontSize: 13,
          color: "var(--text-secondary)",
          textDecoration: "none",
        }}
      >
        <ChevronLeft size={28} strokeWidth={1.5} />
        <span>Retour</span>
      </Link>

      <h1
        className="title-section"
        style={{
          fontSize: "22px",
          color: accentGold,
          marginBottom: 24,
          letterSpacing: "0.08em",
        }}
      >
        Conditions Générales d&apos;Utilisation
      </h1>

      <div
        style={{
          background: "var(--card-color)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          lineHeight: 1.6,
          fontSize: 14,
          color: "var(--text-primary)",
          whiteSpace: "pre-line",
        }}
      >
        {`Giovanni — Conditions Générales d'Utilisation
Date d'entrée en vigueur : 11 mars 2026

Article 1 — Présentation de l'application
Giovanni est une application indépendante permettant aux collectionneurs de cartes Pokémon de gérer leur collection personnelle, de suivre l'évolution de sa valeur marchande et de consulter des historiques de prix. Giovanni n'est pas affiliée, sponsorisée, approuvée ou associée à Nintendo, Game Freak, Creatures Inc., The Pokémon Company ou leurs filiales. Les noms, marques, personnages et logos Pokémon sont la propriété exclusive de The Pokémon Company International, Nintendo, Game Freak et Creatures Inc. Leur utilisation dans Giovanni est purement descriptive et référentielle.

Pokémon et les noms des personnages associés sont des marques déposées de Nintendo, Creatures Inc. et Game Freak. L'utilisation de ces noms dans cette application est purement illustrative et ne suggère aucune affiliation officielle.

Article 2 — Acceptation des conditions
En accédant à Giovanni ou en utilisant ses services, vous acceptez pleinement et sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous devez cesser immédiatement d'utiliser l'application.

Article 3 — Description des services
Giovanni propose : gestion et suivi d'une collection de cartes Pokémon, consultation des valeurs marchandes estimées, historique de prix sur 6 mois et 1 an (Premium), portefeuille global de la collection (Premium), accès au marché secondaire de référence.

Avertissement sur les estimations de prix : les valeurs marchandes affichées dans l'application sont des estimations informatives basées sur des algorithmes de données de marché. Elles ne constituent en aucun cas une garantie de valeur réelle ou un conseil en investissement. L'Éditeur décline toute responsabilité quant aux décisions d'achat, de vente ou d'échange prises par l'utilisateur sur la base de ces informations.

Certains liens vers des sites marchands (Amazon, Fnac, etc.) peuvent être des liens d'affiliation. En tant que partenaire, Giovanni peut percevoir une commission sur les achats éligibles effectués via ces liens, sans coût supplémentaire pour l'utilisateur.

Article 4 — Abonnement Premium (Boss Access)
L'abonnement Boss Access est proposé à 3,99 € par mois ou 39,99 € par an. L'abonnement est géré et facturé exclusivement via l'Apple App Store (In-App Purchase). Le paiement est débité du compte Apple ID de l'utilisateur à la confirmation de l'achat.

L'abonnement se renouvelle automatiquement sauf si le renouvellement automatique est désactivé au moins 24 heures avant la fin de la période en cours. Le compte est débité pour le renouvellement dans les 24 heures précédant la fin de la période en cours, au tarif de l'abonnement choisi.

L'utilisateur peut gérer et annuler ses abonnements à tout moment dans les Réglages de son compte App Store (Réglages > [Nom] > Abonnements). Conformément à la législation européenne, un droit de rétractation de 14 jours s'applique à compter de la souscription.

Article 5 — Propriété intellectuelle
Le code source, le design, les fonctionnalités et le nom « Giovanni » sont la propriété exclusive de leur créateur. Les noms, images et marques liés à Pokémon appartiennent à leurs propriétaires respectifs et sont utilisés uniquement à des fins descriptives.

Article 6 — Limitation de responsabilité
Les valeurs et prix affichés sont fournis à titre indicatif uniquement. Ils ne constituent pas une offre d'achat ou de vente. Giovanni ne peut être tenu responsable des décisions financières prises sur la base de ces informations, ni des interruptions de service ou pertes de données.

Les estimations de prix fournies par Giovanni sont calculées à partir de données du marché secondaire collectées automatiquement. Giovanni ne garantit pas l'exactitude, l'exhaustivité ou l'actualité de ces données de marché et ne peut en aucun cas être tenu responsable des pertes financières liées à l'achat, la vente ou l'échange de produits Pokémon basés sur ces estimations.

Article 7 — Comportement des utilisateurs
Il est interdit de tenter de pirater l'application, reproduire le code source, utiliser l'application à des fins illégales ou partager ses identifiants avec des tiers.

Il est également strictement interdit d'utiliser des bots, scripts automatisés, techniques de web-scraping ou tout autre moyen automatisé pour extraire, copier ou collecter les données de prix, les estimations de marché ou toute autre donnée propriétaire de Giovanni. Toute tentative d'extraction automatisée des données pourra entraîner la suspension immédiate du compte sans préavis.

Article 8 — Modifications des CGU
Giovanni se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront notifiés par e-mail ou via l'application.

Article 9 — Résiliation
Giovanni se réserve le droit de suspendre ou supprimer tout compte en cas de violation des CGU, sans préavis ni remboursement.

Article 10 — Droit applicable
Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux compétents de France seront saisis.

Article 11 — Contact
giovannitcg.support@gmail.com`}
      </div>
    </div>
  );
}
