import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ownerScope } from "@/lib/repo";
import { createCategory, deleteCategory, renameCategory } from "@/app/actions";
import { Alert, CategoryTag, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/client";

export const metadata = { title: "Kategori domain" };

export default async function CategoriesPage({
  params, searchParams,
}: { params: Promise<{ resource: string }>; searchParams: Promise<{ error?: string }> }) {
  if ((await params).resource !== "domains") notFound();
  const { error } = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const cats = await prisma.domainCategory.findMany({
    where: ownerScope(user),
    include: { _count: { select: { domains: true } }, owner: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/domains", label: "Domain" }]}
        title="Kategori domain"
        desc="Kelompokkan domain (mis. per niche atau per project). Ganti nama ke nama kategori lain yang sudah ada untuk menggabungkan keduanya."
      />
      <Alert error={error} />

      <form action={createCategory} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="name">Kategori baru</label>
          <input id="name" name="name" className="input" placeholder="mis. Money site kesehatan" required maxLength={60} />
        </div>
        <SubmitButton pendingText="Menambah…">Tambah</SubmitButton>
      </form>

      <div className="card overflow-x-auto">
        {cats.length === 0 ? (
          <EmptyState title="Belum ada kategori">Buat di atas, atau ketik langsung di kolom Kategori saat menambah domain.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Kategori</th><th>Ganti nama</th><th className="text-right">Domain</th>{isAdmin && <th>Pemilik</th>}<th className="w-12"></th></tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td><CategoryTag name={c.name} /></td>
                  <td>
                    <form action={renameCategory.bind(null, c.id)} className="flex gap-1.5">
                      <input name="name" defaultValue={c.name} className="input !h-7 min-w-40 text-[13px]" maxLength={60} required />
                      <SubmitButton className="btn btn-xs h-7" pendingText="…">Simpan</SubmitButton>
                    </form>
                  </td>
                  <td className="text-right tabular-nums">
                    <Link className="hover:underline" href={`/domains?cat=${encodeURIComponent(c.name)}`}>{c._count.domains}</Link>
                  </td>
                  {isAdmin && <td className="whitespace-nowrap text-muted">{c.owner.id === user.id ? "Kamu" : c.owner.name}</td>}
                  <td className="text-right">
                    <form action={deleteCategory.bind(null, c.id)}>
                      <ConfirmSubmit
                        className="btn btn-ghost btn-icon hover:text-danger"
                        title="Hapus kategori"
                        message={`Hapus kategori "${c.name}"? ${c._count.domains} domain di dalamnya tidak dihapus, hanya jadi tanpa kategori.`}
                      >
                        <Trash2 />
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
