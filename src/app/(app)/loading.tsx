export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat">
      <div className="mb-6 space-y-2">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="card overflow-hidden">
        <div className="h-9 border-b border-line bg-subtle" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-3 last:border-b-0">
            <div className="skeleton h-4 w-1/4" />
            <div className="skeleton h-4 w-1/6" />
            <div className="skeleton h-4 w-1/5" />
            <div className="skeleton ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
