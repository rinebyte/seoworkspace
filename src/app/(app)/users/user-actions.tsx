"use client";

import { useState, useTransition } from "react";
import { KeyRound, LogOut, MoreHorizontal, ShieldOff } from "lucide-react";
import { adminLogoutUser, adminReset2fa, adminResetPassword, type ResetResult } from "@/app/auth-actions";
import { CopyButton } from "@/components/client";

/** Menu aksi admin per user: reset password, reset 2FA, keluarkan semua sesi. */
export function UserAdminMenu({ id, email, has2fa }: { id: string; email: string; has2fa: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reset, setReset] = useState<ResetResult>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = (msg: string, fn: () => Promise<unknown>, after: string) => {
    if (!confirm(msg)) return;
    start(async () => { await fn(); setOpen(false); setDone(after); setTimeout(() => setDone(null), 2500); });
  };

  return (
    <div className="relative inline-block text-left">
      <button type="button" className="btn btn-ghost btn-icon" title="Aksi" aria-label="Aksi" onClick={() => setOpen((v) => !v)} disabled={pending}>
        <MoreHorizontal />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-lg border border-line bg-panel py-1 text-[13px] shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
            onClick={() => {
              if (!confirm(`Buat password sementara untuk ${email}? Password lama tidak berlaku dan semua sesinya dikeluarkan.`)) return;
              start(async () => { setReset(await adminResetPassword(id)); setOpen(false); });
            }}
          >
            <KeyRound className="size-4 text-faint" /> Reset password
          </button>
          {has2fa && (
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
              onClick={() => run(`Matikan 2FA ${email}? Lakukan hanya jika user kehilangan HP dan recovery code.`, () => adminReset2fa(id), "2FA dimatikan")}>
              <ShieldOff className="size-4 text-faint" /> Reset 2FA
            </button>
          )}
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover"
            onClick={() => run(`Keluarkan ${email} dari semua perangkat?`, () => adminLogoutUser(id), "Semua sesi dikeluarkan")}>
            <LogOut className="size-4 text-faint" /> Keluarkan semua sesi
          </button>
        </div>
      )}
      {reset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReset(null)}>
          <div className="card w-full max-w-sm p-5 text-left" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Password sementara</h3>
            <p className="mt-1 text-[13px] text-muted">Berikan ke {reset.email} lewat jalur aman, lalu minta segera menggantinya. Password ini tidak akan ditampilkan lagi.</p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-line bg-subtle px-3 py-2 font-mono text-sm">
              <span className="select-all">{reset.password}</span>
              <CopyButton value={reset.password} />
            </div>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => setReset(null)}>Tutup</button>
          </div>
        </div>
      )}
      {done && <span className="absolute top-1/2 right-9 -translate-y-1/2 text-xs whitespace-nowrap text-muted">{done}</span>}
    </div>
  );
}
