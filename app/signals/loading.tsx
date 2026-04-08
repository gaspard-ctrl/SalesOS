export default function Loading() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="h-6 w-32 rounded animate-pulse" style={{ background: "#f0f0f0" }} />
            <div className="h-3 w-56 rounded animate-pulse mt-2" style={{ background: "#f5f5f5" }} />
          </div>
        </div>
        <div className="px-6 pb-4 grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border px-3.5 py-2.5 h-16 animate-pulse" style={{ borderColor: "#f0f0f0", background: "#fafafa" }} />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
        ))}
      </div>
    </div>
  );
}
