import { useState, useEffect } from "react";
import { ChevronLeft, Sun, Moon, LogOut, Crown, ExternalLink, Bell, Mail, Star, Trash2, Lock, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useTheme } from "../state/ThemeContext";
import { useSubscription } from "../state/SubscriptionContext";
import { apiUrl } from "../config/apiUrl";

const NOTIFICATIONS_STORAGE_KEY = "pokevault_notifications_enabled";

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
    try {
      const stored = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      setNotificationsEnabled(stored === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(enabled));
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
        <h1 className="title-section" style={{ color: "var(--text-primary)", margin: 0 }}>
          PARAMÈTRES
        </h1>
      </div>

      <div
        className="rounded-2xl px-2 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
        }}
      >
        {/* COMPTE */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold, marginTop: 0 }}>
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

        {/* ABONNEMENT */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
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
{`PokéVault — Conditions Générales d'Utilisation
Date d'entrée en vigueur : 11 mars 2026

Article 1 — Présentation de l'application
PokéVault est une application indépendante permettant aux collectionneurs de cartes Pokémon de gérer leur collection personnelle, de suivre l'évolution de sa valeur marchande et de consulter des historiques de prix. PokéVault n'est pas affiliée, sponsorisée, approuvée ou associée à Nintendo, Game Freak, Creatures Inc., The Pokémon Company ou leurs filiales. Les noms, marques, personnages et logos Pokémon sont la propriété exclusive de The Pokémon Company International, Nintendo, Game Freak et Creatures Inc. Leur utilisation dans PokéVault est purement descriptive et référentielle.

Article 2 — Acceptation des conditions
En accédant à PokéVault ou en utilisant ses services, vous acceptez pleinement et sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous devez cesser immédiatement d'utiliser l'application.

Article 3 — Description des services
PokéVault propose : gestion et suivi d'une collection de cartes Pokémon, consultation des valeurs marchandes estimées, historique de prix sur 1 an et 2 ans (Premium), portefeuille global de la collection (Premium), accès au marché secondaire de référence.

Article 4 — Abonnement Premium (Boss Access)
L'abonnement Boss Access est proposé à 3,99 € par mois ou 39,99 € par an. L'abonnement est renouvelé automatiquement. L'utilisateur peut annuler à tout moment. Conformément à la législation européenne, un droit de rétractation de 14 jours s'applique à compter de la souscription.

Article 5 — Propriété intellectuelle
Le code source, le design, les fonctionnalités et le nom \"PokéVault\" sont la propriété exclusive de leur créateur. Les noms, images et marques liés à Pokémon appartiennent à leurs propriétaires respectifs et sont utilisés uniquement à des fins descriptives.

Article 6 — Limitation de responsabilité
Les valeurs et prix affichés sont fournis à titre indicatif uniquement. Ils ne constituent pas une offre d'achat ou de vente. PokéVault ne peut être tenu responsable des décisions financières prises sur la base de ces informations, ni des interruptions de service ou pertes de données.

Article 7 — Comportement des utilisateurs
Il est interdit de tenter de pirater l'application, reproduire le code source, utiliser l'application à des fins illégales ou partager ses identifiants avec des tiers.

Article 8 — Modifications des CGU
PokéVault se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront notifiés par e-mail ou via l'application.

Article 9 — Résiliation
PokéVault se réserve le droit de suspendre ou supprimer tout compte en cas de violation des CGU, sans préavis ni remboursement.

Article 10 — Droit applicable
Les présentes CGU sont soumises au droit français. En cas de litige, les tribunaux compétents de France seront saisis.

Article 11 — Contact
support@pokevault.app`}
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
{`PokéVault — Politique de Confidentialité
Date d'entrée en vigueur : 11 mars 2026

Responsable du traitement : support@pokevault.app
Données collectées : adresse e-mail (via Clerk), données de collection (noms, quantités, prix d'achat), informations de paiement (traitées par Stripe — données bancaires jamais stockées), données de connexion, statut d'abonnement.
Utilisation des données : faire fonctionner et améliorer l'application, gérer votre compte et abonnement, vous envoyer des informations liées à votre compte, respecter nos obligations légales.
Partage des données : vos données ne sont jamais vendues. Elles sont partagées uniquement avec Clerk (authentification), Supabase (base de données) et Stripe (paiement), tous conformes au RGPD.
Conservation : données conservées tant que le compte est actif. Suppression dans les 30 jours suivant la clôture du compte.
Vos droits (RGPD) : droit d'accès, rectification, effacement, portabilité et opposition. Contact : support@pokevault.app — réponse sous 30 jours.
Cookies : stockage local minimal (thème, langue). Aucun cookie publicitaire ou tracking tiers.
Sécurité : connexions HTTPS, authentification via Clerk, accès restreint à la base de données.
Mineurs : application non destinée aux moins de 13 ans.
Modifications : notification par e-mail ou via l'app au moins 15 jours avant tout changement important.
Contact : support@pokevault.app`}
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
          PokéVault est une application indépendante. Elle n&apos;est ni affiliée, ni sponsorisée, ni approuvée par
          The Pokémon Company International, Nintendo Co. Ltd., Game Freak Inc. ou Creatures Inc. Pokémon et tous les
          noms et images associés sont des marques déposées de The Pokémon Company International, Nintendo, Game Freak
          et Creatures Inc.
        </p>

        {/* SUPPORT */}
        <h2 className="title-section" style={{ ...sectionHeaderBaseStyle, color: accentGold }}>
          SUPPORT
        </h2>
        <a
          href="mailto:support@pokevault.app"
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
        PokéVault v1.0.0
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
