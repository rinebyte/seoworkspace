"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  audit, endSession, getPending2faUser, requireAdmin, requireUser, revokeSessions, startPending2fa,
  startSession, tooManyFailures,
} from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { consumeRecoveryCode, newRecoveryCodes, newTotpSecret, totpStep } from "@/lib/mfa";

function err(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// Hash dummy supaya waktu respons sama saat email tidak terdaftar (mencegah tebak email).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

/**
 * Pakai kode TOTP: valid DAN langkah waktunya lebih baru dari kode terakhir yang dipakai user ini.
 * Update bersyarat (atomik), jadi kode yang sama tidak bisa dipakai dua kali, termasuk bila dikirim bersamaan.
 */
async function claimTotp(userId: string, secret: string, code: string) {
  const step = totpStep(secret, code);
  if (step === null) return false;
  const r = await prisma.user.updateMany({
    where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return r.count === 1;
}

// ---------- Login ----------

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  const key = `${email}|${ip}`;
  if (await tooManyFailures("LOGIN_FAILED", key)) err("/login", "Terlalu banyak percobaan. Coba lagi 15 menit lagi.");

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    await audit(user?.id ?? null, "LOGIN_FAILED", "user", key, `${email} dari ${ip}`);
    err("/login", "Email atau password salah");
  }

  if (user.totpEnabledAt && user.totpSecretEnc) {
    await startPending2fa(user.id, user.sessionVersion);
    redirect("/login/2fa");
  }
  await startSession(user.id);
  await audit(user.id, "LOGIN", "user", user.id, ip);
  redirect("/");
}

/** Langkah ke-2: kode dari aplikasi authenticator, atau recovery code. */
export async function verifyLogin2fa(form: FormData) {
  const user = await getPending2faUser();
  if (!user) err("/login", "Sesi verifikasi habis. Silakan login lagi.");
  const ip = await clientIp();
  const key = `${user.id}|${ip}`;
  if (await tooManyFailures("2FA_FAILED", key)) err("/login/2fa", "Terlalu banyak kode salah. Coba lagi 15 menit lagi.");

  const code = String(form.get("code") ?? "").trim();
  let method = "";
  if (/^\d{6}$/.test(code.replace(/\s/g, "")) && (await claimTotp(user.id, decrypt(user.totpSecretEnc!), code))) {
    method = "kode authenticator";
  } else {
    const remaining = consumeRecoveryCode(user.recoveryCodes, code);
    if (remaining !== null) {
      await prisma.user.update({ where: { id: user.id }, data: { recoveryCodes: remaining } });
      method = "recovery code";
    }
  }
  if (!method) {
    await audit(user.id, "2FA_FAILED", "user", key, ip);
    err("/login/2fa", "Kode salah, kedaluwarsa, atau sudah dipakai");
  }
  await startSession(user.id);
  await audit(user.id, "LOGIN", "user", user.id, `${ip} · ${method}`);
  redirect("/");
}

export async function setupFirstAdmin(form: FormData) {
  if ((await prisma.user.count()) > 0) err("/login", "Admin sudah dibuat");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !email) err("/login", "Nama dan email wajib diisi");
  if (password.length < 10) err("/login", "Password minimal 10 karakter");
  const user = await prisma.user.create({
    data: { name, email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  await audit(user.id, "SETUP_ADMIN", "user", user.id);
  await startSession(user.id);
  redirect("/account");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Keluarkan semua perangkat (termasuk yang ini), lalu login ulang otomatis di perangkat ini. */
export async function logoutEverywhere() {
  const me = await requireUser({ allowWithout2fa: true });
  await revokeSessions(me.id);
  await startSession(me.id);
  await audit(me.id, "LOGOUT_ALL", "user", me.id);
  redirect("/account?ok=logout-all");
}

// ---------- Password ----------

export async function changePassword(form: FormData) {
  const me = await requireUser({ allowWithout2fa: true });
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) err("/account", "Password lama salah");
  if (next.length < 10) err("/account", "Password baru minimal 10 karakter");
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  // Perangkat lain otomatis keluar; perangkat ini tetap masuk.
  await revokeSessions(me.id);
  await startSession(me.id);
  await audit(me.id, "CHANGE_PASSWORD", "user", me.id);
  redirect("/account?ok=password");
}

// ---------- 2FA login aplikasi ----------

export async function begin2faSetup() {
  const me = await requireUser({ allowWithout2fa: true });
  if (me.has2fa) return;
  await prisma.user.update({ where: { id: me.id }, data: { totpPendingEnc: encrypt(newTotpSecret()) } });
  revalidatePath("/account");
}

export type Confirm2faResult = { error?: string; codes?: string[] };

export async function confirm2faSetup(_prev: Confirm2faResult | null, form: FormData): Promise<Confirm2faResult> {
  const me = await requireUser({ allowWithout2fa: true });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!user.totpPendingEnc) return { error: "Mulai ulang pengaktifan 2FA." };
  const secret = decrypt(user.totpPendingEnc);
  if (!(await claimTotp(me.id, secret, String(form.get("code") ?? "")))) return { error: "Kode salah. Pastikan jam HP sesuai, lalu coba kode terbaru." };
  const { codes, stored } = newRecoveryCodes();
  await prisma.user.update({
    where: { id: me.id },
    data: {
      totpSecretEnc: encrypt(secret),
      totpPendingEnc: null,
      totpEnabledAt: new Date(),
      recoveryCodes: stored,
      sessionVersion: { increment: 1 }, // sesi lain yang login tanpa 2FA dikeluarkan
    },
  });
  await startSession(me.id);
  await audit(me.id, "2FA_ENABLED", "user", me.id);
  return { codes };
}

export async function cancel2faSetup() {
  const me = await requireUser({ allowWithout2fa: true });
  await prisma.user.update({ where: { id: me.id }, data: { totpPendingEnc: null } });
  revalidatePath("/account");
}

async function checkPasswordAndCode(userId: string, form: FormData) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(String(form.get("password") ?? ""), user.passwordHash))) return "Password salah";
  if (!user.totpSecretEnc || !(await claimTotp(userId, decrypt(user.totpSecretEnc), String(form.get("code") ?? "")))) {
    return "Kode 2FA salah atau sudah dipakai. Tunggu kode berikutnya.";
  }
  return null;
}

export async function disable2fa(form: FormData) {
  const me = await requireUser();
  const problem = await checkPasswordAndCode(me.id, form);
  if (problem) err("/account", problem);
  await prisma.user.update({
    where: { id: me.id },
    data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null },
  });
  await audit(me.id, "2FA_DISABLED", "user", me.id);
  redirect("/account?ok=2fa-off");
}

export async function regenerateRecoveryCodes(_prev: Confirm2faResult | null, form: FormData): Promise<Confirm2faResult> {
  const me = await requireUser();
  const problem = await checkPasswordAndCode(me.id, form);
  if (problem) return { error: problem };
  const { codes, stored } = newRecoveryCodes();
  await prisma.user.update({ where: { id: me.id }, data: { recoveryCodes: stored } });
  await audit(me.id, "2FA_RECOVERY_RESET", "user", me.id);
  return { codes };
}

// ---------- Kelola user (admin) ----------

export async function createUser(form: FormData) {
  const admin = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = form.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  if (!name || !email) err("/users", "Nama dan email wajib diisi");
  if (password.length < 10) err("/users", "Password minimal 10 karakter");
  if (await prisma.user.findUnique({ where: { email } })) err("/users", "Email sudah terdaftar");
  const u = await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 12) },
  });
  await audit(admin.id, "CREATE", "user", u.id, `${email} (${role})`);
  revalidatePath("/users");
}

export type ResetResult = { email: string; password: string } | null;

/** Admin membuat password sementara untuk user (mis. lupa password). Semua sesi user itu dikeluarkan. */
export async function adminResetPassword(userId: string): Promise<ResetResult> {
  const admin = await requireAdmin();
  const temp = randomBytes(9).toString("base64url");
  const u = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(temp, 12), sessionVersion: { increment: 1 } },
  });
  await audit(admin.id, "RESET_PASSWORD", "user", userId, u.email);
  revalidatePath("/users");
  return { email: u.email, password: temp };
}

/** Admin mematikan 2FA user yang kehilangan HP + recovery code. */
export async function adminReset2fa(userId: string) {
  const admin = await requireAdmin();
  const u = await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null, sessionVersion: { increment: 1 } },
  });
  await audit(admin.id, "RESET_2FA", "user", userId, u.email);
  revalidatePath("/users");
}

export async function adminLogoutUser(userId: string) {
  const admin = await requireAdmin();
  await revokeSessions(userId);
  await audit(admin.id, "LOGOUT_ALL", "user", userId, "oleh admin");
  revalidatePath("/users");
}

export async function deleteUser(id: string) {
  const admin = await requireAdmin();
  if (id === admin.id) err("/users", "Tidak bisa menghapus akun sendiri");
  // Kategori domain dipindahkan dulu; jika admin punya kategori bernama sama, digabung.
  for (const c of await prisma.domainCategory.findMany({ where: { ownerId: id } })) {
    const target = await prisma.domainCategory.findUnique({ where: { ownerId_name: { ownerId: admin.id, name: c.name } } });
    if (target) {
      await prisma.domain.updateMany({ where: { categoryId: c.id }, data: { categoryId: target.id } });
      await prisma.domainCategory.delete({ where: { id: c.id } });
    } else {
      await prisma.domainCategory.update({ where: { id: c.id }, data: { ownerId: admin.id } });
    }
  }
  // Data milik user dipindahkan ke admin yang menghapus, supaya tidak hilang.
  const move = { where: { ownerId: id }, data: { ownerId: admin.id } };
  let u;
  try {
    [, , , , , u] = await prisma.$transaction([
      prisma.hosting.updateMany(move),
      prisma.vps.updateMany(move),
      prisma.domain.updateMany(move),
      prisma.emailAccount.updateMany(move),
      prisma.backlinkOrder.updateMany(move),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch {
    err("/users", "Gagal memindahkan data — kemungkinan ada domain yang sama di akunmu. Hapus/rename domain duplikat dulu.");
  }
  await audit(admin.id, "DELETE", "user", id, `${u.email} — data dipindahkan ke ${admin.email}`);
  revalidatePath("/users");
}
