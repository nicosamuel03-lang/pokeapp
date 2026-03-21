/** Rayons proportionnels au donut 75px de référence (outer 33, inner 20). */
export function getDonutLayout(size: number) {
  return {
    size,
    cx: size / 2,
    cy: size / 2,
    outerRadius: (size * 33) / 75,
    innerRadius: (size * 20) / 75,
  };
}
