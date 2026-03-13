import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Asserts that a value is a non-empty string. Throws if not.
 * Used for validating required string fields in API routes.
 */
export function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required and must be a non-empty string`);
  }
  return value.trim();
}
