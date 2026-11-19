import { notFound } from "next/navigation";
import { getResource } from "@/lib/resources";
import { getRecord, relationOptions } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { saveRecord } from "@/app/actions";
import { Alert, PageHeader, RecordForm, prepareRow } from "@/components/ui";

export default async function EditPage({
  params, searchParams,
}: { params: Promise<{ resource: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { resource, id } = await params;
  const { error } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();
  const user = await requireUser();
  const raw = await getRecord(res, id, user);
  if (!raw) notFound();
  const row = prepareRow(res, raw);

  return (
    <div className="max-w-3xl">
      <PageHeader crumbs={[{ href: `/${res.key}`, label: res.title }, { href: `/${res.key}/${id}`, label: String(row[res.titleField]) }]} title={`Edit ${res.singular.toLowerCase()}`} desc={raw.ownerId !== user.id ? `Milik ${row.owner?.name} — kepemilikan tidak berubah saat kamu edit` : undefined} />
      <Alert error={error} />
      <RecordForm res={res} row={row} relOptions={await relationOptions(res, raw.ownerId)} action={saveRecord.bind(null, res.key, id)} />
    </div>
  );
}
