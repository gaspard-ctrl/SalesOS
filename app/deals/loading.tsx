export default function Loading() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="h-7 w-32 rounded-lg animate-pulse" style={{ background: "#f0f0f0" }} />
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
        <div className="ml-auto flex gap-3">
          <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
          <div className="h-8 w-24 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
        </div>
      </div>
      <div className="flex-1 p-6 flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 rounded-xl p-3 space-y-2" style={{ background: "#fff", border: "1px solid #eee" }}>
            <div className="h-5 w-24 rounded animate-pulse mb-3" style={{ background: "#f0f0f0" }} />
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-20 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
