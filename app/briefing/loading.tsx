export default function Loading() {
  return (
    <div className="flex h-full" style={{ background: "#f8f8f8" }}>
      <div className="w-full max-w-md border-r p-4 space-y-3" style={{ borderColor: "#eee", background: "#fff" }}>
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "#f0f0f0" }} />
        <div className="h-4 w-32 rounded animate-pulse" style={{ background: "#f5f5f5" }} />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#f5f5f5" }} />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="h-6 w-64 rounded animate-pulse mb-4" style={{ background: "#f0f0f0" }} />
        <div className="h-4 w-96 rounded animate-pulse" style={{ background: "#f5f5f5" }} />
      </div>
    </div>
  );
}
