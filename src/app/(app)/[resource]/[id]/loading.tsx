export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat" className="max-w-4xl">
      <div className="mb-6 space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-6 w-64" />
      </div>
      <div className="card">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[180px_1fr] gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
