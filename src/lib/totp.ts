import "server-only";
import { authenticator } from "otplib";

/** Terima secret base32 atau URL otpauth://, kembalikan secret base32 bersih. */
export function normalizeTotpSecret(input: string): string | null {
  let s = input.trim();
  if (s.toLowerCase().startsWith("otpauth://")) {
    try {
      s = new URL(s).searchParams.get("secret") ?? "";
    } catch {
      return null;
    }
  }
  s = s.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "");
  if (!/^[A-Z2-7]{16,}$/.test(s)) return null;
  return s;
}

export function totpNow(secret: string) {
  return { code: authenticator.generate(secret), remaining: authenticator.timeRemaining() };
}
