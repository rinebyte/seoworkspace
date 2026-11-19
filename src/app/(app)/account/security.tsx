"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import { confirm2faSetup, regenerateRecoveryCodes, type Confirm2faResult } from "@/app/auth-actions";
import { SubmitButton } from "@/components/client";

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warn/40 bg-warn/5 px-3.5 py-2.5 text-[13px]">
        <span className="font-medium">Simpan recovery code ini sekarang.</span>{" "}
        <span className="text-muted">Kode hanya ditampilkan sekali. Tiap kode bisa dipakai satu kali untuk login jika HP hilang.</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-line bg-subtle p-4 font-mono text-[13px] tabular-nums">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check className="text-ok" /> : <Copy />} Salin semua
        </button>
        <a className="btn" download="seo-workspace-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`SEO Workspace — recovery codes\n\n${text}\n`)}`}>
          <Download /> Unduh .txt
        </a>
        {onDone && <button type="button" className="btn btn-primary ml-auto" onClick={onDone}>Sudah saya simpan</button>}
      </div>
    </div>
  );
}

export function Confirm2fa({ qrSvg, secret }: { qrSvg: string; secret: string }) {
  const [state, action] = useActionState<Confirm2faResult | null, FormData>(confirm2faSetup, null);
  const router = useRouter();
  if (state?.codes) return <RecoveryCodes codes={state.codes} onDone={() => router.refresh()} />;

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <div
        className="size-[180px] overflow-hidden rounded-lg border border-line bg-white p-2 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-4 text-[13px] text-muted">
          <li>Buka Google Authenticator, Authy, 1Password, atau aplikasi sejenis.</li>
          <li>Scan QR di samping. Tidak bisa scan? Masukkan kode ini manual:</li>
        </ol>
        <div className="rounded-md border border-line bg-subtle px-3 py-2 font-mono text-[13px] break-all select-all">{secret.match(/.{1,4}/g)?.join(" ")}</div>
        <form action={action} className="space-y-2">
          <label className="label" htmlFor="code">3. Masukkan kode 6 digit dari aplikasi</label>
          <div className="flex gap-2">
            <input id="code" name="code" className="input max-w-40 text-center font-mono tracking-[0.25em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required placeholder="000000" />
            <SubmitButton pendingText="Memeriksa…">Aktifkan 2FA</SubmitButton>
          </div>
          {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
        </form>
      </div>
    </div>
  );
}

export function RegenerateCodes() {
  const [state, action] = useActionState<Confirm2faResult | null, FormData>(regenerateRecoveryCodes, null);
  const [open, setOpen] = useState(false);
  if (state?.codes) return <RecoveryCodes codes={state.codes} />;
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>Buat recovery code baru</button>;
  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-4">
      <p className="text-[13px] text-muted">Recovery code lama tidak berlaku lagi setelah ini.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="rc-password">Password</label><input id="rc-password" name="password" type="password" autoComplete="current-password" className="input" required /></div>
        <div><label className="label" htmlFor="rc-code">Kode 2FA</label><input id="rc-code" name="code" inputMode="numeric" autoComplete="one-time-code" className="input font-mono" required /></div>
      </div>
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Batal</button>
        <SubmitButton pendingText="Membuat…">Buat ulang</SubmitButton>
      </div>
    </form>
  );
}
