/** The looks a string can ask for, e.g. "Never share your [danger]cookie[/danger]". */
export const RICH_TAGS = ["danger", "accent", "muted", "mono"] as const;
export type RichTag = (typeof RICH_TAGS)[number];

/** A run of text, with the look it was tagged with (none for plain text). */
export interface RichSegment {
  text: string;
  tag?: RichTag;
}

// A tag runs to its closing tag, or to the end of the string when it has none. An unknown tag stays as plain text.
// ponytail: tags do not nest. Add nesting when a string needs bold inside red.
const TAGGED = new RegExp(`\\[(${RICH_TAGS.join("|")})\\](.*?)(?:\\[/\\1\\]|$)`, "gs");

/** Splits a string into plain and tagged runs. Works on any string, so a dictionary entry or an error message both do. */
export function parseRichText(text: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let end = 0;
  for (const match of text.matchAll(TAGGED)) {
    const start = match.index ?? 0;
    if (start > end) segments.push({ text: text.slice(end, start) });
    if (match[2]) segments.push({ text: match[2], tag: match[1] as RichTag });
    end = start + match[0].length;
  }
  if (end < text.length) segments.push({ text: text.slice(end) });
  return segments;
}

/** The text without its tags, for places that can't show a look: an attribute, a tooltip, a log line. */
export function stripRichText(text: string): string {
  return parseRichText(text)
    .map((segment) => segment.text)
    .join("");
}
