import Link from "next/link";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime, fmtRupiah } from "@/lib/format";
import { createUser, deleteUser } from "@/app/auth-actions";
import { Alert, PageHeader, StatusDot } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/client";
import { UserAdminMenu } from "./user-actions";

export const metadata = { title: "Pengguna" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireAdmin();
  const { error } = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { hostings: true, vpses: true, domains: true, emails: true, backlinks: true } } },
  });
  const bought = await prisma.backlinkOrder.groupBy({ by: ["ownerId"], _sum: { quantity: true, price: true } });
  const boughtMap = new Map(bought.map((b) => [b.ownerId, b._sum]));
  const lastActive = await prisma.auditLog.groupBy({ by: ["userId"], _max: { createdAt: true } });
  const lastMap = new Map(lastActive.map((a) => [a.userId, a._max.createdAt]));

  const num = (href: string, n: number) => (
    <Link className={`tabular-nums hover:underline ${n ? "" : "text-faint"}`} href={href}>{n}</Link>
  );

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Pengguna" desc="Rekap pekerjaan tiap anggota tim. Klik nama untuk dashboard user, klik angka untuk melihat datanya." />
        <Alert error={error} />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th><th>Role</th><th>2FA</th><th className="text-right">Domain</th><th className="text-right">Hosting</th>
                <th className="text-right">VPS</th><th className="text-right">Akun</th><th className="text-right">Backlink</th>
                <th>Aktif terakhir</th><th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const b = boughtMap.get(u.id);
                const last = lastMap.get(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/?owner=${u.id}`} className="block">
                        <span className="min-w-0 leading-tight">
                          <span className="block font-medium hover:underline">{u.name}{u.id === me.id && <span className="ml-1 font-normal text-muted">(kamu)</span>}</span>
                          <span className="block text-xs text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td><span className="badge">{u.role === "ADMIN" ? "Admin" : "Member"}</span></td>
                    <td className="whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${u.totpEnabledAt ? "" : "font-medium"}`}>
                        <StatusDot tone={u.totpEnabledAt ? "ok" : "warn"} />{u.totpEnabledAt ? "Aktif" : "Belum"}
                      </span>
                    </td>
                    <td className="text-right">{num(`/domains?owner=${u.id}`, u._count.domains)}</td>
                    <td className="text-right">{num(`/hosting?owner=${u.id}`, u._count.hostings)}</td>
                    <td className="text-right">{num(`/vps?owner=${u.id}`, u._count.vpses)}</td>
                    <td className="text-right">{num(`/emails?owner=${u.id}`, u._count.emails)}</td>
                    <td className="text-right whitespace-nowrap">
                      <Link className="tabular-nums hover:underline" href={`/backlinks?owner=${u.id}`}>{(b?.quantity ?? 0).toLocaleString("id-ID")} link</Link>
                      <div className="text-xs text-muted tabular-nums">{u._count.backlinks} order · {fmtRupiah(b?.price ?? 0)}</div>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      <div className="text-muted tabular-nums">{last ? fmtDateTime(last) : "—"}</div>
                      <Link className="underline decoration-line-strong underline-offset-4 hover:decoration-fg" href={`/audit?owner=${u.id}`}>Aktivitas</Link>
                    </td>
                    <td className="text-right">
                      {u.id !== me.id && (
                        <span className="inline-flex items-center">
                        <UserAdminMenu id={u.id} email={u.email} has2fa={!!u.totpEnabledAt} />
                        <form action={deleteUser.bind(null, u.id)}>
                          <ConfirmSubmit className="btn btn-ghost btn-icon hover:text-danger" title="Hapus user" message={`Hapus ${u.email}? Semua datanya akan dipindahkan ke akunmu.`}>
                            <Trash2 />
                          </ConfirmSubmit>
                        </form>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold">Tambah pengguna</h2>
        <form action={createUser} className="card">
          <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
            <div><label className="label" htmlFor="name">Nama</label><input id="name" name="name" className="input" required /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div>
            <div>
              <label className="label" htmlFor="password">Password awal</label>
              <input id="password" name="password" type="password" minLength={10} autoComplete="new-password" className="input" required />
              <p className="hint">Minimal 10 karakter. Minta user menggantinya setelah login.</p>
            </div>
            <div>
              <label className="label" htmlFor="role">Role</label>
              <select id="role" name="role" className="input" defaultValue="MEMBER">
                <option value="MEMBER">Member — hanya data sendiri</option>
                <option value="ADMIN">Admin — lihat semua data, kelola user</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end rounded-b-lg border-t border-line bg-subtle/60 px-5 py-3">
            <SubmitButton pendingText="Menambah…">Tambah pengguna</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
