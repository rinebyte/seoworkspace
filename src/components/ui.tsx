import Link from "next/link";
import Form from "next/form";
import { ArrowUpRight, ChevronRight, Hash, Inbox } from "lucide-react";
import { daysUntil, fmtDate, fmtRupiah, toDateInput } from "@/lib/format";
import { encColumn, isSecret, optionLabel, type Field, type Resource } from "@/lib/resources";
import type { Row } from "@/lib/repo";
import { AutoSubmitSelect, CopyButton, SecretField, SubmitButton, TotpCode } from "./client";

export function PageHeader({
  title, desc, crumbs, children,
}: { title: React.ReactNode; desc?: React.ReactNode; crumbs?: { href: string; label: string }[]; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {crumbs && (
        <nav className="mb-2 flex items-center gap-1 text-[13px] text-muted">
          {crumbs.map((c) => (
            <span key={c.href} className="inline-flex items-center gap-1">
              <Link href={c.href} className="hover:text-fg">{c.label}</Link>
              <ChevronRight className="size-3.5 text-faint" />
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {desc && <p className="mt-1 text-[13px] text-muted">{desc}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}

/** Dropdown filter per user (khusus admin). Navigasi client-side via next/form. */
export function OwnerFilter({ path, users, value, keep }: { path: string; users: { value: string; label: string }[]; value?: string; keep?: Record<string, string | undefined> }) {
  return (
    <Form action={path} className="flex items-center">
      {Object.entries(keep ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <AutoSubmitSelect name="owner" defaultValue={value ?? ""} options={[{ value: "", label: "Semua user" }, ...users]} />
    </Form>
  );
}

export function Alert({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className={`mb-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] ${error ? "border-danger/30 bg-danger/5 text-danger" : "border-line bg-panel text-fg"}`}>
      <span className={`dot mt-1.5 ${error ? "bg-danger" : "bg-ok"}`} />
      {error ?? ok}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full border border-line bg-subtle">
        <Inbox className="size-4 text-muted" strokeWidth={1.75} />
      </div>
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "danger" | "neutral" }) {
  const cls = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", neutral: "bg-faint" }[tone];
  return <span className={`dot ${cls}`} />;
}

export function ExpiryBadge({ date, compact = false }: { date: Date | null | undefined; compact?: boolean }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-faint">—</span>;
  const tone = d < 0 ? "danger" : d <= 30 ? "warn" : "neutral";
  const hint = d < 0 ? `lewat ${-d} hari` : d === 0 ? "hari ini" : `${d} hari lagi`;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
      {!compact && <span>{fmtDate(date)}</span>}
      <span className={`inline-flex items-center gap-1.5 text-xs ${tone === "neutral" ? "text-muted" : "font-medium text-fg"}`}>
        <StatusDot tone={tone} />
        {hint}
      </span>
    </span>
  );
}

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral"> = {
  ACTIVE: "ok", MONEY_SITE: "ok", LIVE: "ok", DONE: "ok",
  REDIRECT: "neutral", PBN: "neutral", PARKED: "neutral", PROCESS: "warn", PARTIAL: "warn", PENDING: "warn",
  EXPIRED: "danger", REMOVED: "danger", CANCELED: "danger",
};

export function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <span className="badge">
      <StatusDot tone={STATUS_TONE[value] ?? "neutral"} />
      {label}
    </span>
  );
}

/** Label kategori domain; klik untuk menyaring daftar domain. */
export function CategoryTag({ name }: { name: string }) {
  return (
    <Link
      href={`/domains?cat=${encodeURIComponent(name)}`}
      className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-fg ring-1 ring-line ring-inset hover:ring-line-strong"
    >
      <Hash className="size-3 shrink-0 text-faint" />
      <span className="truncate">{name}</span>
    </Link>
  );
}

/** Progres monokrom: terkirim (abu) dan live (hitam). */
export function Progress({ done, live, total, wide = false }: { done: number; live?: number; total: number; wide?: boolean }) {
  const pct = (n: number) => (total ? Math.min(100, (n / total) * 100) : 0);
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative h-1.5 overflow-hidden rounded-full bg-subtle ring-1 ring-line ring-inset ${wide ? "w-full" : "w-20"}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-fg/25" style={{ width: `${pct(done)}%` }} />
        {live !== undefined && <div className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{ width: `${pct(live)}%` }} />}
      </div>
      <span className="shrink-0 text-xs text-muted tabular-nums">{done}/{total}</span>
    </div>
  );
}

/** Tampilan nilai satu field (dipakai di tabel dan halaman detail). */
export function FieldValue({ res, f, row, detail = false }: { res: Resource; f: Field; row: Row; detail?: boolean }) {
  if (isSecret(f)) {
    if (!row[`__has_${f.name}`]) return <span className="text-faint">—</span>;
    if (f.type === "totp") return <TotpCode resource={res.key} id={row.id} field={f.name} />;
    return <SecretField resource={res.key} id={row.id} field={f.name} multiline={f.type === "secretText" && detail} />;
  }
  if (f.type === "category") {
    const c = row.category;
    if (!c) return <span className="text-faint">—</span>;
    return <CategoryTag name={c.name} />;
  }
  const v = row[f.name];
  if (v === null || v === undefined || v === "") return <span className="text-faint">—</span>;
  switch (f.type) {
    case "date":
      return f.name === "expiresAt" ? <ExpiryBadge date={v} /> : <span className="tabular-nums">{fmtDate(v)}</span>;
    case "select":
      return <StatusBadge value={v} label={optionLabel(f.options, v)} />;
    case "relation": {
      const rel = row[f.relation!.key];
      if (!rel) return <span className="text-faint">—</span>;
      const target = f.relation!.model === "domain" ? "domains" : f.relation!.model;
      return <Link className="underline decoration-line-strong underline-offset-4 hover:decoration-fg" href={`/${target}/${rel.id}`}>{rel[f.relation!.labelField]}</Link>;
    }
    case "url":
      return (
        <span className="inline-flex max-w-full items-center gap-1">
          <a className="inline-flex min-w-0 items-center gap-1 hover:underline" href={v} target="_blank" rel="noreferrer noopener">
            <span className="truncate">{detail ? v : v.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            <ArrowUpRight className="size-3.5 shrink-0 text-faint" />
          </a>
          {detail && <CopyButton value={v} />}
        </span>
      );
    case "int":
      return <span className="tabular-nums">{f.name === "price" ? fmtRupiah(v) : Number(v).toLocaleString("id-ID")}</span>;
    case "textarea":
      return <span className="whitespace-pre-wrap">{v}</span>;
    default:
      return (
        <span className={`inline-flex max-w-full items-center gap-1 break-all ${f.mono ? "font-mono text-[12.5px]" : ""}`}>
          {v}
          {detail && <CopyButton value={String(v)} />}
        </span>
      );
  }
}

/** Tandai field rahasia mana yang terisi, lalu buang ciphertext-nya. */
export function prepareRow(res: Resource, row: Row): Row {
  const out: Row = { ...row };
  for (const f of res.fields) {
    if (!isSecret(f)) continue;
    out[`__has_${f.name}`] = !!row[encColumn(f)];
    delete out[encColumn(f)];
  }
  return out;
}

export function RecordForm({
  res, row, relOptions, action,
}: {
  res: Resource;
  row?: Row;
  relOptions: Record<string, { value: string; label: string }[]>;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="card">
      <div className="grid gap-x-5 gap-y-5 p-5 md:grid-cols-2 md:p-6">
        {res.fields.map((f) => {
          const wide = f.type === "textarea" || f.type === "secretText" || f.type === "totp";
          const has = row?.[`__has_${f.name}`];
          const def = row ? row[f.name] : f.defaultValue;
          return (
            <div key={f.name} className={wide ? "md:col-span-2" : ""}>
              <label className="label" htmlFor={f.name}>
                {f.label} {f.required && <span className="text-muted">*</span>}
                {isSecret(f) && <span className="ml-1.5 text-[11px] font-normal text-faint">terenkripsi</span>}
              </label>
              {f.type === "textarea" || f.type === "secretText" ? (
                <textarea
                  id={f.name}
                  name={f.name}
                  rows={f.type === "secretText" ? 4 : 3}
                  className={`input ${f.type === "secretText" ? "font-mono" : ""}`}
                  defaultValue={f.type === "secretText" ? "" : def ?? ""}
                  placeholder={f.type === "secretText" && has ? "Tersimpan — kosongkan jika tidak diubah" : f.placeholder}
                />
              ) : f.type === "select" ? (
                <select id={f.name} name={f.name} className="input" defaultValue={def ?? ""}>
                  {!f.defaultValue && <option value="">—</option>}
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "category" ? (
                <>
                  <input
                    id={f.name}
                    name={f.name}
                    list={`${f.name}-options`}
                    className="input"
                    autoComplete="off"
                    placeholder={f.placeholder}
                    defaultValue={row?.category?.name ?? ""}
                  />
                  <datalist id={`${f.name}-options`}>
                    {(relOptions[f.name] ?? []).map((o) => <option key={o.value} value={o.value} />)}
                  </datalist>
                </>
              ) : f.type === "relation" ? (
                <select id={f.name} name={f.name} className="input" defaultValue={def ?? ""}>
                  <option value="">Tidak ada</option>
                  {(relOptions[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  id={f.name}
                  name={f.name}
                  className={`input ${f.mono || isSecret(f) ? "font-mono" : ""}`}
                  type={f.type === "date" ? "date" : f.type === "secret" ? "password" : f.type === "email" ? "email" : "text"}
                  inputMode={f.type === "int" ? "numeric" : undefined}
                  autoComplete={isSecret(f) ? "new-password" : "off"}
                  required={f.required && !isSecret(f)}
                  placeholder={isSecret(f) && has ? "Tersimpan — kosongkan jika tidak diubah" : f.placeholder}
                  defaultValue={isSecret(f) ? "" : f.type === "date" ? toDateInput(def) : def ?? ""}
                />
              )}
              {f.help && <p className="hint">{f.help}</p>}
              {isSecret(f) && has && (
                <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" name={`__clear_${f.name}`} className="accent-fg" /> Hapus nilai tersimpan
                </label>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-subtle/60 px-5 py-3">
        <Link className="btn btn-ghost" href={row ? `/${res.key}/${row.id}` : `/${res.key}`}>Batal</Link>
        <SubmitButton pendingText="Menyimpan…">Simpan</SubmitButton>
      </div>
    </form>
  );
}
