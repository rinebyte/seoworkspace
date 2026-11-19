import { notFound } from "next/navigation";
import { getResource } from "@/lib/resources";
import { relationOptions } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { saveRecord } from "@/app/actions";
import { Alert, PageHeader, RecordForm } from "@/components/ui";

export default async function NewPage({
  params, searchParams,
}: { params: Promise<{ resource: string }>; searchParams: Promise<{ error?: string }> }) {
  const { resource } = await params;
  const { error } = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();
  const user = await requireUser();

  return (
    <div className="max-w-3xl">
      <PageHeader crumbs={[{ href: `/${res.key}`, label: res.title }]} title={`Tambah ${res.singular.toLowerCase()}`} desc={res.description} />
      <Alert error={error} />
      <RecordForm res={res} relOptions={await relationOptions(res, user.id)} action={saveRecord.bind(null, res.key, null)} />
    </div>
  );
}
