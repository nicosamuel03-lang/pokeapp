/** Insensible aux accents (NFD + suppression des marques diacritiques). */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
