"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Check, Copy, Eye, EyeOff, Globe, HardDrive, KeyRound, LayoutDashboard, Link2, LoaderCircle,
  LogOut, Mail, ScrollText, Search, Server, Users, X,
} from "lucide-react";
import { getTotpCode, revealSecret } from "@/app/actions";
import { Logo } from "./logo";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

// ---------- Navigasi ----------

const NAV = [
  { group: null, items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Aset",
    items: [
      { href: "/domains", label: "Domain", icon: Globe },
      { href: "/hosting", label: "Hosting", icon: HardDrive },
      { href: "/vps", label: "VPS / Server", icon: Server },
    ],
  },
  { group: "Akun", items: [{ href: "/emails", label: "Email & Akun", icon: Mail }] },
  { group: "SEO", items: [{ href: "/backlinks", label: "Backlink", icon: Link2 }] },
];
const ADMIN_NAV = {
  group: "Admin",
  items: [
    { href: "/users", label: "Pengguna", icon: Users },
    { href: "/audit", label: "Audit log", icon: ScrollText },
  ],
};

export function Sidebar({
  user, logoutAction,
}: { user: { name: string; email: string; role: string }; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const groups = user.role === "ADMIN" ? [...NAV, ADMIN_NAV] : NAV;
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <aside className="z-20 flex shrink-0 flex-col border-b border-line bg-panel md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">SEO Workspace</div>
          <div className="text-[11px] text-muted">Internal tools</div>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto px-2 pb-2 [scrollbar-width:none] md:flex-1 md:flex-col md:overflow-y-auto md:pb-4">
        {groups.map((g, i) => (
          <div key={i} className="contents md:block">
            {g.group && <div className="hidden px-2.5 pt-5 pb-1.5 text-[11px] font-medium tracking-wide text-faint uppercase md:block">{g.group}</div>}
            {g.items.map((n) => {
              const on = active(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${
                    on ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  <n.icon className={`size-4 ${on ? "text-fg" : "text-faint"}`} strokeWidth={1.75} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="hidden items-center gap-2.5 border-t border-line p-3 md:flex">
        <Link href="/account" className="min-w-0 flex-1 rounded-md px-2 py-1 hover:bg-hover">
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-muted">{user.role === "ADMIN" ? "Admin" : "Member"} · {user.email}</div>
          </div>
        </Link>
        <form action={logoutAction}>
          <button className="btn btn-ghost btn-icon" title="Keluar" aria-label="Keluar"><LogOut /></button>
        </form>
      </div>
    </aside>
  );
}

/** Kotak cari. Tekan "/" di mana saja untuk fokus. */
export function SearchBox({ placeholder = "Cari…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const push = (q: string) => {
    const sp = new URLSearchParams(params);
    if (q) sp.set("q", q); else sp.delete("q");
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false }));
  };

  return (
    <div className="relative w-full sm:w-64">
      {pending
        ? <LoaderCircle className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-faint" />
        : <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />}
      <input
        ref={ref}
        defaultValue={params.get("q") ?? ""}
        placeholder={placeholder}
        className="input !h-8 pr-8 pl-8 text-[13px]"
        onChange={(e) => {
          const v = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => push(v), 250);
        }}
        onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.value = ""; push(""); e.currentTarget.blur(); } }}
      />
      <span className="kbd pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">/</span>
    </div>
  );
}

/** Tombol submit dengan status loading otomatis. */
export function SubmitButton({ children, className = "btn btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <LoaderCircle className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Salin"
      aria-label="Salin"
      className={`btn btn-ghost btn-xs ${label ? "" : "btn-icon"}`}
      onClick={async () => {
        await copyText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check className="text-ok" /> : <Copy />}
      {label}
    </button>
  );
}

export function SecretField({
  resource, id, field, multiline = false,
}: { resource: string; id: string; field: string; multiline?: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // Sembunyikan otomatis setelah 30 detik.
  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => setValue(null), 30000);
    return () => clearTimeout(t);
  }, [value]);

  const buttons = (
    <span className="inline-flex shrink-0">
      <button
        type="button"
        title={value !== null ? "Sembunyikan" : "Lihat"}
        aria-label={value !== null ? "Sembunyikan" : "Lihat"}
        className="btn btn-ghost btn-xs btn-icon"
        disabled={pending}
        onClick={() =>
          value !== null
            ? setValue(null)
            : start(async () => setValue((await revealSecret(resource, id, field, "view")) ?? ""))
        }
      >
        {pending ? <LoaderCircle className="animate-spin" /> : value !== null ? <EyeOff /> : <Eye />}
      </button>
      <button
        type="button"
        title="Salin"
        aria-label="Salin"
        className="btn btn-ghost btn-xs btn-icon"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const v = await revealSecret(resource, id, field, "copy");
            if (v) {
              await copyText(v);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }
          })
        }
      >
        {copied ? <Check className="text-ok" /> : <Copy />}
      </button>
    </span>
  );

  if (multiline && value !== null) {
    return (
      <div className="space-y-1.5">
        <pre className="rounded-md border border-line bg-subtle p-2.5 font-mono text-xs whitespace-pre-wrap">{value}</pre>
        {buttons}
      </div>
    );
  }
  return (
    <div className="inline-flex max-w-full items-center gap-1">
      {value === null
        ? <span className="font-mono text-[13px] tracking-[0.2em] text-faint select-none">••••••••</span>
        : <span className="font-mono text-[13px] break-all">{value}</span>}
      {buttons}
    </div>
  );
}

export function TotpCode({ resource, id, field }: { resource: string; id: string; field: string }) {
  const [data, setData] = useState<{ code: string; remaining: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      const r = await getTotpCode(resource, id, field, !logged.current);
      logged.current = true;
      if (alive) setData(r);
    };
    load();
    const tick = setInterval(() => {
      setData((d) => {
        if (!d) return d;
        if (d.remaining <= 1) { load(); return d; }
        return { ...d, remaining: d.remaining - 1 };
      });
    }, 1000);
    const close = setTimeout(() => setOpen(false), 120000); // tutup otomatis setelah 2 menit
    return () => { alive = false; clearInterval(tick); clearTimeout(close); };
  }, [open, resource, id, field]);

  if (!open) {
    return (
      <button type="button" className="btn btn-xs" onClick={() => setOpen(true)}>
        <KeyRound /> Kode 2FA
      </button>
    );
  }
  const pct = data ? (data.remaining / 30) * 100 : 100;
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-line bg-subtle py-0.5 pr-0.5 pl-2.5">
      <span className="font-mono text-[15px] font-semibold tracking-[0.15em] tabular-nums">
        {data ? `${data.code.slice(0, 3)} ${data.code.slice(3)}` : "··· ···"}
      </span>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-line" title={data ? `${data.remaining} detik` : ""}>
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear ${data && data.remaining <= 5 ? "bg-danger" : "bg-fg"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-6 text-[11px] text-muted tabular-nums">{data ? `${data.remaining}s` : ""}</span>
      <button
        type="button"
        title="Salin kode"
        aria-label="Salin kode"
        className="btn btn-ghost btn-xs btn-icon"
        disabled={!data}
        onClick={async () => {
          if (!data) return;
          await copyText(data.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="text-ok" /> : <Copy />}
      </button>
      <button type="button" title="Tutup" aria-label="Tutup" className="btn btn-ghost btn-xs btn-icon" onClick={() => setOpen(false)}>
        <X />
      </button>
    </div>
  );
}

export function ConfirmSubmit({ children, message, className = "btn btn-danger", title }: { children: React.ReactNode; message: string; className?: string; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : children}
    </button>
  );
}

export function AutoSubmitSelect({ name, defaultValue, options, className = "input !h-8 !w-auto text-[13px]" }: {
  name: string; defaultValue: string; options: { value: string; label: string }[]; className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      disabled={pending}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
