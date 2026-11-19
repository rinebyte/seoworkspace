import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPlus, Plus, Settings2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getResource } from "@/lib/resources";
import { listRecords, ownerScope, userOptions, type Viewer } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { EmptyState, FieldValue, OwnerFilter, PageHeader, Progress, prepareRow } from "@/components/ui";
import { SearchBox } from "@/components/client";

export async function generateMetadata({ params }: { params: Promise<{ resource: string }> }) {
  return { title: getResource((await params).resource)?.title };
}

export default async function ListPage({
  params, searchParams,
}: { params: Promise<{ resource: string }>; searchParams: Promise<{ q?: string; owner?: string; cat?: string }> }) {
  const { resource } = await params;
  const { q, owner, cat } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const catFilter = res.key === "domains" && cat
    ? cat === NO_CAT ? { categoryId: null } : { category: { name: cat } }
    : undefined;
  const rows = (await listRecords(res, user, q, isAdmin ? owner : undefined, catFilter)).map((r) => prepareRow(res, r));
  const cols = res.fields.filter((f) => f.list);

  return (
    <>
      <PageHeader title={res.title} desc={res.description}>
        {res.key === "domains" && (
          <Link href="/domains/bulk" className="btn"><ListPlus /> Bulk add</Link>
        )}
        <Link href={`/${res.key}/new`} className="btn btn-primary"><Plus /> Tambah</Link>
      </PageHeader>

      {res.key === "domains" && <CategoryChips viewer={user} owner={isAdmin ? owner : undefined} active={cat} q={q} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox placeholder={`Cari ${res.title.toLowerCase()}…`} />
        {isAdmin && <OwnerFilter path={`/${res.key}`} users={await userOptions()} value={owner} keep={{ q, cat }} />}
        <span className="ml-auto text-xs text-muted tabular-nums">{rows.length} data</span>
      </div>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title={q ? "Tidak ada hasil" : `Belum ada ${res.singular.toLowerCase()}`}>
            {q ? <>Tidak ada yang cocok dengan “{q}”.</> : (
              <Link className="btn mt-2" href={`/${res.key}/new`}><Plus /> Tambah {res.singular.toLowerCase()}</Link>
            )}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {cols.map((f) => <th key={f.name}>{f.label}</th>)}
                {res.model === "backlinkOrder" && <th>Terkirim / live</th>}
                {isAdmin && <th>Pemilik</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {cols.map((f, i) => (
                    <td key={f.name} className={i === 0 ? "max-w-72" : "max-w-64"}>
                      {i === 0 ? (
                        <Link href={`/${res.key}/${row.id}`} className={`block truncate font-medium hover:underline ${f.mono ? "font-mono text-[12.5px]" : ""}`}>
                          {row[f.name]}
                        </Link>
                      ) : (
                        <FieldValue res={res} f={f} row={row} />
                      )}
                    </td>
                  ))}
                  {res.model === "backlinkOrder" && (
                    <td><Progress done={row._count?.items ?? 0} live={row.__live} total={row.quantity} /></td>
                  )}
                  {isAdmin && <td className="whitespace-nowrap text-muted">{row.owner?.id === user.id ? "Kamu" : row.owner?.name}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const NO_CAT = "__none";

/** Chip filter kategori domain + jumlahnya. Admin: kategori dari semua user digabung per nama. */
async function CategoryChips({ viewer, owner, active, q }: { viewer: Viewer; owner?: string; active?: string; q?: string }) {
  const scope = ownerScope(viewer, owner);
  const [cats, total, none] = await Promise.all([
    prisma.domainCategory.findMany({ where: scope, include: { _count: { select: { domains: true } } } }),
    prisma.domain.count({ where: scope }),
    prisma.domain.count({ where: { ...scope, categoryId: null } }),
  ]);
  const byName = new Map<string, number>();
  for (const c of cats) byName.set(c.name, (byName.get(c.name) ?? 0) + c._count.domains);
  const list = [...byName].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const href = (c?: string) => {
    const sp = new URLSearchParams();
    if (c) sp.set("cat", c);
    if (owner) sp.set("owner", owner);
    if (q) sp.set("q", q);
    return `/domains${sp.size ? `?${sp}` : ""}`;
  };
  const chip = (label: string, n: number, value: string | undefined) => {
    const on = (active ?? undefined) === value;
    return (
      <Link
        key={label}
        href={href(value)}
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
          on ? "border-primary bg-primary text-primary-fg" : "border-line bg-panel text-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        {label}
        <span className={`tabular-nums ${on ? "opacity-70" : "text-faint"}`}>{n}</span>
      </Link>
    );
  };

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {chip("Semua", total, undefined)}
        {list.map(([name, n]) => chip(name, n, name))}
        {none > 0 && list.length > 0 && chip("Tanpa kategori", none, NO_CAT)}
      </div>
      <Link href="/domains/categories" className="btn btn-ghost btn-xs shrink-0" title="Kelola kategori">
        <Settings2 /> Kelola
      </Link>
    </div>
  );
}
