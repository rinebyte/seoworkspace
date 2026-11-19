import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { login, setupFirstAdmin } from "@/app/auth-actions";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getUser()) redirect("/");
  const firstRun = (await prisma.user.count()) === 0;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">{firstRun ? "Siapkan SEO Workspace" : "Masuk ke SEO Workspace"}</h1>
          <p className="mt-1 text-[13px] text-muted">{firstRun ? "Buat akun admin pertama untuk tim kamu." : "Gunakan akun yang diberikan admin."}</p>
        </div>
        <Alert error={error} />
        <form action={firstRun ? setupFirstAdmin : login} className="card space-y-4 p-6">
          {firstRun && (
            <div><label className="label" htmlFor="name">Nama</label><input id="name" name="name" className="input" required /></div>
          )}
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="username" autoFocus required /></div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="input" autoComplete={firstRun ? "new-password" : "current-password"} minLength={firstRun ? 10 : undefined} required />
            {firstRun && <p className="hint">Minimal 10 karakter.</p>}
          </div>
          <SubmitButton className="btn btn-primary h-9 w-full" pendingText="Memproses…">{firstRun ? "Buat admin & masuk" : "Masuk"}</SubmitButton>
        </form>
      </div>
    </main>
  );
}
