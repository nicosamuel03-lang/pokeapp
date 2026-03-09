const STORAGE_KEY_PREFIX = "pokevault_sale_price_";

export const getSalePrice = (productId: string): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + productId);
    if (!raw) return null;
    const value = parseFloat(raw);
    return Number.isNaN(value) ? null : value;
  } catch {
    return null;
  }
};

export const setSalePrice = (
  productId: string,
  value: number | null | undefined
): void => {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEY_PREFIX + productId;
  try {
    if (value === null || value === undefined || Number.isNaN(value)) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, String(value));
    }
  } catch {
    // ignore
  }
};

