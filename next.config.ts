import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Halaman yang baru dibuka disimpan 30 detik di browser → pindah menu bolak-balik terasa instan.
    // Setiap simpan/hapus memanggil revalidatePath, jadi data yang diubah tetap segar.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // same-origin: URL internal tidak bocor ke situs luar, tapi form tetap kirim Origin yang valid
          // (no-referrer membuat Origin "null" dan server action menolak dengan 500).
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
