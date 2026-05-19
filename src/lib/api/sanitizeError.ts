/**
 * Sanitizes error messages before returning to clients.
 *
 * Raw error.message may contain Prisma internals (table names, field names,
 * connection strings) which should never be sent to the browser.
 * Only our own explicitly-safe messages are forwarded; everything else
 * is replaced with the provided fallback.
 */

// Messages we generate ourselves — safe to forward as-is
const SAFE_PREFIX = [
  'تعذر',
  'يجب',
  'الحساب',
  'الدور',
  'البيانات',
  'رقم الطلب',
  'غير مصرح',
  'Unable to',
  'You must',
  'Invalid',
  'Required',
  'Not found',
  'Unauthorized',
];

function isSafeMessage(message: string): boolean {
  return SAFE_PREFIX.some((prefix) => message.startsWith(prefix));
}

export function sanitizeError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message.trim();
  if (!msg) return fallback;
  if (isSafeMessage(msg)) return msg;
  // Prisma errors, stack traces, DB internals → fallback only
  return fallback;
}
