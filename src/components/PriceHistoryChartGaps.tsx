import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Layer, usePlotArea } from "recharts";
import { useXAxis, useYAxis } from "recharts/es6/hooks.js";

export type PriceHistoryGapEndpoint = {
  mois: string;
  mois_court: string;
  mois_label: string;
  prix: number;
};

type Props = {
  segments: [PriceHistoryGapEndpoint, PriceHistoryGapEndpoint][];
  stroke: string;
};

function coordsForPoint(
  xAxis: ReturnType<typeof useXAxis> | undefined,
  yAxis: ReturnType<typeof useYAxis> | undefined,
  p: PriceHistoryGapEndpoint
): { x: number; y: number } | null {
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const x = xAxis.scale.map(p.mois_court, { position: "middle" });
  const y = yAxis.scale.map(p.prix);
  if (x == null || y == null) return null;
  return { x, y };
}

/**
 * Segments en pointillés entre deux mois avec données, au-dessus de la série réelle.
 * Survol / clic : tooltip « période sans données » (coordonnées Recharts = SVG graphique).
 */
export function PriceHistoryChartGaps({ segments, stroke }: Props) {
  const plot = usePlotArea();
  const xAxis = useXAxis(0);
  const yAxis = useYAxis(0);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const toXY = useCallback(
    (p: PriceHistoryGapEndpoint) => coordsForPoint(xAxis, yAxis, p),
    [xAxis, yAxis]
  );

  if (!plot || segments.length === 0) return null;

  return (
    <>
      <Layer className="recharts-price-history-gaps">
        <g>
          {segments.map(([a, b]) => {
            const p1 = toXY(a);
            const p2 = toXY(b);
            if (!p1 || !p2) return null;
            const key = `${a.mois}-${b.mois}`;
            const showTip = (clientX: number, clientY: number) =>
              setTip({ x: clientX, y: clientY });
            return (
              <g key={key}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={stroke}
                  strokeOpacity={0.5}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  pointerEvents="none"
                />
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="transparent"
                  strokeWidth={18}
                  pointerEvents="stroke"
                  style={{ cursor: "pointer" }}
                  onPointerEnter={(e) => showTip(e.clientX, e.clientY)}
                  onPointerMove={(e) => showTip(e.clientX, e.clientY)}
                  onPointerDown={(e) => showTip(e.clientX, e.clientY)}
                  onPointerLeave={() => setTip(null)}
                  onPointerCancel={() => setTip(null)}
                />
              </g>
            );
          })}
        </g>
      </Layer>
      {tip &&
        createPortal(
          <div
            className="rounded-xl px-3 py-2 text-xs shadow-lg"
            style={{
              position: "fixed",
              left: Math.min(tip.x + 14, typeof window !== "undefined" ? window.innerWidth - 220 : tip.x),
              top: tip.y + 14,
              zIndex: 10000,
              pointerEvents: "none",
              background: "var(--card-color)",
              color: stroke,
              boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
              maxWidth: 200,
            }}
          >
            Données non disponibles pour cette période
          </div>,
          document.body
        )}
    </>
  );
}
