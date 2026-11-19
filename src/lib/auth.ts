import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import {
  PENDING_2FA_COOKIE, PENDING_2FA_MINUTES, SESSION_COOKIE, SESSION_DAYS, signToken, verifyToken,
} from "./session-token";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge,
});

// cache(): layout + page dalam satu request cukup sekali query user.
export const getUser = cache(async () => {
  const c = await cookies();
  const claims = await verifyToken("session", c.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const u = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, name: true, email: true, role: true, sessionVersion: true, totpEnabledAt: true },
  });
  // Sesi lama (sebelum ganti password / "keluar dari semua perangkat") tidak berlaku lagi.
  if (!u || u.sessionVersion !== claims.sv) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, has2fa: !!u.totpEnabledAt };
});

/**
 * Wajib login. Jika REQUIRE_2FA=true dan user belum mengaktifkan 2FA, semua halaman & aksi
 * diarahkan ke /account (kecuali yang memanggil dengan allowWithout2fa: halaman Akun & aksi 2FA).
 */
export async function requireUser(opts?: { allowWithout2fa?: boolean }) {
  const u = await getUser();
  if (!u) redirect("/login");
  if (require2faForAll() && !u.has2fa && !opts?.allowWithout2fa) redirect("/account?setup2fa=1");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

export function require2faForAll() {
  return process.env.REQUIRE_2FA === "true";
}

export async function startSession(uid: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { sessionVersion: true } });
  const c = await cookies();
  c.set(SESSION_COOKIE, await signToken("session", { uid, sv: u.sessionVersion }), cookieOpts(SESSION_DAYS * 24 * 3600));
  c.delete(PENDING_2FA_COOKIE);
}

export async function endSession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(PENDING_2FA_COOKIE);
}

/** Password benar tapi 2FA aktif: simpan status "menunggu kode" selama 10 menit. */
export async function startPending2fa(uid: string, sv: number) {
  const c = await cookies();
  c.set(PENDING_2FA_COOKIE, await signToken("2fa", { uid, sv }), cookieOpts(PENDING_2FA_MINUTES * 60));
}

export async function getPending2faUser() {
  const c = await cookies();
  const claims = await verifyToken("2fa", c.get(PENDING_2FA_COOKIE)?.value);
  if (!claims) return null;
  const u = await prisma.user.findUnique({ where: { id: claims.uid } });
  if (!u || u.sessionVersion !== claims.sv || !u.totpEnabledAt || !u.totpSecretEnc) return null;
  return u;
}

/** Naikkan versi sesi → semua perangkat yang login dengan versi lama otomatis keluar. */
export async function revokeSessions(uid: string) {
  await prisma.user.update({ where: { id: uid }, data: { sessionVersion: { increment: 1 } } });
}

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: string,
) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, detail } });
}

/** Rate limit permanen (tahan restart): hitung kegagalan 15 menit terakhir dari audit log. */
export async function tooManyFailures(action: "LOGIN_FAILED" | "2FA_FAILED", key: string, max = 5) {
  const n = await prisma.auditLog.count({
    where: { action, entityId: key, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  return n >= max;
}
