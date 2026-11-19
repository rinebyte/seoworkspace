import Link from "next/link";
import { redirect } from "next/navigation";
import { getPending2faUser } from "@/lib/auth";
import { verifyLogin2fa } from "@/app/auth-actions";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verifikasi 2FA" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getPending2faUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Verifikasi dua langkah</h1>
          <p className="mt-1 text-[13px] text-muted">Masukkan kode 6 digit dari aplikasi authenticator untuk <span className="text-fg">{user.email}</span>.</p>
        </div>
        <Alert error={error} />
        <form action={verifyLogin2fa} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="code">Kode</label>
            <input
              id="code"
              name="code"
              className="input h-11 text-center font-mono text-lg tracking-[0.3em]"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={20}
              placeholder="000000"
            />
            <p className="hint">Kehilangan HP? Masukkan salah satu recovery code (format XXXXX-XXXXX).</p>
          </div>
          <SubmitButton className="btn btn-primary h-9 w-full" pendingText="Memeriksa…">Verifikasi</SubmitButton>
          <Link href="/login" className="block text-center text-xs text-muted hover:text-fg">Kembali ke login</Link>
        </form>
      </div>
    </main>
  );
}
