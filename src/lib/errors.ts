import type { TFunction } from "i18next";

/** Keep errors independent of the UI's current language. */
export class ArchiveError extends Error {
  constructor(
    public readonly key: string,
    public readonly values: Record<string, string> = {},
  ) {
    super(key);
    this.name = "ArchiveError";
  }
}
export function asArchiveError(
  error: unknown,
  fallbackKey: string,
): ArchiveError {
  return error instanceof ArchiveError ? error : new ArchiveError(fallbackKey);
}
export function errorMessage(error: ArchiveError, t: TFunction): string {
  return t(error.key, error.values);
}
