import { notFound } from "next/navigation";
import { getResource } from "@/lib/resources";
import { categoryNames, relationOptions } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BulkDomainForm } from "./form";

export const metadata = { title: "Bulk add domain" };

export default async function BulkPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const res = getResource(resource);
  if (!res || res.key !== "domains") notFound();
  const user = await requireUser();
  return (
    <div className="max-w-4xl">
      <PageHeader
        crumbs={[{ href: "/domains", label: "Domain" }]}
        title="Bulk add domain"
        desc="Tempel banyak domain sekaligus. Domain yang sudah ada di datamu otomatis dilewati."
      />
      <BulkDomainForm relOptions={await relationOptions(res, user.id)} categories={await categoryNames(user.id)} />
    </div>
  );
}
