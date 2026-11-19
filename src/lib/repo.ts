import "server-only";
import { prisma } from "./db";
import type { ModelName, Resource } from "./resources";

// Akses dinamis ke delegate Prisma berdasarkan nama model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
type Delegate = {
  findMany(args?: unknown): Promise<Row[]>;
  findFirst(args: unknown): Promise<Row | null>;
  create(args: unknown): Promise<Row>;
  update(args: unknown): Promise<Row>;
  delete(args: unknown): Promise<Row>;
  count(args?: unknown): Promise<number>;
};

export function delegate(model: ModelName): Delegate {
  return (prisma as unknown as Record<ModelName, Delegate>)[model];
}

// ---------- Isolasi data ----------
// MEMBER hanya melihat datanya sendiri. ADMIN melihat semua (opsional difilter per user).

export type Viewer = { id: string; role: "ADMIN" | "MEMBER" };

export function ownerScope(viewer: Viewer, ownerFilter?: string | null): Row {
  if (viewer.role !== "ADMIN") return { ownerId: viewer.id };
  return ownerFilter ? { ownerId: ownerFilter } : {};
}

export function includeFor(res: Resource) {
  const include: Row = { owner: { select: { id: true, name: true } } };
  for (const f of res.fields) {
    if (f.type === "relation" && f.relation) include[f.relation.key] = true;
    if (f.type === "category") include.category = { select: { id: true, name: true } };
  }
  if (res.model === "backlinkOrder") include._count = { select: { items: true } };
  return include;
}

export async function listRecords(res: Resource, viewer: Viewer, q?: string, ownerFilter?: string, extra?: Row) {
  const and: Row[] = [ownerScope(viewer, ownerFilter)];
  if (extra) and.push(extra);
  if (q) {
    const or: Row[] = res.search.map((s) => ({ [s]: { contains: q, mode: "insensitive" } }));
    if (res.fields.some((f) => f.type === "category")) or.push({ category: { name: { contains: q, mode: "insensitive" } } });
    and.push({ OR: or });
  }
  const rows = await delegate(res.model).findMany({
    where: { AND: and },
    include: includeFor(res),
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  if (res.model === "backlinkOrder" && rows.length) {
    const live = await prisma.backlinkItem.groupBy({
      by: ["orderId"],
      where: { status: "LIVE", orderId: { in: rows.map((r) => r.id) } },
      _count: true,
    });
    const m = new Map(live.map((l) => [l.orderId, l._count]));
    for (const r of rows) r.__live = m.get(r.id) ?? 0;
  }
  return rows;
}

/** Ambil satu record jika viewer berhak. null = tidak ada / bukan miliknya. */
export async function getRecord(res: Resource, id: string, viewer: Viewer) {
  return delegate(res.model).findFirst({ where: { id, ...ownerScope(viewer) }, include: includeFor(res) });
}

/** Pilihan relasi (hosting/VPS/domain) hanya dari data milik `ownerId`. */
export async function relationOptions(res: Resource, ownerId: string) {
  const out: Record<string, { value: string; label: string }[]> = {};
  for (const f of res.fields) {
    if (f.type === "category") {
      out[f.name] = (await categoryNames(ownerId)).map((n) => ({ value: n, label: n }));
      continue;
    }
    if (f.type !== "relation" || !f.relation) continue;
    const rows = await delegate(f.relation.model).findMany({
      where: { ownerId },
      select: { id: true, [f.relation.labelField]: true },
      orderBy: { [f.relation.labelField]: "asc" },
    });
    out[f.name] = rows.map((r) => ({ value: r.id, label: String(r[f.relation!.labelField]) }));
  }
  return out;
}

/** Nama kategori domain milik `ownerId` (untuk saran di input kategori). */
export async function categoryNames(ownerId: string) {
  const rows = await prisma.domainCategory.findMany({ where: { ownerId }, select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

/** Cari kategori berdasarkan nama (tidak peka huruf besar/kecil), buat jika belum ada. */
export async function resolveCategory(ownerId: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) return null;
  const found = await prisma.domainCategory.findFirst({ where: { ownerId, name: { equals: name, mode: "insensitive" } } });
  if (found) return found.id;
  const created = await prisma.domainCategory.upsert({
    where: { ownerId_name: { ownerId, name } },
    update: {},
    create: { ownerId, name },
  });
  return created.id;
}

export async function userOptions() {
  const users = await prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ value: u.id, label: u.name }));
}
