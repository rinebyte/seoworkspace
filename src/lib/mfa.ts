import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

// Toleransi ±1 langkah (30 detik) untuk jam HP yang sedikit meleset.
authenticator.options = { window: 1 };

export function newTotpSecret() {
  return authenticator.generateSecret(20);
}

export function verifyTotp(secret: string, code: string) {
  const c = code.replace(/\s/g, "");
  return /^\d{6}$/.test(c) && authenticator.check(c, secret);
}

export async function totpQrSvg(email: string, secret: string) {
  const uri = authenticator.keyuri(email, "SEO Workspace", secret);
  return QRCode.toString(uri, { type: "svg", margin: 1, color: { dark: "#09090b", light: "#ffffff" } });
}

const hash = (s: string) => createHash("sha256").update(s.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

/** 10 recovery code format XXXXX-XXXXX. Kembalikan teks asli (ditampilkan sekali) + hash (disimpan). */
export function newRecoveryCodes() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = Array.from({ length: 10 }, () => {
    const b = randomBytes(10);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { codes, stored: JSON.stringify(codes.map(hash)) };
}

/** Cek recovery code; jika cocok, kembalikan daftar baru tanpa kode itu (sekali pakai). */
export function consumeRecoveryCode(stored: string | null, input: string): string | null {
  if (!stored) return null;
  const list: string[] = JSON.parse(stored);
  const h = hash(input);
  const idx = list.indexOf(h);
  if (idx === -1) return null;
  list.splice(idx, 1);
  return JSON.stringify(list);
}

export function recoveryCount(stored: string | null) {
  return stored ? (JSON.parse(stored) as string[]).length : 0;
}
