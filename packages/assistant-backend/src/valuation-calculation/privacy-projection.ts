// Privacy projection for the valuation boundary.
//
// Externally supplied strings that S4 copies into a ValuationReport (ids, source, exclusion reasons,
// dates, currencies, item id/version) are projected to safe values instead of copied blindly.
// Projection is allowlist-shaped: a value is kept only if it has the shape of an identifier or an
// approved reason, and it is replaced when it looks sensitive. This is not a general privacy
// classifier: an opaque identifier-shaped token cannot be told apart from a legitimate identifier.

export const WITHHELD_REASON = 'exclusion_reason_withheld_for_privacy';
export const WITHHELD_IDENTIFIER = 'identifier_withheld_for_privacy';
export const WITHHELD_SOURCE = 'source_withheld_for_privacy';

// Contact data, URLs and credential-like keywords. Applies to identifiers and reasons.
const SENSITIVE_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+|https?:|www\.|(?:password|passwd|secret|api[_-]?key|token|bearer|authorization|otp|verification)/i;
// Phone-like numbers inside free text (digits with optional separators).
const PHONE_IN_TEXT = /\d(?:[\s\-().]?\d){8,}/;
const PHONE_ONLY = /^\+?\d{9,15}$/;
// Israeli-style phone numbers with separators (kept narrow so ids like "lot-54554-121421" stay valid).
const PHONE_LIKE_ID = /(?:^|\D)(?:\+?972|0)[\s.-]?\d{1,2}[\s.-]?\d{3}[\s.-]?\d{4}(?:\D|$)/;
const IDENTIFIER_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_SHAPE.test(value)
    && !SENSITIVE_TEXT.test(value) && !PHONE_ONLY.test(value) && !PHONE_LIKE_ID.test(value);
}

export const safeIdentifier = (value: unknown, fallback: string): string =>
  isSafeIdentifier(value) ? value : fallback;

export const safeSource = (value: unknown): string => safeIdentifier(value, WITHHELD_SOURCE);

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(value).toISOString().slice(0, 10) === value;
}

// Reasons Heni's comparable selection (S3) generates. The seller-supplied materials note
// ("; confirmed materials not found in listing: ...") is free text and is dropped.
const WEAK_SIMILARITY = /^(Similarity too weak to count as credible evidence \(score \d\.\d\d below 0\.8\))(?:; confirmed materials not found in listing: .*)?$/;
const S3_TEMPLATES: RegExp[] = [
  /^Not a completed sale \(status: [a-z_]{1,32}\) — unsold estimates do not count as realized prices$/,
  /^No realized price recorded — lot cannot contribute to valuation evidence$/,
  /^Category does not match — '[A-Za-z0-9_ -]{1,64}' is not '[A-Za-z0-9_ -]{1,64}'$/,
];
// Lowercase snake_case codes, such as S4's own reason codes.
const REASON_CODE = /^[a-z][a-z0-9_]{0,63}$/;

export function safeReason(reason: unknown): string {
  if (typeof reason !== 'string') return WITHHELD_REASON;
  const weak = WEAK_SIMILARITY.exec(reason);
  if (weak) return weak[1]!;
  if (S3_TEMPLATES.some(template => template.test(reason))
    && !SENSITIVE_TEXT.test(reason) && !PHONE_IN_TEXT.test(reason)) return reason;
  if (REASON_CODE.test(reason) && !SENSITIVE_TEXT.test(reason) && !/\d{4,}/.test(reason)) return reason;
  // Anything else (including text that merely looks harmless) is withheld.
  return WITHHELD_REASON;
}
