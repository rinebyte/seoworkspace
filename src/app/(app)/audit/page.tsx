import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, OwnerFilter, PageHeader, StatusDot } from "@/components/ui";
import { userOptions } from "@/lib/repo";

export const metadata = { title: "Audit log" };

const ACTION_LABEL: Record<string, string> = {
  LOGIN: "Login", LOGIN_FAILED: "Login gagal", SETUP_ADMIN: "Setup admin", CREATE: "Tambah", UPDATE: "Ubah",
  DELETE: "Hapus", VIEW_SECRET: "Lihat password", COPY_SECRET: "Salin password", VIEW_2FA: "Buka kode 2FA",
  ADD_LINKS: "Tambah link", CHANGE_PASSWORD: "Ganti password", BULK_CREATE: "Bulk add",
  "2FA_FAILED": "Kode 2FA salah", "2FA_ENABLED": "Aktifkan 2FA", "2FA_DISABLED": "Matikan 2FA",
  "2FA_RECOVERY_RESET": "Buat ulang recovery code", RESET_PASSWORD: "Reset password user", RESET_2FA: "Reset 2FA user",
  LOGOUT_ALL: "Keluarkan semua sesi",
};

function tone(action: string) {
  if (["LOGIN_FAILED", "2FA_FAILED", "DELETE", "2FA_DISABLED", "RESET_2FA"].includes(action)) return "danger" as const;
  if (["RESET_PASSWORD", "LOGOUT_ALL"].includes(action)) return "warn" as const;
  if (action.includes("SECRET") || action.includes("2FA")) return "warn" as const;
  return "neutral" as const;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ user?: string; owner?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const userId = sp.owner ?? sp.user;
  const logs = await prisma.auditLog.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Audit log" desc="300 aktivitas terakhir, termasuk siapa yang membuka atau menyalin password.">
        <OwnerFilter path="/audit" users={await userOptions()} value={userId} />
      </PageHeader>
      <div className="card overflow-x-auto">
        {logs.length === 0 ? <EmptyState title="Belum ada aktivitas" /> : (
          <table className="table">
            <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Objek</th><th>Detail</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-muted tabular-nums">{fmtDateTime(l.createdAt)}</td>
                  <td className="whitespace-nowrap font-medium">{l.user?.name ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 ${tone(l.action) === "neutral" ? "" : "font-medium"}`}>
                      <StatusDot tone={tone(l.action)} />{ACTION_LABEL[l.action] ?? l.action}
                    </span>
                  </td>
                  <td className="text-muted">{l.entity}</td>
                  <td className="max-w-md truncate text-muted">{l.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
