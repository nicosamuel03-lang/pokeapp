type HistPoint = { mois?: string; prix?: number | null };

export function getPerformanceForPeriod(
  product: {
    currentPrice?: number;
    prixAchat?: number;
    historique_prix?: HistPoint[];
    historique?: HistPoint[];
  },
  period: string
): { percent: number } {
  const current = product?.currentPrice ?? 0;
  if (current <= 0) return { percent: 0 };

  const hist = product?.historique_prix ?? product?.historique ?? [];
  const validHist = (hist as HistPoint[])
    .filter((p) => p.prix != null && !Number.isNaN(p.prix))
    .sort((a, b) => (a.mois ?? "").localeCompare(b.mois ?? ""));

  const reference =
    period === "tout"
      ? product?.prixAchat ?? validHist[0]?.prix ?? 0
      : validHist.length > 0
        ? validHist[0].prix ?? product?.prixAchat ?? 0
        : product?.prixAchat ?? 0;

  if (reference <= 0) return { percent: 0 };
  const percent = ((current - reference) / reference) * 100;
  return { percent: Math.round(percent * 10) / 10 };
}