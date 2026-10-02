import { twMerge } from 'tailwind-merge';

export type ClassValue = string | false | null | undefined;

/** Joins class names and lets later Tailwind classes override earlier ones. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}

/**
 * Text of a dictionary entry picked by a key known only at runtime. Plain entries carry `value`;
 * entries with `{{placeholders}}` are called with their values.
 */
export function dictText(
  entry: { value?: string } & ((values: Record<string, string>) => { value: string }),
  values: Record<string, string> = {}
): string {
  return entry.value ?? entry(values).value;
}
