import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { CollectionLineForChart } from "../utils/portfolioChartData";
import { getDonutLayout } from "../utils/donutChartLayout";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";

export const ERA_DONUT_COLORS = {
  "Méga Évolution": "#f97316",
  "Épée & Bouclier": "#10b981",
  "Écarlate & Violet": "#a855f7",
  Autres: "#94a3b8",
} as const;

const LABEL_MEGA = "Méga Évolution";
const LABEL_EB = "Épée & Bouclier";
const LABEL_EV = "Écarlate & Violet";

const COLOR_EMPTY_LIGHT = "#d1d5db";
const COLOR_EMPTY_DARK = "#4b5563";

const DEFAULT_SIZE = 75;

type SliceRow = {
  key: string;
  label: string;
  value: number;
  count: number;
  fill: string;
  pct: number;
};

export type EraRepartitionRow = {
  label: string;
  count: number;
  pct: number;
  color: string;
};

function aggregateByEra(lines: CollectionLineForChart[]) {
  let mega = 0;
  let eb = 0;
  let ev = 0;
  let autres = 0;
  for (const line of lines) {
    const q = Number(line.quantity) || 0;
    const s = String(line.product.set ?? "").trim();
    if (s === LABEL_MEGA) mega += q;
    else if (s === LABEL_EB) eb += q;
    else if (s === LABEL_EV) ev += q;
    else autres += q;
  }
  return { mega, eb, ev, autres };
}

function buildSlices(lines: CollectionLineForChart[], isDark: boolean): { rows: SliceRow[]; total: number } {
  const { mega, eb, ev, autres } = aggregateByEra(lines);
  const total = mega + eb + ev + autres;
  if (total === 0) {
    return {
      rows: [
        {
          key: "empty",
          label: "Collection vide",
          value: 1,
          count: 0,
          fill: isDark ? COLOR_EMPTY_DARK : COLOR_EMPTY_LIGHT,
          pct: 0,
        },
      ],
      total: 0,
    };
  }

  const rows: SliceRow[] = [];
  const push = (key: string, label: string, count: number, fill: string) => {
    if (count <= 0) return;
    rows.push({
      key,
      label,
      value: count,
      count,
      fill,
      pct: (count / total) * 100,
    });
  };
  push("mega", LABEL_MEGA, mega, ERA_DONUT_COLORS[LABEL_MEGA]);
  push("eb", LABEL_EB, eb, ERA_DONUT_COLORS[LABEL_EB]);
  push("ev", LABEL_EV, ev, ERA_DONUT_COLORS[LABEL_EV]);
  push("autres", "Autres", autres, ERA_DONUT_COLORS.Autres);

  if (rows.length === 0) {
    return {
      rows: [
        {
          key: "empty",
          label: "Collection vide",
          value: 1,
          count: 0,
          fill: isDark ? COLOR_EMPTY_DARK : COLOR_EMPTY_LIGHT,
          pct: 0,
        },
      ],
      total: 0,
    };
  }

  return { rows, total };
}

/** Libellés courts comme sur la carte Répartition (Méga Évo, Épée&B, Écar&V). */
export function getEraRepartitionRows(lines: CollectionLineForChart[]): EraRepartitionRow[] {
  const { mega, eb, ev, autres } = aggregateByEra(lines);
  const total = mega + eb + ev + autres;
  if (total === 0) return [];
  const rows: EraRepartitionRow[] = [];
  const push = (label: string, count: number, color: string) => {
    if (count <= 0) return;
    rows.push({ label, count, pct: (count / total) * 100, color });
  };
  push("Méga Évo", mega, ERA_DONUT_COLORS[LABEL_MEGA]);
  push("Épée&B", eb, ERA_DONUT_COLORS[LABEL_EB]);
  push("Écar&V", ev, ERA_DONUT_COLORS[LABEL_EV]);
  push("Autres", autres, ERA_DONUT_COLORS.Autres);
  return rows;
}

/** Blocs nommés complets pour « Répartition détaillée » (Méga / EB / EV uniquement, sans « Autres »). */
export function getBlocRepartitionDetailRows(lines: CollectionLineForChart[]): EraRepartitionRow[] {
  const { mega, eb, ev, autres } = aggregateByEra(lines);
  const total = mega + eb + ev + autres;
  if (total === 0) return [];
  const rows: EraRepartitionRow[] = [];
  const push = (label: string, count: number, color: string) => {
    if (count <= 0) return;
    rows.push({ label, count, pct: (count / total) * 100, color });
  };
  push(LABEL_MEGA, mega, ERA_DONUT_COLORS[LABEL_MEGA]);
  push(LABEL_EB, eb, ERA_DONUT_COLORS[LABEL_EB]);
  push(LABEL_EV, ev, ERA_DONUT_COLORS[LABEL_EV]);
  return rows;
}

function EraTooltipBody({
  breakdown,
  isDark,
}: {
  breakdown: { mega: number; eb: number; ev: number; autres: number; total: number };
  isDark: boolean;
}) {
  const { mega, eb, ev, autres, total } = breakdown;
  if (total === 0) {
    return <p className="m-0 text-[10px] font-medium">Aucun produit en collection</p>;
  }
  const line = (label: string, count: number, color: string) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
      <div key={label} className="flex items-center justify-between gap-3 text-[10px] leading-tight">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className={STAT_CARD_VALUE_CLASS} style={{ color: isDark ? "#e5e7eb" : "#374151" }}>
          {count} · {pct.toFixed(1)}%
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      {mega > 0 ? line(LABEL_MEGA, mega, ERA_DONUT_COLORS[LABEL_MEGA]) : null}
      {eb > 0 ? line(LABEL_EB, eb, ERA_DONUT_COLORS[LABEL_EB]) : null}
      {ev > 0 ? line(LABEL_EV, ev, ERA_DONUT_COLORS[LABEL_EV]) : null}
      {autres > 0 ? line("Autres", autres, ERA_DONUT_COLORS.Autres) : null}
    </div>
  );
}

export function PortfolioEraDonut({
  collectionLines,
  isDark,
  size = DEFAULT_SIZE,
  showTooltip = true,
}: {
  collectionLines: CollectionLineForChart[];
  isDark: boolean;
  size?: number;
  /** Si false, pas d’infobulle au survol / au clic (ex. carte Répartition). */
  showTooltip?: boolean;
}) {
  const breakdown = useMemo(() => aggregateByEra(collectionLines), [collectionLines]);
  const { rows, total } = useMemo(() => buildSlices(collectionLines, isDark), [collectionLines, isDark]);

  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.label, value: r.value, fill: r.fill, key: r.key })),
    [rows]
  );

  const { size: sz, cx, cy, innerRadius, outerRadius } = useMemo(() => getDonutLayout(size), [size]);

  const tooltipBg = isDark ? "#1f2937" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  return (
    <div className="relative shrink-0 touch-manipulation" style={{ width: sz, height: sz }}>
      <PieChart width={sz} height={sz} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={total > 0 && chartData.length > 1 ? 2 : 0}
          stroke="none"
          isAnimationActive={true}
        >
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} stroke="none" />
          ))}
        </Pie>
        {showTooltip ? (
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            content={({ active }) => {
              if (!active) return null;
              return (
                <div
                  className="rounded-lg px-2.5 py-2 shadow-lg"
                  style={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    maxWidth: 220,
                  }}
                >
                  <EraTooltipBody breakdown={{ ...breakdown, total }} isDark={isDark} />
                </div>
              );
            }}
          />
        ) : null}
      </PieChart>
    </div>
  );
}
