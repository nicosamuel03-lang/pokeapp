import { useState, useEffect } from "react";
import { ChevronLeft, Sun, Moon, LogOut, Crown, ExternalLink, Bell, Mail, Star, Trash2, Lock, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useTheme } from "../state/ThemeContext";
import { useSubscription } from "../state/SubscriptionContext";
import { apiUrl } from "../config/apiUrl";
import { registerPushNotifications, unregisterPushNotifications, checkPushPermissionStatus } from '../services/pushNotifications';
import { isNativeIOS } from "../services/revenueCat";

const NOTIFICATIONS_STORAGE_KEY = "pushNotificationsEnabled";

const sectionHeaderBaseStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "12px 0 6px 0",
  marginTop: 4,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 48,
  padding: "12px 0",
  borderBottom: "1px solid var(--border-color)",
  gap: 12,
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const isLight = theme === "light";
  const nativeIOS = isNativeIOS();
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] SettingsPage", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelLinkHover, setCancelLinkHover] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { getToken } = useAuth();
  const [legalCguOpen, setLegalCguOpen] = useState(false);
  const [legalPrivacyOpen, setLegalPrivacyOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const realPermission = await checkPushPermissionStatus();
        const savedPref = localStorage.getItem('pushNotificationsEnabled') === 'true';
        const isEnabled = realPermission && savedPref;
        setNotificationsEnabled(isEnabled);
        // Sync localStorage with reality
        localStorage.setItem('pushNotificationsEnabled', String(isEnabled));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleNotificationsToggle = async (enabled: boolean) => {
    console.log("NOTIFICATIONS TOGGLE CLICKED, new value:", !notificationsEnabled);
    setNotificationsEnabled(enabled);
    if (enabled) {
      console.log("CALLING registerPushNotifications...");
      await registerPushNotifications();
      console.log("registerPushNotifications COMPLETED");
      setTimeout(async () => {
        const { sendTokenToBackend } = await import('../services/pushNotifications');
        if (user?.id) {
          const token = await getToken();
          if (token) await sendTokenToBackend(user.id, token);
        }
      }, 3000);
    }
    else await unregisterPushNotifications();
    try {
      localStorage.setItem('pushNotificationsEnabled', enabled ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.id) return;
    setCancelLoading(true);
    try {
      const res = await fetch(apiUrl("/api/cancel-subscription"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("Échec de l'annulation");
      window.location.href = "/";
    } catch {
      setCancelLoading(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    setDeleteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/delete-account"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) throw new Error("Échec de la suppression");
      await signOut();
      window.location.href = "/";
    } catch {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="space-y-4 -mx-3"
      style={{
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        padding: "16px 0 120px 0",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "var(--text-secondary)",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
        </button>
        <p className="text-xs font-medium" style={{ color: isDark ? "#888888" : "var(--text-secondary)", margin: 0 }}>
          Retour
        </p>
      </div>

      <div
        className="rounded-2xl px-2 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
        }}
      >
        {/* ABONNEMENT */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold, marginTop: 0 }}>
          ABONNEMENT
        </h2>
        <div
          style={{
            ...rowStyle,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {premiumLoading ? (
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Chargement…
            </span>
          ) : isPremium ? (
            <>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Crown size={18} color={accentGold} />
                Boss Access actif
              </p>
              {nativeIOS ? (
                <button
                  type="button"
                  onClick={() => window.open("https://apps.apple.com/account/subscriptions", "_blank")}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: accentGold,
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Gérer l'abonnement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  onMouseEnter={() => setCancelLinkHover(true)}
                  onMouseLeave={() => setCancelLinkHover(false)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "#ef4444",
                    fontSize: 12,
                    cursor: cancelLoading ? "default" : "pointer",
                    opacity: cancelLoading ? 0.7 : 1,
                    textDecoration: cancelLinkHover && !cancelLoading ? "underline" : "none",
                  }}
                >
                  {cancelLoading ? "Annulation…" : "Annuler"}
                </button>
              )}
            </>
          ) : (
            <>
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                Passez en Boss Access pour débloquer toutes les fonctionnalités
              </span>
              <button
                type="button"
                onClick={() => navigate("/premium")}
                aria-label="Passer en Boss Access"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  minWidth: "44px",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--accent-yellow)",
                  color: "#111827",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Crown size={20} />
              </button>
            </>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          NOTIFICATIONS
        </h2>
        <div style={{ ...rowStyle, borderBottom: "none", paddingBottom: 20 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)" }}>
            <Bell size={18} />
            Activer les notifications
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => handleNotificationsToggle(!notificationsEnabled)}
            style={{
              width: 48,
              height: 28,
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              background: notificationsEnabled ? accentGold : "var(--input-bg)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: notificationsEnabled ? 22 : 2,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transition: "left 0.2s ease",
              }}
            />
          </button>
        </div>

        {/* APPARENCE */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          APPARENCE
        </h2>
        <div style={rowStyle}>
          <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
            Thème clair / sombre
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={premiumLoading ? undefined : isPremium ? toggleTheme : undefined}
              disabled={premiumLoading || !isPremium}
              aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: theme === "dark" ? "var(--bg-card-elevated)" : "#D4A757",
                color: theme === "dark" ? "var(--text-secondary)" : "#111827",
                border: "none",
                cursor: isPremium && !premiumLoading ? "pointer" : "not-allowed",
                padding: 0,
                opacity: isPremium && !premiumLoading ? 1 : 0.4,
              }}
            >
              {theme === "dark" ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
            </button>
            {!premiumLoading && !isPremium && (
              <Lock size={14} color="var(--text-secondary)" aria-hidden />
            )}
          </div>
        </div>

        {/* SUPPORT */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          SUPPORT
        </h2>
        <a
          href="mailto:giovannitcg.support@gmail.com"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={18} color="var(--text-secondary)" />
            Nous contacter
          </span>
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>
        <a
          href="https://apps.apple.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={18} color="var(--text-secondary)" />
            Noter l&apos;app
          </span>
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>

        {/* COMPTE */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          COMPTE
        </h2>
        <div style={rowStyle}>
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
        <div style={rowStyle}>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              border: "none",
              background: "transparent",
              color: "#ef4444",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Trash2 size={18} />
            Supprimer mon compte
          </button>
        </div>

        {/* MENTIONS LÉGALES */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          Mentions légales
        </h2>
        {/* Accordéon CGU */}
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border-color)",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setLegalCguOpen((v) => !v)}
            style={{
              ...rowStyle,
              borderBottom: "none",
              background: "var(--card-color)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
              Conditions Générales d&apos;Utilisation
            </span>
            <ChevronDown
              size={16}
              color={accentGold}
              style={{
                transform: legalCguOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          {legalCguOpen && (
            <div
              style={{
                padding: "10px 14px 12px",
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                background: "var(--bg-card-elevated, #050505)",
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
          )}
        </div>

        {/* Accordéon Politique de confidentialité */}
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border-color)",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setLegalPrivacyOpen((v) => !v)}
            style={{
              ...rowStyle,
              borderBottom: "none",
              background: "var(--card-color)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
              Politique de confidentialité
            </span>
            <ChevronDown
              size={16}
              color={accentGold}
              style={{
                transform: legalPrivacyOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          {legalPrivacyOpen && (
            <div
              style={{
                padding: "10px 14px 12px",
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                background: "var(--bg-card-elevated, #050505)",
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

Contact : giovannitcg.support@gmail.com`}
            </div>
          )}
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginTop: 4,
          }}
        >
          Giovanni est une application indépendante. Elle n&apos;est ni affiliée, ni sponsorisée, ni approuvée par The
          Pokémon Company International, Nintendo Co. Ltd., Game Freak Inc. ou Creatures Inc. Pokémon et tous les noms
          et images associés sont des marques déposées de The Pokémon Company International, Nintendo, Game Freak et
          Creatures Inc.
        </p>
      </div>

      <p
        style={{
          textAlign: "center",
          color: "#666666",
          fontSize: 12,
          marginTop: 32,
          marginBottom: 100,
        }}
      >
        Giovanni v1.0.0
      </p>

      {/* Modal confirmation suppression compte */}
      {deleteModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 16,
              padding: 20,
              background: "var(--card-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Supprimer mon compte
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Êtes-vous sûr ? Cette action est irréversible.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteModalOpen(false)}
                disabled={deleteLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: 9999,
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleteLoading ? "default" : "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountConfirm}
                disabled={deleteLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleteLoading ? "default" : "pointer",
                  opacity: deleteLoading ? 0.8 : 1,
                }}
              >
                {deleteLoading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
