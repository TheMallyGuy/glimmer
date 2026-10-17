import { stripRichText } from "./richText";

/** lower case without accents, so "tim kiem" finds "Tìm kiếm" */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

/** whether every word of `query` is in one of the texts (tags of rich text ignored); an empty query matches all */
export function matchesQuery(query: string, ...texts: (string | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(texts.map((t) => stripRichText(t ?? "")).join(" "));
  return words.every((word) => haystack.includes(word));
}
