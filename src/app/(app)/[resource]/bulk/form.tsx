"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { bulkAddDomains, type BulkResult } from "@/app/actions";
import { DOMAIN_STATUS, REDIRECT_TYPES } from "@/lib/resources";
import { SubmitButton } from "@/components/client";

const EXAMPLE = `contoh1.com
contoh2.net  https://moneysite.com
contoh3.org -> https://moneysite.com/kategori`;

export function BulkDomainForm({ relOptions, categories }: { relOptions: Record<string, { value: string; label: string }[]>; categories: string[] }) {
  const [result, action] = useActionState<BulkResult | null, FormData>(bulkAddDomains, null);
  const [text, setText] = useState("");
  // Kosongkan textarea setelah berhasil diproses (hasil tampil di panel atas).
  useEffect(() => { if (result) setText(""); }, [result]);
  const count = useMemo(() => text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#")).length, [text]);

  return (
    <div className="space-y-4">
      {result && <ResultPanel r={result} />}

      <form action={action} className="card">
        <div className="grid gap-5 p-5 md:grid-cols-5 md:p-6">
          <div className="md:col-span-3">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0" htmlFor="lines">Daftar domain</label>
              <span className="text-xs text-muted tabular-nums">{count} baris</span>
            </div>
            <textarea
              id="lines"
              name="lines"
              rows={16}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input font-mono text-[12.5px]"
              placeholder={EXAMPLE}
              spellCheck={false}
            />
            <p className="hint">
              Satu domain per baris. Boleh ditambah tujuan redirect setelah spasi, tab, koma, <code className="font-mono">|</code> atau <code className="font-mono">-&gt;</code>.
              <code className="font-mono"> https://</code> dan <code className="font-mono">www.</code> dibuang otomatis.
            </p>
          </div>

          <div className="space-y-4 md:col-span-2">
            <div className="text-[13px] font-medium">Berlaku untuk semua domain</div>
            <div>
              <label className="label" htmlFor="category">Kategori</label>
              <input id="category" name="category" list="bulk-category-options" className="input" autoComplete="off" placeholder="mis. PBN kesehatan" />
              <datalist id="bulk-category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              <p className="hint">Pilih yang ada atau ketik baru. Kosongkan jika tanpa kategori.</p>
            </div>
            <Select name="status" label="Status" options={[{ value: "", label: "Otomatis (Redirect jika ada tujuan)" }, ...DOMAIN_STATUS]} />
            <div>
              <label className="label" htmlFor="redirectTo">Redirect default</label>
              <input id="redirectTo" name="redirectTo" className="input" placeholder="https://moneysite.com" />
              <p className="hint">Dipakai jika baris tidak punya tujuan sendiri.</p>
            </div>
            <Select name="redirectType" label="Tipe redirect" options={[{ value: "", label: "301 (default)" }, ...REDIRECT_TYPES]} />
            <Select name="hostingId" label="Di hosting" options={[{ value: "", label: "Tidak ada" }, ...(relOptions.hostingId ?? [])]} />
            <Select name="vpsId" label="Di VPS" options={[{ value: "", label: "Tidak ada" }, ...(relOptions.vpsId ?? [])]} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="registrar">Registrar</label><input id="registrar" name="registrar" className="input" /></div>
              <div><label className="label" htmlFor="expiresAt">Expired</label><input id="expiresAt" name="expiresAt" type="date" className="input" /></div>
            </div>
            <div><label className="label" htmlFor="registrarAccount">Akun registrar</label><input id="registrarAccount" name="registrarAccount" className="input" /></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 rounded-b-lg border-t border-line bg-subtle/60 px-5 py-3">
          <Link href="/domains" className="btn btn-ghost">Selesai</Link>
          <SubmitButton pendingText="Menambahkan…">{count ? `Tambah ${count} domain` : "Tambah domain"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue="">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ResultPanel({ r }: { r: BulkResult }) {
  const groups = [
    { title: "Ditambahkan", items: r.added, tone: "bg-ok" },
    { title: "Sudah ada, dilewati", items: r.skipped, tone: "bg-faint" },
    { title: "Format tidak valid", items: r.invalid, tone: "bg-danger" },
  ].filter((g) => g.items.length);
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px]">
        <Check className="size-4 text-ok" />
        <span className="font-medium">{r.added.length} domain ditambahkan</span>
        {r.skipped.length > 0 && <span className="text-muted">· {r.skipped.length} dilewati</span>}
        {r.invalid.length > 0 && <span className="text-muted">· {r.invalid.length} tidak valid</span>}
        <Link href="/domains" className="ml-auto text-xs underline decoration-line-strong underline-offset-4 hover:decoration-fg">Lihat daftar domain</Link>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"><span className={`dot ${g.tone}`} />{g.title} ({g.items.length})</div>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-xs text-muted">
              {g.items.map((d) => <li key={d} className="truncate">{d}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
