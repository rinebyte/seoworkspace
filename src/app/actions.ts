"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { delegate, ownerScope, resolveCategory, type Row, type Viewer } from "@/lib/repo";
import { encColumn, getResource, isSecret, ITEM_STATUS, type Resource } from "@/lib/resources";
import { normalizeTotpSecret, totpNow } from "@/lib/totp";

function mustResource(key: string): Resource {
  const res = getResource(key);
  if (!res) throw new Error("Modul tidak dikenal");
  return res;
}

function fail(path: string, msg: string): never {
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
}

/** Pastikan record ada DAN boleh diakses viewer (member: miliknya sendiri, admin: semua). */
async function mustAccess(res: Resource, id: string, viewer: Viewer, select: Row = {}) {
  const row = await delegate(res.model).findFirst({
    where: { id, ...ownerScope(viewer) },
    select: { id: true, ownerId: true, [res.titleField]: true, ...select },
  });
  if (!row) throw new Error("Data tidak ditemukan atau bukan milikmu");
  return row;
}

async function mustAccessOrder(orderId: string, viewer: Viewer) {
  const order = await prisma.backlinkOrder.findFirst({ where: { id: orderId, ...ownerScope(viewer) }, select: { id: true } });
  if (!order) throw new Error("Order tidak ditemukan atau bukan milikmu");
}

async function mustAccessItem(itemId: string, viewer: Viewer) {
  const item = await prisma.backlinkItem.findFirst({ where: { id: itemId, order: ownerScope(viewer) }, select: { id: true } });
  if (!item) throw new Error("Link tidak ditemukan atau bukan milikmu");
}

export async function saveRecord(resKey: string, id: string | null, form: FormData) {
  const user = await requireUser();
  const res = mustResource(resKey);
  const back = id ? `/${res.key}/${id}/edit` : `/${res.key}/new`;
  // Pemilik: tetap pemilik lama saat edit (admin mengedit data member tidak memindahkan kepemilikan).
  const ownerId = id ? (await mustAccess(res, id, user)).ownerId : user.id;
  const data: Row = {};

  for (const f of res.fields) {
    const raw = String(form.get(f.name) ?? "");
    const val = raw.trim();

    if (isSecret(f)) {
      const col = encColumn(f);
      if (form.get(`__clear_${f.name}`) === "on") {
        data[col] = null;
      } else if (val) {
        let plain = val;
        if (f.type === "totp") {
          const norm = normalizeTotpSecret(val);
          if (!norm) fail(back, `${f.label} tidak valid (harus base32 atau otpauth://)`);
          plain = norm;
        }
        data[col] = encrypt(plain);
      } else if (!id) {
        data[col] = null;
      }
      continue;
    }

    if (f.required && !val) fail(back, `${f.label} wajib diisi`);

    switch (f.type) {
      case "int": {
        if (!val) { data[f.name] = null; break; }
        const n = Number(val.replace(/[.,\s]/g, ""));
        if (!Number.isInteger(n) || n < 0) fail(back, `${f.label} harus angka`);
        data[f.name] = n;
        break;
      }
      case "date":
        data[f.name] = val ? new Date(`${val}T00:00:00Z`) : null;
        break;
      case "select":
        data[f.name] = val || (f.defaultValue ?? null);
        break;
      case "category":
        data.categoryId = await resolveCategory(ownerId, val);
        break;
      case "relation":
        if (val) {
          const ok = await delegate(f.relation!.model).count({ where: { id: val, ownerId } });
          if (!ok) fail(back, `${f.label} tidak valid`);
        }
        data[f.name] = val || null;
        break;
      default:
        data[f.name] = val || null;
    }
  }

  if (res.model === "domain" && data.name) {
    data.name = String(data.name).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  let saved: Row;
  try {
    saved = id
      ? await delegate(res.model).update({ where: { id }, data })
      : await delegate(res.model).create({ data: { ...data, ownerId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      fail(back, res.model === "domain" ? "Domain ini sudah ada di datamu" : "Data dengan nilai yang sama sudah ada");
    }
    throw e;
  }

  await audit(user.id, id ? "UPDATE" : "CREATE", res.model, saved.id, String(saved[res.titleField] ?? ""));
  revalidatePath(`/${res.key}`);
  redirect(`/${res.key}/${saved.id}`);
}

export async function deleteRecord(resKey: string, id: string) {
  const user = await requireUser();
  const res = mustResource(resKey);
  await mustAccess(res, id, user);
  const row = await delegate(res.model).delete({ where: { id } });
  await audit(user.id, "DELETE", res.model, id, String(row[res.titleField] ?? ""));
  revalidatePath(`/${res.key}`);
  redirect(`/${res.key}`);
}

async function loadSecret(res: Resource, id: string, fieldName: string, viewer: Viewer) {
  const f = res.fields.find((x) => x.name === fieldName && isSecret(x));
  if (!f) throw new Error("Field tidak valid");
  const row = await mustAccess(res, id, viewer, { [encColumn(f)]: true });
  const enc = row[encColumn(f)];
  if (!enc) return { f, row, plain: null as string | null };
  return { f, row, plain: decrypt(enc) };
}

/** Dekripsi satu rahasia untuk ditampilkan / disalin. Selalu tercatat di audit log. */
export async function revealSecret(resKey: string, id: string, fieldName: string, mode: "view" | "copy") {
  const user = await requireUser();
  const res = mustResource(resKey);
  const { f, row, plain } = await loadSecret(res, id, fieldName, user);
  await audit(user.id, mode === "copy" ? "COPY_SECRET" : "VIEW_SECRET", res.model, id, `${row?.[res.titleField] ?? ""} · ${f.label}`);
  return plain;
}

/** Kode TOTP saat ini. `log` true hanya saat user pertama kali membuka. */
export async function getTotpCode(resKey: string, id: string, fieldName: string, log: boolean) {
  const user = await requireUser();
  const res = mustResource(resKey);
  const { f, row, plain } = await loadSecret(res, id, fieldName, user);
  if (!plain) return null;
  if (log) await audit(user.id, "VIEW_2FA", res.model, id, `${row?.[res.titleField] ?? ""} · ${f.label}`);
  return totpNow(plain);
}

// ---------- Backlink items ----------

export async function addBacklinkItems(orderId: string, form: FormData) {
  const user = await requireUser();
  await mustAccessOrder(orderId, user);
  const status = String(form.get("status") ?? "LIVE");
  const urls = String(form.get("urls") ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (urls.length) {
    await prisma.backlinkItem.createMany({
      data: urls.map((url) => ({ orderId, url, status: ITEM_STATUS.some((s) => s.value === status) ? status : "LIVE" })),
    });
    await audit(user.id, "ADD_LINKS", "backlinkOrder", orderId, `${urls.length} link`);
  }
  revalidatePath(`/backlinks/${orderId}`);
}

export async function setBacklinkItemStatus(itemId: string, form: FormData) {
  const user = await requireUser();
  await mustAccessItem(itemId, user);
  const status = String(form.get("status") ?? "");
  if (!ITEM_STATUS.some((s) => s.value === status)) return;
  const item = await prisma.backlinkItem.update({ where: { id: itemId }, data: { status } });
  revalidatePath(`/backlinks/${item.orderId}`);
}

export async function deleteBacklinkItem(itemId: string) {
  const user = await requireUser();
  await mustAccessItem(itemId, user);
  const item = await prisma.backlinkItem.delete({ where: { id: itemId } });
  revalidatePath(`/backlinks/${item.orderId}`);
}

// ---------- Bulk add domain ----------

const DOMAIN_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

function normalizeDomain(s: string) {
  return s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
}

export type BulkResult = { added: string[]; skipped: string[]; invalid: string[] };

/**
 * Format tiap baris:  domain.com
 *                     domain.com  https://tujuan.com     (spasi / tab / koma / | / -> sebagai pemisah)
 * Field lain (status, hosting/VPS, registrar, expired, redirect default) berlaku untuk semua baris.
 */
export async function bulkAddDomains(_prev: BulkResult | null, form: FormData): Promise<BulkResult> {
  const user = await requireUser();
  const get = (k: string) => String(form.get(k) ?? "").trim();

  const hostingId = get("hostingId") || null;
  const vpsId = get("vpsId") || null;
  if (hostingId && !(await prisma.hosting.count({ where: { id: hostingId, ownerId: user.id } }))) throw new Error("Hosting tidak valid");
  if (vpsId && !(await prisma.vps.count({ where: { id: vpsId, ownerId: user.id } }))) throw new Error("VPS tidak valid");

  const status = get("status");
  const redirectDefault = get("redirectTo");
  const redirectType = get("redirectType") || null;
  const registrar = get("registrar") || null;
  const registrarAccount = get("registrarAccount") || null;
  const expiresAt = get("expiresAt") ? new Date(`${get("expiresAt")}T00:00:00Z`) : null;
  const categoryId = await resolveCategory(user.id, get("category"));

  const invalid: string[] = [];
  const parsed = new Map<string, string | null>();
  for (const line of get("lines").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [rawDomain, rawTarget] = t.split(/\s*(?:->|=>|\||,|;|\t)\s*|\s+/).filter(Boolean);
    const name = normalizeDomain(rawDomain ?? "");
    if (!DOMAIN_RE.test(name)) { invalid.push(t); continue; }
    let target = rawTarget?.trim() || redirectDefault || null;
    if (target && !/^https?:\/\//i.test(target)) target = `https://${target}`;
    parsed.set(name, target);
  }

  const existing = new Set(
    (await prisma.domain.findMany({ where: { ownerId: user.id, name: { in: [...parsed.keys()] } }, select: { name: true } })).map((d) => d.name),
  );
  const toAdd = [...parsed].filter(([n]) => !existing.has(n));

  if (toAdd.length) {
    await prisma.domain.createMany({
      data: toAdd.map(([name, redirectTo]) => ({
        ownerId: user.id,
        name,
        redirectTo,
        redirectType: redirectTo ? redirectType ?? "301" : null,
        status: status || (redirectTo ? "REDIRECT" : "ACTIVE"),
        hostingId, vpsId, registrar, registrarAccount, expiresAt, categoryId,
      })),
      skipDuplicates: true,
    });
    await audit(user.id, "BULK_CREATE", "domain", null, `${toAdd.length} domain`);
    revalidatePath("/domains");
    revalidatePath("/");
  }
  return { added: toAdd.map(([n]) => n), skipped: [...existing], invalid };
}

// ---------- Kategori domain ----------

export async function createCategory(form: FormData) {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) fail("/domains/categories", "Nama kategori wajib diisi");
  await resolveCategory(user.id, name);
  await audit(user.id, "CREATE", "domainCategory", null, name);
  revalidatePath("/", "layout");
}

/** Ganti nama kategori. Jika nama baru sudah dipakai (milik user yang sama), kedua kategori digabung. */
export async function renameCategory(id: string, form: FormData) {
  const user = await requireUser();
  const cat = await prisma.domainCategory.findFirst({ where: { id, ...ownerScope(user) } });
  if (!cat) throw new Error("Kategori tidak ditemukan atau bukan milikmu");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) fail("/domains/categories", "Nama kategori wajib diisi");
  if (name === cat.name) return;

  const target = await prisma.domainCategory.findFirst({
    where: { ownerId: cat.ownerId, name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (target) {
    await prisma.$transaction([
      prisma.domain.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } }),
      prisma.domainCategory.delete({ where: { id } }),
    ]);
    await audit(user.id, "UPDATE", "domainCategory", target.id, `gabung "${cat.name}" → "${target.name}"`);
  } else {
    await prisma.domainCategory.update({ where: { id }, data: { name } });
    await audit(user.id, "UPDATE", "domainCategory", id, `"${cat.name}" → "${name}"`);
  }
  revalidatePath("/", "layout");
}

/** Hapus kategori. Domain di dalamnya tidak dihapus, hanya jadi tanpa kategori. */
export async function deleteCategory(id: string) {
  const user = await requireUser();
  const cat = await prisma.domainCategory.findFirst({ where: { id, ...ownerScope(user) } });
  if (!cat) throw new Error("Kategori tidak ditemukan atau bukan milikmu");
  await prisma.domainCategory.delete({ where: { id } });
  await audit(user.id, "DELETE", "domainCategory", id, cat.name);
  revalidatePath("/", "layout");
}
