/**
 * Phone number formatting utilities for North American format: (555) 555-5555
 */

/** Format a raw phone string to (555) 555-5555 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Handle 11-digit (1 + 10) or 10-digit numbers
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw; // Return as-is if not 10 digits
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** Progressive formatting as user types — for controlled inputs */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Strip formatted phone back to digits for storage */
export function stripPhone(formatted: string): string {
  return formatted.replace(/\D/g, '');
}
