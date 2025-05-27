import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes text by converting to lowercase, removing diacritics (accents),
 * and optionally removing non-alphanumeric characters and normalizing spaces.
 * @param text The text to normalize.
 * @returns The normalized text.
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD") // Decompose accented characters into base characters and diacritics
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    // .replace(/[^a-z0-9\s]/gi, '') // Optional: remove special chars except space
    .replace(/\s+/g, ' ') // Normalize multiple spaces to a single space
    .trim();
}
