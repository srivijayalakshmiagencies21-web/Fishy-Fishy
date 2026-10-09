export const MOBILE_DIGITS = 10;

export function mobileDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, MOBILE_DIGITS);
}

export function isValidMobile(value: string | null | undefined) {
  return /^\d{10}$/.test((value ?? "").trim());
}
