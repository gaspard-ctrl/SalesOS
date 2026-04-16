export default function Loading() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#f8f8f8" }}>
      <div className="px-6 py-4" style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="h-7 w-40 rounded-lg animate-pulse" style={{ background: "#f0f0f0" }} />
        <div className="h-4 w-64 rounded-lg animate-pulse mt-2" style={{ background: "#f5f5f5" }} />
      </div>
      <div className="px-6 py-3" style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-lg animate-pulse" style={{ background: "#f5f5f5" }} />
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
          ))}
        </div>
        <div className="h-72 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 h-64 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
          <div className="lg:col-span-3 h-64 rounded-xl animate-pulse" style={{ background: "#fff", border: "1px solid #eee" }} />
        </div>
      </div>
    </div>
  );
}
