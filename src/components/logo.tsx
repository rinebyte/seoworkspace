import { Layers } from "lucide-react";

/** Logo aplikasi: ikon layer monokrom di kotak (dipakai di sidebar & login). */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-10 rounded-lg" : "size-7 rounded-md";
  const icon = size === "lg" ? "size-5" : "size-4";
  return (
    <div className={`flex shrink-0 items-center justify-center bg-primary text-primary-fg ${box}`} aria-hidden="true">
      <Layers className={icon} strokeWidth={2} />
    </div>
  );
}
