import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTheme } from "../state/ThemeContext";

export function PrivacyPage() {
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
        Politique de confidentialité
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
        {`Giovanni — Politique de Confidentialité
Date d'entrée en vigueur : 11 mars 2026

Responsable du traitement : giovannitcg.support@gmail.com

Données collectées : adresse e-mail (via Clerk), données de collection (noms, quantités, prix d'achat), informations de paiement (gérées exclusivement par Apple via In-App Purchase — données bancaires jamais stockées par Giovanni), données de connexion, statut d'abonnement.

Utilisation des données : faire fonctionner et améliorer l'application, gérer votre compte et abonnement, vous envoyer des informations liées à votre compte, respecter nos obligations légales.

Partage des données : vos données ne sont jamais vendues. Elles sont partagées uniquement avec Clerk (authentification), Supabase (base de données) et les services de paiement de l'App Store (gestion des abonnements via In-App Purchase), tous conformes au RGPD.

Conservation : données conservées tant que le compte est actif. Suppression dans les 30 jours suivant la clôture du compte.

Suppression de compte : vous pouvez supprimer votre compte et l'intégralité de vos données personnelles à tout moment via les réglages de l'application (Profil > Supprimer mon compte) ou en contactant giovannitcg.support@gmail.com. La suppression est effective dans un délai maximum de 30 jours.

Vos droits (RGPD) : droit d'accès, rectification, effacement, portabilité et opposition. Contact : giovannitcg.support@gmail.com — réponse sous 30 jours.

Cookies : stockage local minimal (thème, langue). Aucun cookie publicitaire ou tracking tiers.

Sécurité : connexions HTTPS, authentification via Clerk, accès restreint à la base de données.

Mineurs : Giovanni n'est pas destinée aux enfants de moins de 13 ans. Aucune donnée personnelle n'est sciemment collectée auprès de mineurs de moins de 13 ans. Si un parent ou tuteur légal découvre que son enfant de moins de 13 ans a créé un compte sans consentement parental, il peut nous contacter à giovannitcg.support@gmail.com pour demander la suppression immédiate du compte et des données associées. Pour les utilisateurs âgés de 13 à 16 ans résidant dans l'Union européenne, le consentement parental est requis conformément au RGPD.

Modifications : notification par e-mail ou via l'app au moins 15 jours avant tout changement important.

Contact : giovannitcg.support@gmail.com

Giovanni est une application indépendante. Elle n'est ni affiliée, ni sponsorisée, ni approuvée par The Pokémon Company International, Nintendo Co. Ltd., Game Freak Inc. ou Creatures Inc. Pokémon et tous les noms et images associés sont des marques déposées de The Pokémon Company International, Nintendo, Game Freak et Creatures Inc.`}
      </div>
    </div>
  );
}
