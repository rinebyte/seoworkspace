import { ShieldCheck, ShieldOff } from "lucide-react";
import { prisma } from "@/lib/db";
import { require2faForAll, requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { recoveryCount, totpQrSvg } from "@/lib/mfa";
import { fmtDateTime } from "@/lib/format";
import { begin2faSetup, cancel2faSetup, changePassword, disable2fa, logout, logoutEverywhere } from "@/app/auth-actions";
import { Alert, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Confirm2fa, RegenerateCodes } from "./security";

export const metadata = { title: "Akun saya" };

const OK: Record<string, string> = {
  password: "Password berhasil diganti. Perangkat lain otomatis keluar.",
  "logout-all": "Semua perangkat lain sudah dikeluarkan.",
  "2fa-off": "2FA dinonaktifkan.",
  "1": "Berhasil disimpan.",
};

function Section({ title, desc, children, footer }: { title: string; desc?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="space-y-4 p-5 md:p-6">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="flex justify-end gap-2 rounded-b-lg border-t border-line bg-subtle/60 px-5 py-3">{footer}</div>}
    </section>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; setup2fa?: string }> }) {
  const me = await requireUser({ allowWithout2fa: true });
  const { error, ok, setup2fa } = await searchParams;
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { email: true, totpEnabledAt: true, totpPendingEnc: true, recoveryCodes: true },
  });
  const pendingSecret = u.totpPendingEnc ? decrypt(u.totpPendingEnc) : null;
  const qr = pendingSecret ? await totpQrSvg(u.email, pendingSecret) : null;
  const mustSetup = require2faForAll() && !u.totpEnabledAt;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Akun saya" desc={`${me.name} · ${me.email} · ${me.role === "ADMIN" ? "Admin" : "Member"}`} />
      {mustSetup && (setup2fa || !ok) && (
        <Alert error="Admin mewajibkan 2FA. Aktifkan 2FA di bawah sebelum bisa membuka halaman lain." />
      )}
      <Alert error={error} ok={ok ? OK[ok] ?? OK["1"] : undefined} />

      {/* 2FA */}
      <Section
        title="Verifikasi dua langkah (2FA)"
        desc="Setelah aktif, login butuh password + kode 6 digit dari aplikasi authenticator di HP."
      >
        {u.totpEnabledAt ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3">
              <ShieldCheck className="size-5 text-ok" strokeWidth={1.75} />
              <div className="text-[13px]">
                <div className="font-medium">2FA aktif</div>
                <div className="text-muted">Sejak {fmtDateTime(u.totpEnabledAt)} · {recoveryCount(u.recoveryCodes)} recovery code tersisa</div>
              </div>
            </div>
            <RegenerateCodes />
            <details className="group rounded-lg border border-line">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] text-muted hover:text-fg">Nonaktifkan 2FA…</summary>
              <form action={disable2fa} className="space-y-3 border-t border-line p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label" htmlFor="d-password">Password</label><input id="d-password" name="password" type="password" autoComplete="current-password" className="input" required /></div>
                  <div><label className="label" htmlFor="d-code">Kode 2FA</label><input id="d-code" name="code" inputMode="numeric" autoComplete="one-time-code" className="input font-mono" required /></div>
                </div>
                <SubmitButton className="btn btn-danger" pendingText="Memproses…">Nonaktifkan 2FA</SubmitButton>
              </form>
            </details>
          </div>
        ) : pendingSecret && qr ? (
          <div className="space-y-4">
            <Confirm2fa qrSvg={qr} secret={pendingSecret} />
            <form action={cancel2faSetup}><button className="btn btn-ghost btn-xs">Batalkan</button></form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-3 text-[13px]">
              <ShieldOff className="size-5 text-faint" strokeWidth={1.75} />
              <span className="text-muted">2FA belum aktif. Akun ini menyimpan password tim, sangat disarankan aktif.</span>
            </div>
            <form action={begin2faSetup}><SubmitButton pendingText="Menyiapkan…">Aktifkan 2FA</SubmitButton></form>
          </div>
        )}
      </Section>

      {/* Password */}
      <form action={changePassword}>
        <Section
          title="Ganti password"
          desc="Setelah diganti, semua perangkat lain otomatis keluar."
          footer={<SubmitButton pendingText="Menyimpan…">Ganti password</SubmitButton>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="current">Password lama</label><input id="current" name="current" type="password" autoComplete="current-password" className="input" required /></div>
            <div><label className="label" htmlFor="next">Password baru</label><input id="next" name="next" type="password" minLength={10} autoComplete="new-password" className="input" required /><p className="hint">Minimal 10 karakter.</p></div>
          </div>
        </Section>
      </form>

      {/* Sesi */}
      <Section title="Sesi login" desc="Lupa logout di komputer lain, atau curiga akun dipakai orang lain? Keluarkan semua perangkat.">
        <div className="flex flex-wrap gap-2">
          <form action={logoutEverywhere}><SubmitButton className="btn" pendingText="Memproses…">Keluar dari semua perangkat lain</SubmitButton></form>
          <form action={logout}><button className="btn btn-danger">Keluar dari perangkat ini</button></form>
        </div>
      </Section>
    </div>
  );
}
