import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from "recharts";
import { ItemIcon } from "./components/ItemIcon";

/** MSRP officiel FR par catégorie (prix conseillé à la sortie) */
const CATEGORY_MSRP = {
  ETB:     55,
  Display: 215,
};

// ─── Filtre période ───
const PERIODS = [
  { label: "Tout", months: null },
  { label: "5 ans", months: 60 },
  { label: "3 ans", months: 36 },
  { label: "1 an", months: 12 },
  { label: "6 mois", months: 6 }
];

// ─── Tooltip custom ───
const CustomTooltip = ({ active, payload, label, prixAchat }) => {
  if (!active || !payload?.length) return null;
  const prix = payload[0]?.value;
  const gain = prix - prixAchat;
  const pct = ((gain / prixAchat) * 100).toFixed(1);
  return (
    <div
      style={{
        background: "#0E1830",
        border: "1px solid rgba(59,130,246,0.3)",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        color: "#F0F4FF",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
      }}
    >
      <div
        style={{ color: "#8899BB", fontSize: 11, marginBottom: 4 }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#F0C040" }}>
        {prix?.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
      </div>
      <div
        style={{
          color: gain >= 0 ? "#34D399" : "#F87171",
          fontSize: 12,
          marginTop: 3,
          fontWeight: 600
        }}
      >
        {gain >= 0 ? "+" : ""}
        {gain.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € (
        {gain >= 0 ? "+" : ""}
        {pct}%)
      </div>
      <div style={{ color: "#8899BB", fontSize: 10, marginTop: 2 }}>
        Achat : {prixAchat.toLocaleString("fr-FR")} €
      </div>
    </div>
  );
};

// ─── Composant graphique principal ───
export default function PriceChart({ produit, prixVente }) {
  const [period, setPeriod] = useState(0); // index dans PERIODS

  const chartData = useMemo(() => {
    const hist = Array.isArray(produit.historique) ? produit.historique : [];
    const config = PERIODS[period] || PERIODS[0];
    const months = config.months;

    const base =
      typeof months === "number" && months > 0
        ? hist.slice(-months)
        : hist;

    // MSRP officiel si la catégorie correspond (ETB=55€, Display=215€)
    const categorie = produit.categorie ?? "";
    const msrp =
      CATEGORY_MSRP[categorie] ?? null;

    return base.map((h, index) => ({
      mois: h.mois.replace("-", "/"),
      prix:
        index === 0 && msrp !== null
          ? msrp
          : h.prix
    }));
  }, [produit, period]);

  const gain = produit.prixMarcheActuel - produit.prixAchat;
  const gainPct = ((gain / produit.prixAchat) * 100).toFixed(1);
  const effectivePrixVente =
    typeof prixVente === "number" && !Number.isNaN(prixVente)
      ? prixVente
      : null;
  const gainVente =
    effectivePrixVente !== null
      ? (effectivePrixVente - produit.prixAchat) * produit.quantite
      : null;

  // Tick X : afficher 1 tick sur N selon la période
  const tickInterval =
    (PERIODS[period].months ?? Number.MAX_SAFE_INTEGER) <= 12
      ? 0
      : (PERIODS[period].months ?? Number.MAX_SAFE_INTEGER) <= 36
      ? 5
      : (PERIODS[period].months ?? Number.MAX_SAFE_INTEGER) <= 60
      ? 11
      : 23;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0A1628, #0E1A2E)",
        borderRadius: 20,
        border: "1px solid rgba(59,130,246,0.2)",
        padding: "20px 20px 16px",
        marginBottom: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
      }}
    >
      {/* Header produit */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14
        }}
      >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <ItemIcon
            imageUrl={produit.imageUrl}
            emoji={produit.emoji}
            name={produit.nom}
            size={48}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#F0F4FF",
                lineHeight: 1.2
              }}
            >
              {produit.nom}
            </div>
            <div
              style={{ fontSize: 11, color: "#8899BB", marginTop: 2 }}
            >
              🇫🇷 {produit.categorie} · ×{produit.quantite} · Achat :{" "}
              {produit.prixAchat.toLocaleString("fr-FR")} €/u
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              fontWeight: 700,
              color: "#F0C040"
            }}
          >
            {produit.prixMarcheActuel.toLocaleString("fr-FR")} €
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginTop: 2,
              color: gain >= 0 ? "#34D399" : "#F87171"
            }}
          >
            {gain >= 0 ? "+" : ""}
            {gain.toLocaleString("fr-FR", {
              maximumFractionDigits: 0
            })}{" "}
            € ({gain >= 0 ? "+" : ""}
            {gainPct}%)
          </div>
        </div>
      </div>

      {/* Filtres période */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {PERIODS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPeriod(i)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.07)",
              background:
                period === i ? "#3B82F6" : "rgba(255,255,255,0.04)",
              color: period === i ? "#fff" : "#8899BB",
              transition: "all 0.15s"
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Graphique */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 32, left: -10, bottom: 8 }}
        >
          <defs>
            <linearGradient
              id={`grad-${produit.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#3B82F6"
                stopOpacity={0.6}
              />
              <stop
                offset="60%"
                stopColor="#3B82F6"
                stopOpacity={0.15}
              />
              <stop
                offset="100%"
                stopColor="#3B82F6"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="mois"
            tick={{ fontSize: 9, fill: "#556688" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#556688" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : `${v}€`
            }
            width={44}
          />
          <Tooltip content={<CustomTooltip prixAchat={produit.prixAchat} />} />
          {/* Ligne pointillée prix d'achat */}
          <ReferenceLine
            y={produit.prixAchat}
            stroke="#F0C040"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Achat ${produit.prixAchat}€`,
              position: "insideTopRight",
              fontSize: 9,
              fill: "#F0C040",
              fontWeight: 600
            }}
          />
          {/* Ligne pointillée prix de vente (si rempli) */}
          {effectivePrixVente !== null && effectivePrixVente > 0 && (
            <ReferenceLine
              y={effectivePrixVente}
              stroke="#34D399"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Vente ${effectivePrixVente.toLocaleString(
                  "fr-FR"
                )}€`,
                position: "insideTopRight",
                fontSize: 9,
                fill: "#34D399",
                fontWeight: 600
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="prix"
            stroke="#3B82F6"
            strokeWidth={2}
            fill={`url(#grad-${produit.id})`}
            dot={false}
            activeDot={{
              r: 5,
              fill: "#F0C040",
              stroke: "#fff",
              strokeWidth: 2
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {gainVente !== null && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 600,
            color: gainVente >= 0 ? "#34D399" : "#F87171",
            textAlign: "right"
          }}
        >
          Bénéfice brut potentiel :{" "}
          {gainVente >= 0 ? "+" : ""}
          {gainVente.toLocaleString("fr-FR", {
            maximumFractionDigits: 0
          })}{" "}
          €
        </div>
      )}
    </div>
  );
}

