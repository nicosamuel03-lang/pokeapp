import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { CollectionLineForChart } from "../utils/portfolioChartData";
import { getDonutLayout } from "../utils/donutChartLayout";

export const CATEGORY_DONUT_COLORS = {
  ETB: "#ef4444",
  UPC: "#f59e0b",
  Displays: "#3b82f6",
  Autres: "#94a3b8",
} as const;

const COLOR_ETB = CATEGORY_DONUT_COLORS.ETB;
const COLOR_UPC = CATEGORY_DONUT_COLORS.UPC;
const COLOR_DISPLAYS = CATEGORY_DONUT_COLORS.Displays;
const COLOR_AUTRES = CATEGORY_DONUT_COLORS.Autres;
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

export type CategoryRepartitionRow = {
  label: string;
  count: number;
  pct: number;
  color: string;
};

function aggregateByCategory(lines: CollectionLineForChart[]) {
  let etb = 0;
  let upc = 0;
  let displays = 0;
  let autres = 0;
  for (const line of lines) {
    const q = Number(line.quantity) || 0;
    const cat = String(line.product.category ?? "");
    if (cat === "ETB") etb += q;
    else if (cat === "UPC") upc += q;
    else if (cat === "Displays") displays += q;
    else autres += q;
  }
  return { etb, upc, displays, autres };
}

function buildSlices(lines: CollectionLineForChart[], isDark: boolean): { rows: SliceRow[]; total: number; isEmpty: boolean } {
  const { etb, upc, displays, autres } = aggregateByCategory(lines);
  const total = etb + upc + displays + autres;
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
      isEmpty: true,
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
  push("ETB", "ETB", etb, COLOR_ETB);
  push("UPC", "UPC", upc, COLOR_UPC);
  push("Displays", "Displays", displays, COLOR_DISPLAYS);
  push("Autres", "Autres", autres, COLOR_AUTRES);

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
      isEmpty: true,
    };
  }

  return { rows, total, isEmpty: false };
}

/** Lignes pour affichage sous le donut (quantités + % du total). */
export function getCategoryRepartitionRows(lines: CollectionLineForChart[]): CategoryRepartitionRow[] {
  const { etb, upc, displays, autres } = aggregateByCategory(lines);
  const total = etb + upc + displays + autres;
  if (total === 0) return [];
  const rows: CategoryRepartitionRow[] = [];
  const push = (label: string, count: number, color: string) => {
    if (count <= 0) return;
    rows.push({ label, count, pct: (count / total) * 100, color });
  };
  push("ETB", etb, COLOR_ETB);
  push("UPC", upc, COLOR_UPC);
  push("Displays", displays, COLOR_DISPLAYS);
  push("Autres", autres, COLOR_AUTRES);
  return rows;
}

function DonutTooltipBody({
  breakdown,
  isDark,
}: {
  breakdown: { etb: number; upc: number; displays: number; autres: number; total: number };
  isDark: boolean;
}) {
  const { etb, upc, displays, autres, total } = breakdown;
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
        <span className="tabular-nums font-normal" style={{ color: isDark ? "#e5e7eb" : "#374151" }}>
          {count} · {pct.toFixed(1)}%
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      {etb > 0 ? line("ETB", etb, COLOR_ETB) : null}
      {upc > 0 ? line("UPC", upc, COLOR_UPC) : null}
      {displays > 0 ? line("Displays", displays, COLOR_DISPLAYS) : null}
      {autres > 0 ? line("Autres", autres, COLOR_AUTRES) : null}
    </div>
  );
}

export function PortfolioCategoryDonut({
  collectionLines,
  isDark,
  size = DEFAULT_SIZE,
  showTooltip = true,
}: {
  collectionLines: CollectionLineForChart[];
  isDark: boolean;
  /** Largeur/hauteur du graphique (défaut 75). Ex. 55 sur mobile. */
  size?: number;
  /** Si false, pas d’infobulle au survol / au clic (ex. carte Répartition). */
  showTooltip?: boolean;
}) {
  const breakdown = useMemo(() => aggregateByCategory(collectionLines), [collectionLines]);
  const { rows, total } = useMemo(() => buildSlices(collectionLines, isDark), [collectionLines, isDark]);

  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.label, value: r.value, fill: r.fill, key: r.key })),
    [rows]
  );

  const { size: sz, cx, cy, innerRadius, outerRadius } = useMemo(() => getDonutLayout(size), [size]);

  const tooltipBg = isDark ? "#1f2937" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  return (
    <div
      className="relative shrink-0 touch-manipulation"
      style={{ width: sz, height: sz }}
    >
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
                    maxWidth: 200,
                  }}
                >
                  <DonutTooltipBody
                    breakdown={{ ...breakdown, total }}
                    isDark={isDark}
                  />
                </div>
              );
            }}
          />
        ) : null}
      </PieChart>
    </div>
  );
}
