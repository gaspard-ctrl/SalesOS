export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "#f0f0f0" }} />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 h-24 animate-pulse" style={{ borderColor: "#eee", background: "#fff" }} />
        ))}
      </div>
      <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "#eee", background: "#fff" }}>
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: "#f0f0f0" }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
        ))}
      </div>
    </div>
  );
}
