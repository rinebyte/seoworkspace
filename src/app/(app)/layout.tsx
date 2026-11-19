import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";
import { Sidebar } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Pengecekan wajib-2FA dilakukan di setiap halaman/aksi (requireUser), bukan di layout,
  // karena layout tidak dijalankan ulang saat pindah halaman di sisi klien.
  const user = await requireUser({ allowWithout2fa: true });
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar user={user} logoutAction={logout} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
