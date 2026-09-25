import { twMerge } from 'tailwind-merge';

export type ClassValue = string | false | null | undefined;

/** Joins class names and lets later Tailwind classes override earlier ones. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
