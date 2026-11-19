"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-line bg-subtle">
        <TriangleAlert className="size-4" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-base font-semibold">Terjadi kesalahan</h1>
      <p className="mt-1 text-[13px] text-muted">{error.digest ? "Aksi tidak bisa diproses. Coba lagi, atau hubungi admin jika berulang." : error.message}</p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn" onClick={reset}>Coba lagi</button>
        <Link className="btn btn-primary" href="/">Ke dashboard</Link>
      </div>
    </div>
  );
}
