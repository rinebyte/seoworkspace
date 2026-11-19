import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <div className="font-mono text-3xl font-semibold tracking-tight">404</div>
      <p className="mt-2 text-[13px] text-muted">Data tidak ditemukan, sudah dihapus, atau bukan milikmu.</p>
      <Link className="btn btn-primary mt-6" href="/">Ke dashboard</Link>
    </div>
  );
}
