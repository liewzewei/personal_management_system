/**
 * Small shared utilities used across PMS.
 *
 * Keep this file focused on generic helpers (formatting, validation),
 * not business logic (which belongs in domain-specific modules).
 */

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

