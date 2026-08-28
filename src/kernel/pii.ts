/**
 * PII masking helper. Fields listed here render masked unless the caller has
 * explicitly revealed them with a reason (which is audited — see audit.ts).
 */

export const PII_FIELDS = [
  "taxId",
  "documentNumber",
  "dateOfBirth",
  "email",
  "phone",
  "address",
] as const;

export type PiiField = (typeof PII_FIELDS)[number];

export function mask(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  return "•".repeat(Math.max(4, value.length - 4)) + value.slice(-4);
}

/** Returns the masked value unless `revealed` is true. */
export function maskUnlessRevealed(value: string, revealed: boolean): string {
  return revealed ? value : mask(value);
}

export function maskRecord<T extends Record<string, unknown>>(
  record: T,
  revealed: boolean,
): T {
  const out = { ...record };
  for (const field of PII_FIELDS) {
    if (typeof out[field] === "string") {
      (out as Record<string, unknown>)[field] = maskUnlessRevealed(
        out[field] as string,
        revealed,
      );
    }
  }
  return out;
}
