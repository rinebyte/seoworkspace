// Definisi modul (hosting, VPS, domain, email, backlink).
// Halaman list/form/detail dan server actions dibangun dari konfigurasi ini.

export type FieldType =
  | "text"
  | "url"
  | "email"
  | "textarea"
  | "secret" // password satu baris, terenkripsi -> kolom `<name>Enc`
  | "secretText" // rahasia multi-baris (backup codes), terenkripsi
  | "totp" // secret 2FA (base32 / otpauth://), terenkripsi, tampil sebagai kode live
  | "date"
  | "int"
  | "select"
  | "relation"
  | "category"; // kategori domain: ketik bebas, dibuat otomatis jika belum ada

export type Option = { value: string; label: string };

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  relation?: { model: "hosting" | "vps" | "domain"; key: string; labelField: string };
  placeholder?: string;
  help?: string;
  list?: boolean; // tampil sebagai kolom di tabel
  mono?: boolean;
  defaultValue?: string;
};

export type ModelName = "hosting" | "vps" | "domain" | "emailAccount" | "backlinkOrder";

export type Resource = {
  key: string; // segmen URL
  model: ModelName;
  title: string;
  singular: string;
  description: string;
  titleField: string;
  fields: Field[];
  search: string[];
};

export const isSecret = (f: Field) => f.type === "secret" || f.type === "secretText" || f.type === "totp";
export const encColumn = (f: Field) => `${f.name}Enc`;

export const DOMAIN_STATUS: Option[] = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "MONEY_SITE", label: "Money site" },
  { value: "PBN", label: "PBN" },
  { value: "REDIRECT", label: "Redirect" },
  { value: "PARKED", label: "Parkir" },
  { value: "EXPIRED", label: "Mati / Expired" },
];

export const REDIRECT_TYPES: Option[] = [
  { value: "301", label: "301 (permanen)" },
  { value: "302", label: "302 (sementara)" },
  { value: "META", label: "Meta / JS" },
  { value: "MASKING", label: "Masking / Frame" },
];

export const BACKLINK_TYPES: Option[] = [
  { value: "BLOGPOST", label: "Blogpost" },
  { value: "PBN", label: "PBN" },
  { value: "GUEST_POST", label: "Guest post" },
  { value: "SOCIAL", label: "Social bookmark" },
  { value: "PROFILE", label: "Profile / Forum" },
  { value: "OTHER", label: "Lainnya" },
];

export const BACKLINK_STATUS: Option[] = [
  { value: "PROCESS", label: "Diproses" },
  { value: "PARTIAL", label: "Sebagian terkirim" },
  { value: "DONE", label: "Selesai" },
  { value: "CANCELED", label: "Batal" },
];

export const ITEM_STATUS: Option[] = [
  { value: "LIVE", label: "Live" },
  { value: "PENDING", label: "Pending" },
  { value: "REMOVED", label: "Hilang" },
];

export const optionLabel = (opts: Option[] | undefined, v: string | null | undefined) =>
  opts?.find((o) => o.value === v)?.label ?? v ?? "—";

export const RESOURCES: Resource[] = [
  {
    key: "hosting",
    model: "hosting",
    title: "Hosting",
    singular: "Hosting",
    description: "Akun hosting / cPanel / DirectAdmin",
    titleField: "label",
    search: ["label", "provider", "username", "panelUrl", "notes"],
    fields: [
      { name: "label", label: "Nama akun", type: "text", required: true, list: true, placeholder: "Niagahoster - akun 1" },
      { name: "provider", label: "Provider", type: "text", list: true },
      { name: "panelUrl", label: "URL panel / login", type: "url", list: true, placeholder: "https://..." },
      { name: "username", label: "Username", type: "text", list: true, mono: true },
      { name: "password", label: "Password", type: "secret", list: true },
      { name: "expiresAt", label: "Expired", type: "date", list: true },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
  {
    key: "vps",
    model: "vps",
    title: "VPS / Server",
    singular: "VPS",
    description: "Server VPS / dedicated beserta akses SSH",
    titleField: "label",
    search: ["label", "provider", "ip", "username", "notes"],
    fields: [
      { name: "label", label: "Nama server", type: "text", required: true, list: true, placeholder: "VPS-SG-01" },
      { name: "provider", label: "Provider", type: "text", list: true },
      { name: "ip", label: "IP address", type: "text", list: true, mono: true },
      { name: "sshPort", label: "Port SSH", type: "int", defaultValue: "22" },
      { name: "username", label: "User", type: "text", list: true, mono: true, defaultValue: "root" },
      { name: "password", label: "Password", type: "secret", list: true },
      { name: "panelUrl", label: "URL panel (aaPanel, CyberPanel, dsb)", type: "url" },
      { name: "expiresAt", label: "Expired", type: "date", list: true },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
  {
    key: "domains",
    model: "domain",
    title: "Domain",
    singular: "Domain",
    description: "Domain, lokasi hosting, dan tujuan redirect",
    titleField: "name",
    search: ["name", "registrar", "registrarAccount", "redirectTo", "notes"],
    fields: [
      { name: "name", label: "Domain", type: "text", required: true, list: true, mono: true, placeholder: "contoh.com" },
      { name: "category", label: "Kategori", type: "category", list: true, placeholder: "mis. Money site kesehatan", help: "Pilih yang sudah ada atau ketik nama baru" },
      { name: "status", label: "Status", type: "select", options: DOMAIN_STATUS, list: true, defaultValue: "ACTIVE" },
      { name: "redirectTo", label: "Redirect ke", type: "url", list: true, placeholder: "https://tujuan.com", help: "Kosongkan jika tidak di-redirect" },
      { name: "redirectType", label: "Tipe redirect", type: "select", options: REDIRECT_TYPES },
      { name: "hostingId", label: "Di hosting", type: "relation", relation: { model: "hosting", key: "hosting", labelField: "label" }, list: true },
      { name: "vpsId", label: "Di VPS", type: "relation", relation: { model: "vps", key: "vps", labelField: "label" }, list: true },
      { name: "registrar", label: "Registrar", type: "text" },
      { name: "registrarAccount", label: "Akun registrar", type: "text", help: "Email/username login registrar" },
      { name: "expiresAt", label: "Expired", type: "date", list: true },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
  {
    key: "emails",
    model: "emailAccount",
    title: "Email & Akun",
    singular: "Akun",
    description: "Email / akun beserta password dan kode 2FA",
    titleField: "email",
    search: ["email", "provider", "recoveryEmail", "notes"],
    fields: [
      { name: "email", label: "Email / username", type: "text", required: true, list: true, mono: true },
      { name: "provider", label: "Layanan", type: "text", list: true, placeholder: "Gmail, Outlook, GSC, dsb" },
      { name: "password", label: "Password", type: "secret", list: true },
      { name: "totpSecret", label: "Secret 2FA", type: "totp", list: true, help: "Tempel secret key (base32) atau link otpauth:// dari menu \"tidak bisa scan QR\"" },
      { name: "backupCodes", label: "Backup codes", type: "secretText" },
      { name: "recoveryEmail", label: "Email / no. pemulihan", type: "text" },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
  {
    key: "backlinks",
    model: "backlinkOrder",
    title: "Backlink",
    singular: "Order backlink",
    description: "Pembelian backlink dan link yang sudah terkirim",
    titleField: "vendor",
    search: ["vendor", "targetUrl", "anchorText", "notes"],
    fields: [
      { name: "vendor", label: "Vendor", type: "text", required: true, list: true, placeholder: "BandarPBN" },
      { name: "type", label: "Jenis", type: "select", options: BACKLINK_TYPES, list: true, defaultValue: "BLOGPOST" },
      { name: "quantity", label: "Jumlah dibeli", type: "int", required: true, list: true, placeholder: "100" },
      { name: "price", label: "Harga (Rp)", type: "int", list: true },
      { name: "purchasedAt", label: "Tanggal beli", type: "date", list: true },
      { name: "domainId", label: "Domain target", type: "relation", relation: { model: "domain", key: "domain", labelField: "name" }, list: true },
      { name: "targetUrl", label: "URL target", type: "url" },
      { name: "anchorText", label: "Anchor text", type: "textarea", help: "Satu anchor per baris jika lebih dari satu" },
      { name: "status", label: "Status order", type: "select", options: BACKLINK_STATUS, list: true, defaultValue: "PROCESS" },
      { name: "notes", label: "Catatan", type: "textarea" },
    ],
  },
];

export function getResource(key: string) {
  return RESOURCES.find((r) => r.key === key);
}
