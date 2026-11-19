import Link from "next/link";
import { ArrowRight, Globe, HardDrive, Link2, Mail, Server } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtDateTime, fmtRupiah } from "@/lib/format";
import { BACKLINK_STATUS, BACKLINK_TYPES, optionLabel } from "@/lib/resources";
import { requireUser } from "@/lib/auth";
import { ownerScope, userOptions } from "@/lib/repo";
import { EmptyState, ExpiryBadge, OwnerFilter, PageHeader, Progress, StatusBadge } from "@/components/ui";

const ACTION_LABEL: Record<string, string> = {
  LOGIN: "masuk", LOGIN_FAILED: "gagal login", SETUP_ADMIN: "membuat admin", CREATE: "menambah", UPDATE: "mengubah",
  DELETE: "menghapus", VIEW_SECRET: "membuka password", COPY_SECRET: "menyalin password", VIEW_2FA: "membuka kode 2FA",
  ADD_LINKS: "menambah link", CHANGE_PASSWORD: "ganti password", BULK_CREATE: "bulk add",
  "2FA_FAILED": "salah kode 2FA", "2FA_ENABLED": "mengaktifkan 2FA", "2FA_DISABLED": "mematikan 2FA",
  RESET_PASSWORD: "reset password", RESET_2FA: "reset 2FA", LOGOUT_ALL: "mengeluarkan semua sesi",
};
const ENTITY_LABEL: Record<string, string> = {
  hosting: "hosting", vps: "VPS", domain: "domain", emailAccount: "akun", backlinkOrder: "order backlink", user: "user", domainCategory: "kategori",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { owner } = await searchParams;
  const scope = ownerScope(user, isAdmin ? owner : undefined);
  const soon = new Date(Date.now() + 30 * 86400000);
  const activityWhere = isAdmin ? (owner ? { userId: owner } : {}) : { userId: user.id };

  const [
    hosting, vps, domains, redirects, moneySites, emails, emails2fa, orders,
    delivered, live, expHosting, expVps, expDomain, activity,
  ] = await Promise.all([
    prisma.hosting.count({ where: scope }),
    prisma.vps.count({ where: scope }),
    prisma.domain.count({ where: scope }),
    prisma.domain.count({ where: { ...scope, redirectTo: { not: null } } }),
    prisma.domain.count({ where: { ...scope, status: "MONEY_SITE" } }),
    prisma.emailAccount.count({ where: scope }),
    prisma.emailAccount.count({ where: { ...scope, totpSecretEnc: { not: null } } }),
    prisma.backlinkOrder.findMany({ where: scope, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.backlinkItem.count({ where: { order: scope } }),
    prisma.backlinkItem.groupBy({ by: ["orderId"], where: { status: "LIVE", order: scope }, _count: true }),
    prisma.hosting.findMany({ where: { ...scope, expiresAt: { lte: soon } }, orderBy: { expiresAt: "asc" }, take: 20 }),
    prisma.vps.findMany({ where: { ...scope, expiresAt: { lte: soon } }, orderBy: { expiresAt: "asc" }, take: 20 }),
    prisma.domain.findMany({ where: { ...scope, expiresAt: { lte: soon } }, orderBy: { expiresAt: "asc" }, take: 20 }),
    prisma.auditLog.findMany({ where: activityWhere, orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
  ]);

  const liveMap = new Map(live.map((r) => [r.orderId, r._count]));
  const totalLive = live.reduce((s, r) => s + r._count, 0);
  const totalBought = orders.reduce((s, o) => s + o.quantity, 0);
  const totalSpend = orders.reduce((s, o) => s + (o.price ?? 0), 0);

  const vendors = new Map<string, { orders: number; bought: number; delivered: number; live: number; spend: number }>();
  for (const o of orders) {
    const v = vendors.get(o.vendor) ?? { orders: 0, bought: 0, delivered: 0, live: 0, spend: 0 };
    v.orders++;
    v.bought += o.quantity;
    v.delivered += o._count.items;
    v.live += liveMap.get(o.id) ?? 0;
    v.spend += o.price ?? 0;
    vendors.set(o.vendor, v);
  }
  const vendorRows = [...vendors.entries()].sort((a, b) => b[1].bought - a[1].bought);

  const expiring = [
    ...expHosting.map((h) => ({ kind: "Hosting", name: h.label, href: `/hosting/${h.id}`, date: h.expiresAt, mono: false })),
    ...expVps.map((v) => ({ kind: "VPS", name: v.label, href: `/vps/${v.id}`, date: v.expiresAt, mono: false })),
    ...expDomain.map((d) => ({ kind: "Domain", name: d.name, href: `/domains/${d.id}`, date: d.expiresAt, mono: true })),
  ].sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const q = owner && isAdmin ? `?owner=${owner}` : "";
  const stats = [
    { label: "Domain", value: domains, sub: `${redirects} redirect · ${moneySites} money site`, href: "/domains", icon: Globe },
    { label: "Hosting", value: hosting, sub: "akun hosting", href: "/hosting", icon: HardDrive },
    { label: "VPS", value: vps, sub: "server", href: "/vps", icon: Server },
    { label: "Email & Akun", value: emails, sub: `${emails2fa} dengan 2FA`, href: "/emails", icon: Mail },
    { label: "Backlink dibeli", value: totalBought, sub: `${delivered.toLocaleString("id-ID")} terkirim · ${totalLive.toLocaleString("id-ID")} live`, href: "/backlinks", icon: Link2 },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        desc={isAdmin ? (owner ? "Ringkasan data user terpilih" : "Ringkasan data semua user") : `Halo ${user.name.split(" ")[0]}, ini ringkasan datamu`}
      >
        {isAdmin && <OwnerFilter path="/" users={await userOptions()} value={owner} />}
      </PageHeader>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={`${s.href}${q}`} className="card group p-4 transition-colors hover:border-line-strong">
            <div className="flex items-center justify-between text-[13px] text-muted">
              {s.label}
              <s.icon className="size-4 text-faint group-hover:text-fg" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{s.value.toLocaleString("id-ID")}</div>
            <div className="mt-0.5 truncate text-xs text-muted">{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Backlink per vendor */}
        <section className="card lg:col-span-3">
          <CardHeader title="Backlink per vendor" meta={`Total belanja ${fmtRupiah(totalSpend)}`} href={`/backlinks${q}`} />
          {vendorRows.length === 0 ? <EmptyState title="Belum ada order backlink" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Vendor</th><th className="text-right">Order</th><th className="min-w-44">Terkirim / live</th><th className="text-right">Belanja</th></tr></thead>
                <tbody>
                  {vendorRows.map(([name, v]) => (
                    <tr key={name}>
                      <td className="font-medium">{name}</td>
                      <td className="text-right tabular-nums">{v.orders}</td>
                      <td><Progress done={v.delivered} live={v.live} total={v.bought} wide /></td>
                      <td className="text-right whitespace-nowrap tabular-nums">{fmtRupiah(v.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-fg" /> Live</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-fg/25" /> Terkirim</span>
              </div>
            </div>
          )}
        </section>

        {/* Expired */}
        <section className="card lg:col-span-2">
          <CardHeader title="Segera expired" meta="≤ 30 hari" />
          {expiring.length === 0 ? <EmptyState title="Semua aman">Tidak ada yang expired dalam 30 hari.</EmptyState> : (
            <ul className="divide-y divide-line">
              {expiring.slice(0, 8).map((e) => (
                <li key={e.href}>
                  <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-hover/60">
                    <span className="w-14 shrink-0 text-xs text-muted">{e.kind}</span>
                    <span className={`min-w-0 flex-1 truncate font-medium ${e.mono ? "font-mono text-[12.5px]" : ""}`}>{e.name}</span>
                    <ExpiryBadge date={e.date} compact />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Order terbaru */}
        <section className="card lg:col-span-3">
          <CardHeader title="Order backlink terbaru" href={`/backlinks${q}`} />
          {orders.length === 0 ? <EmptyState title="Belum ada order" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Vendor</th><th>Jenis</th><th>Status</th><th className="min-w-36">Progres</th></tr></thead>
                <tbody>
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id}>
                      <td><Link className="font-medium hover:underline" href={`/backlinks/${o.id}`}>{o.vendor}</Link></td>
                      <td className="text-muted">{optionLabel(BACKLINK_TYPES, o.type)}</td>
                      <td><StatusBadge value={o.status} label={optionLabel(BACKLINK_STATUS, o.status)} /></td>
                      <td><Progress done={o._count.items} live={liveMap.get(o.id) ?? 0} total={o.quantity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Aktivitas */}
        <section className="card lg:col-span-2">
          <CardHeader title="Aktivitas terbaru" href={isAdmin ? `/audit${owner ? `?owner=${owner}` : ""}` : undefined} />
          {activity.length === 0 ? <EmptyState title="Belum ada aktivitas" /> : (
            <ul className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-[13px]">
                  <div className="truncate">
                    <span className="font-medium">{a.user?.name ?? "—"}</span>{" "}
                    <span className={a.action.includes("SECRET") || a.action.includes("2FA") || a.action === "LOGIN_FAILED" ? "font-medium" : "text-muted"}>
                      {ACTION_LABEL[a.action] ?? a.action}
                    </span>{" "}
                    {a.action !== "LOGIN" && <span className="text-muted">{ENTITY_LABEL[a.entity] ?? a.entity}</span>}
                  </div>
                  <div className="mt-0.5 flex gap-2 text-xs text-faint">
                    <span className="shrink-0 tabular-nums">{fmtDateTime(a.createdAt)}</span>
                    {a.detail && <span className="truncate">· {a.detail}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function CardHeader({ title, meta, href }: { title: string; meta?: string; href?: string }) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 border-b border-line px-4">
      <h2 className="truncate text-[13px] font-semibold">{title}</h2>
      <div className="flex items-center gap-3 text-xs text-muted">
        {meta && <span className="hidden sm:inline">{meta}</span>}
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 hover:text-fg">
            <span className="whitespace-nowrap">Lihat semua</span> <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
