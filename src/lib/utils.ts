import { twMerge } from "tailwind-merge";

/**
 * A class value: a name, or something carrying names. The same shape clsx and svelte's `class`
 * attribute use, so a `class` prop can be passed straight to `cn`.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | { [name: string]: unknown }
  | ClassValue[];

/** Joins class names and lets later Tailwind classes override earlier ones. */
export function cn(...classes: ClassValue[]): string {
  const names: string[] = [];

  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      // a `{ "flex-1": true }` dictionary keeps the names that are on
      for (const [name, on] of Object.entries(value)) if (on) names.push(name);
    } else if (value) {
      names.push(String(value));
    }
  };

  classes.forEach(collect);
  return twMerge(names.join(" "));
}

/**
 * Text of a dictionary entry picked by a key known only at runtime. Plain entries carry `value`;
 * entries with `{{placeholders}}` are called with their values.
 */
export function dictText(
  entry: { value?: string } & ((values: Record<string, string>) => {
    value: string;
  }),
  values: Record<string, string> = {},
): string {
  return entry.value ?? entry(values).value;
}
