// Dipakai di middleware (edge) dan server: hanya jose, tanpa Prisma.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "seo_session";
export const PENDING_2FA_COOKIE = "seo_2fa";
export const SESSION_DAYS = 7;
export const PENDING_2FA_MINUTES = 10;

type Kind = "session" | "2fa";
export type SessionClaims = { uid: string; sv: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter");
  return new TextEncoder().encode(s);
}

export async function signToken(kind: Kind, claims: SessionClaims) {
  return new SignJWT({ ...claims, typ: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(kind === "session" ? `${SESSION_DAYS}d` : `${PENDING_2FA_MINUTES}m`)
    .sign(secret());
}

/** Verifikasi tanda tangan + jenis token. Versi sesi (sv) dicek terhadap DB di server, bukan di sini. */
export async function verifyToken(kind: Kind, token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.typ !== kind || typeof payload.uid !== "string" || typeof payload.sv !== "number") return null;
    return { uid: payload.uid, sv: payload.sv };
  } catch {
    return null;
  }
}
