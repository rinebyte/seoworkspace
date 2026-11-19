import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Pencil, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { DOMAIN_STATUS, getResource, ITEM_STATUS, optionLabel } from "@/lib/resources";
import { getRecord } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { addBacklinkItems, deleteBacklinkItem, deleteRecord, setBacklinkItemStatus } from "@/app/actions";
import { EmptyState, FieldValue, PageHeader, Progress, StatusBadge, prepareRow } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit, CopyButton, SubmitButton } from "@/components/client";

export default async function DetailPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  const res = getResource(resource);
  if (!res) notFound();
  const user = await requireUser();
  const raw = await getRecord(res, id, user);
  if (!raw) notFound();
  const row = prepareRow(res, raw);
  const mine = row.owner?.id === user.id;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <PageHeader
          crumbs={[{ href: `/${res.key}`, label: res.title }]}
          title={<span className={res.model === "domain" ? "font-mono" : ""}>{String(row[res.titleField])}</span>}
          desc={<>{res.singular} · {mine ? "milik kamu" : <>milik <span className="font-medium text-fg">{row.owner?.name}</span></>} · diperbarui {fmtDateTime(row.updatedAt)}</>}
        >
          <Link href={`/${res.key}/${id}/edit`} className="btn"><Pencil /> Edit</Link>
          <form action={deleteRecord.bind(null, res.key, id)}>
            <ConfirmSubmit className="btn btn-danger" message={`Hapus ${res.singular.toLowerCase()} ini? Tidak bisa dibatalkan.`}>
              <Trash2 /> Hapus
            </ConfirmSubmit>
          </form>
        </PageHeader>

        <dl className="card divide-y divide-line">
          {res.fields.map((f) => (
            <div key={f.name} className="grid gap-1 px-5 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
              <dt className="text-[13px] text-muted">{f.label}</dt>
              <dd className="min-w-0 text-[13px]"><FieldValue res={res} f={f} row={row} detail /></dd>
            </div>
          ))}
        </dl>
      </div>

      {(res.model === "hosting" || res.model === "vps") && <HostedDomains model={res.model} id={id} ownerId={row.ownerId} />}
      {res.model === "domain" && <DomainBacklinks id={id} ownerId={row.ownerId} />}
      {res.model === "backlinkOrder" && <BacklinkItems orderId={id} quantity={row.quantity} />}
    </div>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {meta && <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{meta}</div>}
    </div>
  );
}

async function HostedDomains({ model, id, ownerId }: { model: "hosting" | "vps"; id: string; ownerId: string }) {
  const domains = await prisma.domain.findMany({
    where: { ownerId, ...(model === "hosting" ? { hostingId: id } : { vpsId: id }) },
    orderBy: { name: "asc" },
  });
  return (
    <section>
      <SectionTitle title="Domain di server ini" meta={`${domains.length} domain`} />
      <div className="card overflow-x-auto">
        {domains.length === 0 ? <EmptyState title="Belum ada domain yang ditautkan" /> : (
          <table className="table">
            <thead><tr><th>Domain</th><th>Status</th><th>Redirect ke</th></tr></thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id}>
                  <td><Link className="font-mono text-[12.5px] font-medium hover:underline" href={`/domains/${d.id}`}>{d.name}</Link></td>
                  <td><StatusBadge value={d.status} label={optionLabel(DOMAIN_STATUS, d.status)} /></td>
                  <td className="text-muted">{d.redirectTo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

async function DomainBacklinks({ id, ownerId }: { id: string; ownerId: string }) {
  const orders = await prisma.backlinkOrder.findMany({
    where: { domainId: id, ownerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  const total = orders.reduce((s, o) => s + o.quantity, 0);
  return (
    <section>
      <SectionTitle title="Backlink ke domain ini" meta={`${orders.length} order · ${total.toLocaleString("id-ID")} link dibeli`} />
      <div className="card overflow-x-auto">
        {orders.length === 0 ? <EmptyState title="Belum ada order backlink" /> : (
          <table className="table">
            <thead><tr><th>Vendor</th><th>Jumlah</th><th>Terkirim</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link className="font-medium hover:underline" href={`/backlinks/${o.id}`}>{o.vendor}</Link></td>
                  <td className="tabular-nums">{o.quantity}</td>
                  <td><Progress done={o._count.items} total={o.quantity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

async function BacklinkItems({ orderId, quantity }: { orderId: string; quantity: number }) {
  const items = await prisma.backlinkItem.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const live = items.filter((i) => i.status === "LIVE").length;
  const removed = items.filter((i) => i.status === "REMOVED").length;
  const stats = [
    { label: "Dibeli", value: quantity },
    { label: "Terkirim", value: items.length },
    { label: "Live", value: live },
    { label: "Hilang", value: removed },
    { label: "Kurang", value: Math.max(0, quantity - items.length) },
  ];

  return (
    <section className="space-y-4">
      <SectionTitle title="Link hasil" />

      <div className="card grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
        {stats.map((s) => (
          <div key={s.label} className="px-4 py-3">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{s.value.toLocaleString("id-ID")}</div>
          </div>
        ))}
        <div className="col-span-2 border-t border-line px-4 py-3 sm:col-span-5">
          <Progress done={items.length} live={live} total={quantity} wide />
        </div>
      </div>

      <form action={addBacklinkItems.bind(null, orderId)} className="card">
        <div className="p-4">
          <label className="label" htmlFor="urls">Tambah URL</label>
          <textarea id="urls" name="urls" rows={4} className="input font-mono text-[12.5px]" placeholder={"https://blog1.com/artikel\nhttps://blog2.com/artikel"} />
          <p className="hint">Satu URL per baris. Laporan dari vendor bisa langsung ditempel di sini, baris kosong akan dilewati.</p>
        </div>
        <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-subtle/60 px-4 py-2.5">
          <span className="text-xs text-muted">Status awal</span>
          <select name="status" className="input !h-8 !w-auto text-[13px]" defaultValue="LIVE">
            {ITEM_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <SubmitButton pendingText="Menambah…">Tambah link</SubmitButton>
        </div>
      </form>

      <div className="card overflow-x-auto">
        {items.length === 0 ? <EmptyState title="Belum ada link terkirim" /> : (
          <table className="table">
            <thead><tr><th className="w-12">#</th><th>URL</th><th className="w-36">Status</th><th className="w-20"></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td className="text-faint tabular-nums">{i + 1}</td>
                  <td className="max-w-0">
                    <a className="inline-flex max-w-full items-center gap-1 hover:underline" href={it.url} target="_blank" rel="noreferrer noopener">
                      <span className="truncate">{it.url}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-faint" />
                    </a>
                  </td>
                  <td>
                    <form action={setBacklinkItemStatus.bind(null, it.id)}>
                      <AutoSubmitSelect name="status" defaultValue={it.status} options={ITEM_STATUS} className="input !h-7 !w-auto !py-0 text-xs" />
                    </form>
                  </td>
                  <td>
                    <span className="flex justify-end">
                      <CopyButton value={it.url} />
                      <form action={deleteBacklinkItem.bind(null, it.id)}>
                        <ConfirmSubmit className="btn btn-ghost btn-xs btn-icon hover:text-danger" title="Hapus link" message="Hapus link ini?"><X /></ConfirmSubmit>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
